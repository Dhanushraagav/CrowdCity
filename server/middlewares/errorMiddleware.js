import logger from '../config/logger.js';

/**
 * central error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong on the server!';
  const isProduction = process.env.NODE_ENV === 'production';

  // Log the error stack via winston logger
  logger.error(`${err.message || 'Unhandled error'}`, {
    metadata: {
      path: req.path,
      method: req.method,
      ip: req.ip,
      statusCode,
      stack: err.stack
    }
  });

  res.status(statusCode).json({
    error: message,
    ...(isProduction ? {} : { stack: err.stack })
  });
};

/**
 * Async handler utility to wrap async controllers and automatically catch errors
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom Error Class for API errors
 */
export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}
