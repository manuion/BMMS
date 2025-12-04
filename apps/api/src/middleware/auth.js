const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const config = require('../config');
const { ApiError } = require('./errorHandler');
const { API_ERRORS, COMMITTEE_ROLES } = require('@bmms/shared');

const prisma = new PrismaClient();

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, API_ERRORS.UNAUTHORIZED, 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        committeeMemberships: {
          include: {
            committee: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new ApiError(401, API_ERRORS.UNAUTHORIZED, 'User not found or inactive');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(error);
    } else {
      next(new ApiError(401, API_ERRORS.UNAUTHORIZED, 'Authentication failed'));
    }
  }
};

/**
 * Check if user is admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(new ApiError(403, API_ERRORS.FORBIDDEN, 'Admin access required'));
  }
  next();
};

/**
 * Check if user is organiser in the specified committee
 */
const requireOrganiser = (committeeIdParam = 'committeeId') => {
  return (req, res, next) => {
    const committeeId = req.params[committeeIdParam] || req.body.committeeId;

    if (!committeeId) {
      return next(new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'Committee ID required'));
    }

    const membership = req.user.committeeMemberships.find(
      (m) => m.committeeId === committeeId && m.role === COMMITTEE_ROLES.ORGANISER
    );

    if (!membership && !req.user.isAdmin) {
      return next(new ApiError(403, API_ERRORS.FORBIDDEN, 'Organiser access required for this committee'));
    }

    req.committeeRole = membership?.role;
    next();
  };
};

/**
 * Check if user is member of the specified committee
 */
const requireCommitteeMember = (committeeIdParam = 'committeeId') => {
  return (req, res, next) => {
    const committeeId = req.params[committeeIdParam] || req.body.committeeId;

    if (!committeeId) {
      return next(new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'Committee ID required'));
    }

    const membership = req.user.committeeMemberships.find(
      (m) => m.committeeId === committeeId
    );

    if (!membership && !req.user.isAdmin) {
      return next(new ApiError(403, API_ERRORS.FORBIDDEN, 'You are not a member of this committee'));
    }

    req.committeeRole = membership?.role;
    next();
  };
};

/**
 * Check if user is organiser in at least one committee
 */
const requireAnyOrganiser = (req, res, next) => {
  const isOrganiser = req.user.committeeMemberships.some(
    (m) => m.role === COMMITTEE_ROLES.ORGANISER
  );

  if (!isOrganiser && !req.user.isAdmin) {
    return next(new ApiError(403, API_ERRORS.FORBIDDEN, 'Organiser access required'));
  }

  next();
};

module.exports = {
  authenticate,
  requireAdmin,
  requireOrganiser,
  requireCommitteeMember,
  requireAnyOrganiser,
};
