/**
 * Push Notification Service
 *
 * Handles sending push notifications via Firebase Cloud Messaging (FCM)
 * Supports both iOS and Android devices
 */
const prisma = require('./prisma');

// Firebase Admin SDK - will be initialized if FIREBASE_SERVICE_ACCOUNT is provided
let admin = null;

const initializeFirebase = () => {
  if (admin) return admin;

  try {
    const firebaseAdmin = require('firebase-admin');

    // Check if service account credentials are provided
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccount) {
      const credentials = JSON.parse(serviceAccount);

      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(credentials),
      });

      admin = firebaseAdmin;
      console.log('Firebase Admin SDK initialized');
    } else {
      console.log('Firebase not configured - push notifications disabled');
    }
  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
  }

  return admin;
};

/**
 * Send push notification to specific user devices
 * @param {string} userId - User ID to send notification to
 * @param {object} notification - { title, body, data }
 * @returns {object} - { success: boolean, sent: number, failed: number }
 */
const sendToUser = async (userId, notification) => {
  const firebase = initializeFirebase();

  if (!firebase) {
    console.log('Push notification skipped - Firebase not configured');
    return { success: true, sent: 0, failed: 0, reason: 'Firebase not configured' };
  }

  try {
    // Get all active device tokens for the user
    const deviceTokens = await prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (deviceTokens.length === 0) {
      return { success: true, sent: 0, failed: 0, reason: 'No device tokens' };
    }

    const tokens = deviceTokens.map(dt => dt.token);

    // Build the FCM message
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data ? stringifyData(notification.data) : {},
      tokens,
    };

    // Send to multiple devices
    const response = await firebase.messaging().sendEachForMulticast(message);

    // Handle failed tokens (e.g., unregistered devices)
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          // Mark token as inactive if unregistered
          if (resp.error?.code === 'messaging/registration-token-not-registered') {
            deactivateToken(tokens[idx]);
          }
        }
      });
    }

    return {
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    console.error('Push notification error:', error);
    return { success: false, sent: 0, failed: 0, error: error.message };
  }
};

/**
 * Send push notification to multiple users
 * @param {string[]} userIds - Array of user IDs
 * @param {object} notification - { title, body, data }
 */
const sendToUsers = async (userIds, notification) => {
  const results = await Promise.all(
    userIds.map(userId => sendToUser(userId, notification))
  );

  return {
    success: true,
    totalSent: results.reduce((sum, r) => sum + r.sent, 0),
    totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
  };
};

/**
 * Create notification record and send push notification
 * @param {object} params - Notification parameters
 */
const createAndSend = async ({
  type,
  title,
  body,
  meetingId = null,
  senderId = null,
  receiverId,
  data = null,
}) => {
  // Create notification record in database
  const notification = await prisma.notification.create({
    data: {
      type,
      title,
      body,
      meetingId,
      senderId,
      receiverId,
      data,
    },
  });

  // Send push notification
  const pushResult = await sendToUser(receiverId, { title, body, data });

  return { notification, pushResult };
};

/**
 * Create notifications for all members of a committee
 * @param {string} committeeId - Committee ID
 * @param {object} notificationData - { type, title, body, meetingId, senderId, data }
 * @param {object} options - { excludeUserId: string }
 */
const notifyCommitteeMembers = async (committeeId, notificationData, options = {}) => {
  // Get all members of the committee
  const members = await prisma.committeeMember.findMany({
    where: {
      committeeId,
      user: {
        isActive: true,
      },
    },
    select: {
      userId: true,
    },
  });

  // Filter out excluded user (usually the sender)
  const userIds = members
    .map(m => m.userId)
    .filter(id => id !== options.excludeUserId);

  // Create notifications for each member
  const notifications = await Promise.all(
    userIds.map(userId =>
      createAndSend({
        ...notificationData,
        receiverId: userId,
      })
    )
  );

  return {
    success: true,
    count: notifications.length,
  };
};

/**
 * Notify meeting attendees
 * @param {string} meetingId - Meeting ID
 * @param {object} notificationData - { type, title, body, senderId, data }
 * @param {object} options - { excludeUserId: string }
 */
const notifyMeetingAttendees = async (meetingId, notificationData, options = {}) => {
  // Get meeting with responses
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      responses: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!meeting) {
    return { success: false, error: 'Meeting not found' };
  }

  // Get user IDs from meeting responses
  const userIds = meeting.responses
    .map(r => r.userId)
    .filter(id => id !== options.excludeUserId);

  // Create notifications for each attendee
  const notifications = await Promise.all(
    userIds.map(userId =>
      createAndSend({
        ...notificationData,
        meetingId,
        receiverId: userId,
      })
    )
  );

  return {
    success: true,
    count: notifications.length,
  };
};

/**
 * Convert data object values to strings (FCM requirement)
 */
const stringifyData = (data) => {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return result;
};

/**
 * Mark a device token as inactive
 */
const deactivateToken = async (token) => {
  try {
    await prisma.deviceToken.update({
      where: { token },
      data: { isActive: false },
    });
  } catch (error) {
    console.error('Failed to deactivate token:', error);
  }
};

module.exports = {
  initializeFirebase,
  sendToUser,
  sendToUsers,
  createAndSend,
  notifyCommitteeMembers,
  notifyMeetingAttendees,
};
