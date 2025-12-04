/**
 * Push Notification Service for React Native
 *
 * Handles Firebase Cloud Messaging (FCM) setup and notification handling.
 * Requires @react-native-firebase/messaging package.
 *
 * Setup instructions:
 * 1. Install: npm install @react-native-firebase/app @react-native-firebase/messaging
 * 2. Follow Firebase setup for iOS and Android:
 *    - iOS: Add GoogleService-Info.plist to ios/BoardMate/
 *    - Android: Add google-services.json to android/app/
 * 3. For iOS, enable Push Notifications capability in Xcode
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationsApi } from './api';

// Token storage key
const FCM_TOKEN_KEY = 'fcm_token';

// Will be set when Firebase is available
let messaging = null;

/**
 * Initialize Firebase Messaging
 * Returns false if Firebase is not installed/configured
 */
const initializeMessaging = async () => {
  if (messaging) return true;

  try {
    // Try to import Firebase messaging
    const firebaseMessaging = require('@react-native-firebase/messaging').default;
    messaging = firebaseMessaging();
    return true;
  } catch (error) {
    console.log('Firebase Messaging not available:', error.message);
    return false;
  }
};

/**
 * Request permission for push notifications
 */
export const requestPermission = async () => {
  const initialized = await initializeMessaging();
  if (!initialized) {
    console.log('Push notifications not available - Firebase not configured');
    return false;
  }

  try {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging.requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      return enabled;
    } else {
      // Android 13+ requires POST_NOTIFICATIONS permission
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    }
  } catch (error) {
    console.error('Permission request error:', error);
    return false;
  }
};

/**
 * Get FCM token and register with backend
 */
export const registerForPushNotifications = async () => {
  const initialized = await initializeMessaging();
  if (!initialized) return null;

  try {
    // Check/request permission first
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      console.log('Push notification permission denied');
      return null;
    }

    // Get the FCM token
    const token = await messaging.getToken();

    if (token) {
      // Check if we already registered this token
      const savedToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);

      if (savedToken !== token) {
        // Register new token with backend
        await notificationsApi.registerDeviceToken({
          token,
          platform: Platform.OS,
        });

        // Save token locally
        await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
        console.log('FCM token registered:', token.substring(0, 20) + '...');
      }
    }

    return token;
  } catch (error) {
    console.error('Failed to register for push notifications:', error);
    return null;
  }
};

/**
 * Unregister device token (call on logout)
 */
export const unregisterPushNotifications = async () => {
  try {
    const token = await AsyncStorage.getItem(FCM_TOKEN_KEY);

    if (token) {
      // Unregister from backend
      await notificationsApi.unregisterDeviceToken(token);

      // Remove local token
      await AsyncStorage.removeItem(FCM_TOKEN_KEY);
      console.log('FCM token unregistered');
    }
  } catch (error) {
    console.error('Failed to unregister push notifications:', error);
  }
};

/**
 * Setup notification handlers
 * @param {function} onNotificationReceived - Called when notification received while app in foreground
 * @param {function} onNotificationOpened - Called when user taps notification
 */
export const setupNotificationHandlers = async (
  onNotificationReceived,
  onNotificationOpened
) => {
  const initialized = await initializeMessaging();
  if (!initialized) return () => {};

  // Handle foreground notifications
  const unsubscribeForeground = messaging.onMessage(async (remoteMessage) => {
    console.log('Foreground notification:', remoteMessage);

    if (onNotificationReceived) {
      onNotificationReceived(remoteMessage);
    } else {
      // Default: show alert
      Alert.alert(
        remoteMessage.notification?.title || 'New Notification',
        remoteMessage.notification?.body || ''
      );
    }
  });

  // Handle notification opened (app was in background)
  const unsubscribeOpened = messaging.onNotificationOpenedApp((remoteMessage) => {
    console.log('Notification opened app:', remoteMessage);

    if (onNotificationOpened) {
      onNotificationOpened(remoteMessage);
    }
  });

  // Check if app was opened from notification (app was killed)
  const initialNotification = await messaging.getInitialNotification();
  if (initialNotification && onNotificationOpened) {
    onNotificationOpened(initialNotification);
  }

  // Handle token refresh
  const unsubscribeTokenRefresh = messaging.onTokenRefresh(async (newToken) => {
    console.log('FCM token refreshed');

    // Unregister old token
    const oldToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);
    if (oldToken) {
      try {
        await notificationsApi.unregisterDeviceToken(oldToken);
      } catch (error) {
        // Ignore errors for old token
      }
    }

    // Register new token
    await notificationsApi.registerDeviceToken({
      token: newToken,
      platform: Platform.OS,
    });

    await AsyncStorage.setItem(FCM_TOKEN_KEY, newToken);
  });

  // Return cleanup function
  return () => {
    unsubscribeForeground();
    unsubscribeOpened();
    unsubscribeTokenRefresh();
  };
};

/**
 * Set background message handler
 * Must be called outside of React component
 */
export const setBackgroundMessageHandler = async () => {
  const initialized = await initializeMessaging();
  if (!initialized) return;

  messaging.setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('Background message:', remoteMessage);
    // Handle background message if needed
    // Note: notification is displayed automatically by FCM
  });
};

/**
 * Get notification data from remote message
 */
export const parseNotificationData = (remoteMessage) => {
  return {
    title: remoteMessage.notification?.title,
    body: remoteMessage.notification?.body,
    data: remoteMessage.data,
    // Extract meeting ID if present
    meetingId: remoteMessage.data?.meetingId,
    type: remoteMessage.data?.type,
  };
};

export default {
  requestPermission,
  registerForPushNotifications,
  unregisterPushNotifications,
  setupNotificationHandlers,
  setBackgroundMessageHandler,
  parseNotificationData,
};
