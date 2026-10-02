import type { RequestHandler } from 'express';
import type {
  HubAuthorization,
  HubMemberAccessService,
} from '../../../application/services/HubMemberAccessService';

declare global {
  namespace Express {
    interface Request {
      /**
       * Set by `requireHubPermission` for handlers mounted behind it. Carries the
       * already-resolved hub and role so a handler neither re-reads the hub nor
       * re-derives the permission decision.
       */
      hubAccess?: HubAuthorization;
    }
  }
}

/**
 * Hub V2 Fase 21 — the member-facing hub guard.
 *
 * Why this exists instead of `authorize(PERMISSIONS.HUB_*)`: hub permissions are
 * absent from every JWT. A token carries the caller's **tenant** permissions, so
 * the ordinary middleware would answer "no" for every member regardless of role,
 * and adding `hub.*` to tokens would make the hub layer ride along on tenant
 * sessions. Membership is the authority here, resolved per request from the
 * membership row.
 *
 * `accessService` is injected rather than imported so the router stays free of
 * container lookups. Mount it **after** `authenticate`: it reads `req.userId`, so
 * running it first would authorize an anonymous request.
 */
export function requireHubPermission(
  accessService: HubMemberAccessService,
  ...required: string[]
): RequestHandler {
  return (req, res, next) => {
    void accessService
      .assertHubPermission(req.params.hubId, req.userId, ...required)
      .then((authorization) => {
        req.hubAccess = authorization;
        next();
      })
      .catch(next);
  };
}