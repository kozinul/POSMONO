import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
export const AUTH_RATE_LIMIT_MAX = 30;

export interface AuthRateLimitOptions {
  windowMs?: number;
  limit?: number;
}

/**
 * Brute-force guard for the credential endpoints (`/api/auth/login`, `/hub-login`,
 * `/refresh`).
 *
 * Deliberately NOT mounted on `/api` as a whole: POS clients poll reports every few
 * seconds and every till in one shop shares a single public IP, so a global limiter
 * would throttle ordinary trading. Mount points live in `bootstrap/routes.ts`.
 */
export function createAuthRateLimiter(options: AuthRateLimitOptions = {}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs ?? AUTH_RATE_LIMIT_WINDOW_MS,
    limit: options.limit ?? AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Terlalu banyak percobaan masuk. Silakan coba lagi beberapa saat lagi.',
          details: null,
        },
        meta: {
          requestId: req.headers['x-request-id'] || null,
          timestamp: new Date().toISOString(),
          tenantId: req.tenantId,
        },
      });
    },
  });
}
