const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../services/prisma');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { authenticate, requireOrganiser, requireCommitteeMember } = require('../middleware/auth');
const { API_ERRORS, MEETING_STATUS, RESPONSE_STATUS } = require('@bmms/shared');
const pushNotification = require('../services/pushNotification');

const router = express.Router();

/**
 * GET /api/meetings
 * Get meetings for user (filtered by their committees)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { status, committeeId, upcoming, past } = req.query;

    // Get user's committee IDs
    const memberCommitteeIds = req.user.committeeMemberships.map((m) => m.committeeId);

    const where = {
      committeeId: committeeId ? committeeId : { in: memberCommitteeIds },
    };

    if (status) {
      where.status = status;
    }

    if (upcoming === 'true') {
      where.scheduledAt = { gte: new Date() };
      where.status = { in: [MEETING_STATUS.SCHEDULED, MEETING_STATUS.RESCHEDULED] };
    } else if (past === 'true') {
      // Past meetings: either scheduled date has passed, or status is completed/cancelled
      where.OR = [
        { scheduledAt: { lt: new Date() } },
        { status: { in: [MEETING_STATUS.COMPLETED, MEETING_STATUS.CANCELLED] } },
      ];
    }

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        committee: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            documents: true,
            responses: true,
          },
        },
        responses: {
          where: { userId: req.user.id },
          select: {
            status: true,
            respondedAt: true,
          },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    res.json({
      success: true,
      data: meetings,
    });
  })
);

/**
 * GET /api/meetings/:id
 * Get single meeting with full details
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
      include: {
        committee: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        responses: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!meeting) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Meeting not found');
    }

    // Check access
    const isMember = req.user.committeeMemberships.some((m) => m.committeeId === meeting.committeeId);
    if (!req.user.isAdmin && !isMember) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Access denied');
    }

    res.json({
      success: true,
      data: meeting,
    });
  })
);

/**
 * POST /api/meetings
 * Create new meeting (Organiser of committee only)
 */
router.post(
  '/',
  authenticate,
  [
    body('title').trim().notEmpty().withMessage('Meeting title is required'),
    body('committeeId').notEmpty().withMessage('Committee ID is required'),
    body('scheduledAt').isISO8601().withMessage('Valid scheduled date is required'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('description').optional().trim(),
    body('endTime').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { title, committeeId, scheduledAt, location, description, endTime } = req.body;

    // Check if user is organiser of this committee
    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can create meetings');
    }

    // Get all members of the committee for creating response records
    const committeeMembers = await prisma.committeeMember.findMany({
      where: { committeeId },
      select: { userId: true },
    });

    // Create meeting with pending responses for all members
    const meeting = await prisma.meeting.create({
      data: {
        title,
        description,
        committeeId,
        scheduledAt: new Date(scheduledAt),
        endTime: endTime ? new Date(endTime) : null,
        location,
        createdBy: req.user.id,
        responses: {
          create: committeeMembers.map((member) => ({
            userId: member.userId,
            status: RESPONSE_STATUS.PENDING,
          })),
        },
      },
      include: {
        committee: {
          select: {
            id: true,
            name: true,
          },
        },
        responses: true,
      },
    });

    // Send push notifications to all committee members (except creator)
    const scheduledDate = new Date(scheduledAt).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    pushNotification.notifyCommitteeMembers(
      committeeId,
      {
        type: 'meeting_invite',
        title: 'New Meeting Scheduled',
        body: `${title} on ${scheduledDate}`,
        meetingId: meeting.id,
        senderId: req.user.id,
        data: { meetingId: meeting.id, type: 'meeting_invite' },
      },
      { excludeUserId: req.user.id }
    ).catch(console.error);

    res.status(201).json({
      success: true,
      data: meeting,
    });
  })
);

/**
 * PUT /api/meetings/:id
 * Update meeting (Organiser only)
 */
router.put(
  '/:id',
  authenticate,
  [
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('scheduledAt').optional().isISO8601(),
    body('endTime').optional().isISO8601(),
    body('location').optional().trim().notEmpty(),
    body('status').optional().isIn(Object.values(MEETING_STATUS)),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    // Get current meeting
    const currentMeeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
    });

    if (!currentMeeting) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Meeting not found');
    }

    // Check if user is organiser of this committee
    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === currentMeeting.committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can update meetings');
    }

    const { title, description, scheduledAt, endTime, location, status } = req.body;

    // If rescheduling, update status
    let newStatus = status;
    if (scheduledAt && scheduledAt !== currentMeeting.scheduledAt.toISOString()) {
      newStatus = MEETING_STATUS.RESCHEDULED;
    }

    const meeting = await prisma.meeting.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(endTime && { endTime: new Date(endTime) }),
        ...(location && { location }),
        ...(newStatus && { status: newStatus }),
      },
      include: {
        committee: {
          select: {
            id: true,
            name: true,
          },
        },
        documents: true,
      },
    });

    // Send notification if meeting was rescheduled or updated
    if (newStatus === MEETING_STATUS.RESCHEDULED) {
      const newDate = new Date(scheduledAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      pushNotification.notifyMeetingAttendees(
        meeting.id,
        {
          type: 'meeting_rescheduled',
          title: 'Meeting Rescheduled',
          body: `${meeting.title} has been moved to ${newDate}`,
          senderId: req.user.id,
          data: { meetingId: meeting.id, type: 'meeting_rescheduled' },
        },
        { excludeUserId: req.user.id }
      ).catch(console.error);
    } else if (title || location) {
      // Notify about general updates
      pushNotification.notifyMeetingAttendees(
        meeting.id,
        {
          type: 'meeting_updated',
          title: 'Meeting Updated',
          body: `${meeting.title} details have been updated`,
          senderId: req.user.id,
          data: { meetingId: meeting.id, type: 'meeting_updated' },
        },
        { excludeUserId: req.user.id }
      ).catch(console.error);
    }

    res.json({
      success: true,
      data: meeting,
    });
  })
);

/**
 * DELETE /api/meetings/:id
 * Cancel meeting (Organiser only) - soft delete by changing status
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
    });

    if (!meeting) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Meeting not found');
    }

    // Check if user is organiser of this committee
    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === meeting.committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can cancel meetings');
    }

    await prisma.meeting.update({
      where: { id: req.params.id },
      data: { status: MEETING_STATUS.CANCELLED },
    });

    // Notify attendees about cancellation
    pushNotification.notifyMeetingAttendees(
      meeting.id,
      {
        type: 'meeting_cancelled',
        title: 'Meeting Cancelled',
        body: `${meeting.title} has been cancelled`,
        senderId: req.user.id,
        data: { meetingId: meeting.id, type: 'meeting_cancelled' },
      },
      { excludeUserId: req.user.id }
    ).catch(console.error);

    res.json({
      success: true,
      message: 'Meeting cancelled successfully',
    });
  })
);

/**
 * POST /api/meetings/:id/respond
 * Respond to meeting invitation (Member)
 */
router.post(
  '/:id/respond',
  authenticate,
  [
    body('status')
      .isIn([RESPONSE_STATUS.ACCEPTED, RESPONSE_STATUS.DECLINED])
      .withMessage('Status must be accepted or declined'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { status } = req.body;
    const meetingId = req.params.id;

    // Check if meeting exists and user is member
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Meeting not found');
    }

    const isMember = req.user.committeeMemberships.some(
      (m) => m.committeeId === meeting.committeeId
    );

    if (!isMember) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'You are not a member of this committee');
    }

    // Update or create response
    const response = await prisma.meetingResponse.upsert({
      where: {
        meetingId_userId: {
          meetingId,
          userId: req.user.id,
        },
      },
      update: {
        status,
        respondedAt: new Date(),
      },
      create: {
        meetingId,
        userId: req.user.id,
        status,
        respondedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: response,
    });
  })
);

/**
 * GET /api/meetings/:id/responses
 * Get all responses for a meeting (Organiser only)
 */
router.get(
  '/:id/responses',
  authenticate,
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
    });

    if (!meeting) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Meeting not found');
    }

    // Check if user is organiser or admin
    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === meeting.committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can view all responses');
    }

    const responses = await prisma.meetingResponse.findMany({
      where: { meetingId: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Group by status
    const summary = {
      accepted: responses.filter((r) => r.status === RESPONSE_STATUS.ACCEPTED).length,
      declined: responses.filter((r) => r.status === RESPONSE_STATUS.DECLINED).length,
      pending: responses.filter((r) => r.status === RESPONSE_STATUS.PENDING).length,
      total: responses.length,
    };

    res.json({
      success: true,
      data: {
        responses,
        summary,
      },
    });
  })
);

module.exports = router;
