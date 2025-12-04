const { API_ERRORS } = require('@bmms/shared');

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || API_ERRORS.SERVER_ERROR;
  let message = err.message || 'Internal server error';

  // Handle Prisma errors
  if (err.code === 'P2002') {
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    message = 'A record with this value already exists';
  }

  if (err.code === 'P2025') {
    statusCode = 404;
    errorCode = API_ERRORS.NOT_FOUND;
    message = 'Record not found';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = API_ERRORS.UNAUTHORIZED;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = API_ERRORS.UNAUTHORIZED;
    message = 'Token expired';
  }

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      statusCode,
      errorCode,
      message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: errorCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Async handler wrapper to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  ApiError,
  errorHandler,
  asyncHandler,
};
