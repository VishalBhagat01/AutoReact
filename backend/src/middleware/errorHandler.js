/**
 * Centralized Error Handling Middleware
 * Compatible with Express 5 (handles async errors naturally)
 */

export class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

/**
 * Express error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  // If response has already started streaming, delegate to default handler
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || (err.response?.status) || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || (err.response?.status ? `FIGMA_API_${err.response.status}` : 'INTERNAL_ERROR');

  // Log error with details in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    console.error(`❌ [${req.method} ${req.originalUrl}] [${status}] ${message}`);
    if (err.stack && status >= 500) {
      console.error(err.stack);
    }
  }

  // Handle Rate Limiting headers if present
  if (status === 429 && err.retryAfter) {
    res.setHeader('Retry-After', err.retryAfter);
  }

  return res.status(status).json({
    success: false,
    error: message,
    code,
    ...(err.details ? { details: err.details } : {}),
  });
};

/**
 * 404 Route Not Found handler
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
  });
};

