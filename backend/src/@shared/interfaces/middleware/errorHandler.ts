import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../infrastructure/error/AppError';
import { logger } from '../../infrastructure/logger/Logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta: {
        requestId: req.headers['x-request-id'] || null,
        timestamp: new Date().toISOString(),
        tenantId: req.tenantId,
      },
    });
    return;
  }

  logger.error({ err: err.message, stack: err.stack, req }, 'Unhandled error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: null,
    },
    meta: {
      requestId: req.headers['x-request-id'] || null,
      timestamp: new Date().toISOString(),
      tenantId: req.tenantId,
    },
  });
}
