import { RequestHandler } from 'express';

/**
 * Answers unmatched `/api/*` requests with a JSON 404.
 *
 * Must be registered after every API route but before the SPA fallback: without it a
 * typo'd or removed endpoint matches `app.get('*')` and answers `200 text/html`, so a
 * missing route looks healthy to API clients, uptime checks, and the ops runbook.
 */
export function notFoundApiHandler(): RequestHandler {
  return (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`,
        details: null,
      },
      meta: {
        requestId: req.headers['x-request-id'] || null,
        timestamp: new Date().toISOString(),
        tenantId: req.tenantId,
      },
    });
  };
}
