/**
 * Request Utilities — Shared helpers for extracting auth context
 *
 * DRY: All controllers use these instead of ad-hoc req.user access.
 */

import { Request } from 'express';
import { AuthContext } from '../middlewares/auth';

/**
 * Extract the authenticated user's ID from the request.
 * Falls back to 'system' for unauthenticated/service contexts.
 */
export function getUserId(req: Request): string {
  const reqAny = req as any;
  return reqAny.authContext?.actorId || reqAny.userId || reqAny.user?.sub || 'system';
}

/**
 * Extract the full auth context from the request.
 * Provides a normalized interface regardless of auth method (JWT or Passport).
 */
export function getAuthContext(req: Request): AuthContext {
  const reqAny = req as any;

  if (reqAny.authContext) {
    return reqAny.authContext;
  }

  // Fallback: construct from legacy req.user
  return {
    actorId: reqAny.user?.sub || 'system',
    actorType: reqAny.user?.actorType || 'USER',
    tenantId: reqAny.user?.tenantId || reqAny.tenantId,
    email: reqAny.user?.email,
    role: reqAny.user?.role,
    permissions: reqAny.user?.permissions,
  };
}

/**
 * Extract tenant ID from request — checks authContext first, then params.
 */
export function getTenantId(req: Request): string | undefined {
  const reqAny = req as any;
  return reqAny.authContext?.tenantId || reqAny.tenantId || req.params.tenantId;
}
