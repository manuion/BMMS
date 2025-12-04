const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../services/prisma');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { API_ERRORS } = require('@bmms/shared');

const router = express.Router();

/**
 * GET /api/users
 * Get all users (Admin only)
 */
router.get(
  '/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        committeeMemberships: {
          include: {
            committee: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: users,
    });
  })
);

/**
 * GET /api/users/:id
 * Get user by ID (Admin only)
 */
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        committeeMemberships: {
          include: {
            committee: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'User not found');
    }

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * POST /api/users
 * Create a new user (Admin only)
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').optional().isMobilePhone(),
    body('isAdmin').optional().isBoolean(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { email, password, name, phone, isAdmin } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(409, 'DUPLICATE_ENTRY', 'User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        isAdmin: isAdmin || false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      data: user,
    });
  })
);

/**
 * PUT /api/users/:id
 * Update user (Admin only)
 */
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('name').optional().trim().notEmpty(),
    body('phone').optional().isMobilePhone(),
    body('isAdmin').optional().isBoolean(),
    body('isActive').optional().isBoolean(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { email, name, phone, isAdmin, isActive } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existingUser) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'User not found');
    }

    // Check email uniqueness if changing email
    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        throw new ApiError(409, 'DUPLICATE_ENTRY', 'Email already in use');
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(email && { email }),
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(isAdmin !== undefined && { isAdmin }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * DELETE /api/users/:id
 * Deactivate user (soft delete) (Admin only)
 */
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    // Prevent self-deletion
    if (req.params.id === req.user.id) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'Cannot deactivate your own account');
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  })
);

module.exports = router;
