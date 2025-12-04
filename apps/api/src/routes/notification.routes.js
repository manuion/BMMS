const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../services/prisma');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { API_ERRORS } = require('@bmms/shared');
const pushNotification = require('../services/pushNotification');

const router = express.Router();

/**
 * GET /api/notifications
 * Get notifications for current user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { unreadOnly, limit = 50 } = req.query;

    const where = {
      receiverId: req.user.id,
    };

    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            scheduledAt: true,
          },
        },
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    const unreadCount = await prisma.notification.count({
      where: {
        receiverId: req.user.id,
        isRead: false,
      },
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  })
);

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put(
  '/:id/read',
  authenticate,
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Notification not found');
    }

    if (notification.receiverId !== req.user.id) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Access denied');
    }

    await prisma.notification.update({
      where: { id: req.params.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  })
);

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put(
  '/read-all',
  authenticate,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: {
        receiverId: req.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  })
);

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Notification not found');
    }

    if (notification.receiverId !== req.user.id) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Access denied');
    }

    await prisma.notification.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  })
);

/**
 * POST /api/notifications/device-token
 * Register device token for push notifications
 */
router.post(
  '/device-token',
  authenticate,
  [
    body('token').notEmpty().withMessage('Device token is required'),
    body('platform').isIn(['ios', 'android']).withMessage('Platform must be ios or android'),
    body('deviceId').optional(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'Validation error', errors.array());
    }

    const { token, platform, deviceId } = req.body;

    // Upsert device token (update if exists, create if not)
    const deviceToken = await prisma.deviceToken.upsert({
      where: { token },
      update: {
        userId: req.user.id,
        platform,
        deviceId,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: req.user.id,
        token,
        platform,
        deviceId,
      },
    });

    res.json({
      success: true,
      data: deviceToken,
    });
  })
);

/**
 * DELETE /api/notifications/device-token
 * Unregister device token (e.g., on logout)
 */
router.delete(
  '/device-token',
  authenticate,
  [body('token').notEmpty().withMessage('Device token is required')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'Validation error', errors.array());
    }

    const { token } = req.body;

    // Deactivate the token instead of deleting (for audit trail)
    await prisma.deviceToken.updateMany({
      where: {
        token,
        userId: req.user.id,
      },
      data: {
        isActive: false,
      },
    });

    res.json({
      success: true,
      message: 'Device token unregistered',
    });
  })
);

/**
 * POST /api/notifications/test-push
 * Send a test push notification (for development)
 */
router.post(
  '/test-push',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pushNotification.sendToUser(req.user.id, {
      title: 'Test Notification',
      body: 'This is a test push notification from BMMS',
      data: { type: 'test' },
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

module.exports = router;
