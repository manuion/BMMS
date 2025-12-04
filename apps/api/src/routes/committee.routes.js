const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../services/prisma');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { authenticate, requireAdmin, requireAnyOrganiser } = require('../middleware/auth');
const { API_ERRORS, COMMITTEE_ROLES } = require('@bmms/shared');

const router = express.Router();

/**
 * GET /api/committees
 * Get all committees (Admin: all, Others: their committees only)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    let committees;

    if (req.user.isAdmin) {
      // Admin sees all committees
      committees = await prisma.committee.findMany({
        include: {
          members: {
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
          _count: {
            select: {
              meetings: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Non-admin sees only their committees
      const memberCommitteeIds = req.user.committeeMemberships.map((m) => m.committeeId);

      committees = await prisma.committee.findMany({
        where: {
          id: { in: memberCommitteeIds },
        },
        include: {
          members: {
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
          _count: {
            select: {
              meetings: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json({
      success: true,
      data: committees,
    });
  })
);

/**
 * GET /api/committees/organiser
 * Get committees where current user is organiser
 */
router.get(
  '/organiser',
  authenticate,
  requireAnyOrganiser,
  asyncHandler(async (req, res) => {
    const organiserCommitteeIds = req.user.committeeMemberships
      .filter((m) => m.role === COMMITTEE_ROLES.ORGANISER)
      .map((m) => m.committeeId);

    const committees = await prisma.committee.findMany({
      where: {
        id: { in: organiserCommitteeIds },
      },
      include: {
        members: {
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
        _count: {
          select: {
            meetings: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: committees,
    });
  })
);

/**
 * GET /api/committees/:id
 * Get single committee
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const committee = await prisma.committee.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        meetings: {
          orderBy: { scheduledAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!committee) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Committee not found');
    }

    // Check access (admin or member)
    const isMember = req.user.committeeMemberships.some((m) => m.committeeId === committee.id);
    if (!req.user.isAdmin && !isMember) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Access denied');
    }

    res.json({
      success: true,
      data: committee,
    });
  })
);

/**
 * POST /api/committees
 * Create new committee (Admin only)
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Committee name is required'),
    body('description').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { name, description } = req.body;

    const committee = await prisma.committee.create({
      data: {
        name,
        description,
      },
    });

    res.status(201).json({
      success: true,
      data: committee,
    });
  })
);

/**
 * PUT /api/committees/:id
 * Update committee (Admin only)
 */
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('isActive').optional().isBoolean(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { name, description, isActive } = req.body;

    const committee = await prisma.committee.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({
      success: true,
      data: committee,
    });
  })
);

/**
 * DELETE /api/committees/:id
 * Deactivate committee (Admin only)
 */
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await prisma.committee.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Committee deactivated successfully',
    });
  })
);

/**
 * POST /api/committees/:id/members
 * Add member to committee (Admin only)
 */
router.post(
  '/:id/members',
  authenticate,
  requireAdmin,
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('role')
      .isIn([COMMITTEE_ROLES.ORGANISER, COMMITTEE_ROLES.MEMBER])
      .withMessage('Role must be organiser or member'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { userId, role } = req.body;
    const committeeId = req.params.id;

    // Check if committee exists
    const committee = await prisma.committee.findUnique({ where: { id: committeeId } });
    if (!committee) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Committee not found');
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'User not found');
    }

    // Check if already a member
    const existingMembership = await prisma.committeeMember.findUnique({
      where: {
        userId_committeeId: { userId, committeeId },
      },
    });

    if (existingMembership) {
      throw new ApiError(409, 'DUPLICATE_ENTRY', 'User is already a member of this committee');
    }

    const membership = await prisma.committeeMember.create({
      data: {
        userId,
        committeeId,
        role,
      },
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

    res.status(201).json({
      success: true,
      data: membership,
    });
  })
);

/**
 * PUT /api/committees/:id/members/:userId
 * Update member role in committee (Admin only)
 */
router.put(
  '/:id/members/:userId',
  authenticate,
  requireAdmin,
  [
    body('role')
      .isIn([COMMITTEE_ROLES.ORGANISER, COMMITTEE_ROLES.MEMBER])
      .withMessage('Role must be organiser or member'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { role } = req.body;
    const { id: committeeId, userId } = req.params;

    const membership = await prisma.committeeMember.update({
      where: {
        userId_committeeId: { userId, committeeId },
      },
      data: { role },
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

    res.json({
      success: true,
      data: membership,
    });
  })
);

/**
 * DELETE /api/committees/:id/members/:userId
 * Remove member from committee (Admin only)
 */
router.delete(
  '/:id/members/:userId',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id: committeeId, userId } = req.params;

    await prisma.committeeMember.delete({
      where: {
        userId_committeeId: { userId, committeeId },
      },
    });

    res.json({
      success: true,
      message: 'Member removed from committee',
    });
  })
);

module.exports = router;
