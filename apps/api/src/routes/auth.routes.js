const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../services/prisma');
const config = require('../config');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { API_ERRORS } = require('@bmms/shared');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user (Admin only in production, open for development)
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').optional().isMobilePhone(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { email, password, name, phone } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(409, 'DUPLICATE_ENTRY', 'User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.status(201).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  })
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
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
      throw new ApiError(401, API_ERRORS.UNAUTHORIZED, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ApiError(401, API_ERRORS.UNAUTHORIZED, 'Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new ApiError(401, API_ERRORS.UNAUTHORIZED, 'Invalid email or password');
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  })
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const { password, ...userWithoutPassword } = req.user;

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  })
);

/**
 * PUT /api/auth/change-password
 * Change password
 */
router.put(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new ApiError(401, API_ERRORS.UNAUTHORIZED, 'Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  })
);

module.exports = router;
