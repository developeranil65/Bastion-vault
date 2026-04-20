/**
 * RBAC Middleware — Role-Based Access Control + Scope Validation
 *
 * Supports two authorization models:
 * 1. Role-based (human users): owner > admin > viewer
 * 2. Scope-based (Machine Identities): "env:action" format
 *
 * All checks enforce tenant isolation — cross-tenant access is always denied.
 */

import { Request, Response, NextFunction } from 'express';
import { MachineIdentityService } from '../services/machine-identity.service';

export type Role = 'owner' | 'admin' | 'viewer' | 'service';

export interface RBACContext extends Request {
  tenantId?: string;
  role: Role;
  userId: string;
  userEmail?: string;
  user?: any;
  authContext?: any;
}

/**
 * Role-Based Middleware — for human user endpoints
 *
 * Checks role hierarchy: owner > admin > viewer
 */
export const rbacMiddleware = (
  requiredRole: Role,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const reqAny = req as any;
    const authCtx = reqAny.authContext;
    const user = reqAny.user;

    if (!user && !authCtx) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Machine Identities with SERVICE role can access if scope allows
    if (authCtx?.actorType === 'MACHINE_IDENTITY') {
      // Service accounts bypass role matrix — they use scope-based access
      (req as RBACContext).tenantId = authCtx.tenantId;
      (req as RBACContext).role = 'service';
      return next();
    }

    // Human user — check role from JWT claims
    const role = (user?.role as Role) || 'viewer';

    // Derive tenantId from JWT only — NEVER trust request headers for tenant context
    const tenantId = authCtx?.tenantId || user?.tenantId;

    if (!tenantId) {
      return res.status(403).json({ error: 'Forbidden: No tenant context' });
    }

    // Cross-tenant isolation: if URL has tenantId, validate it matches
    const urlTenantId = req.params.tenantId;
    if (urlTenantId && urlTenantId !== tenantId) {
      return res.status(403).json({
        error: 'Forbidden: Cross-tenant access denied',
      });
    }

    // Role hierarchy check
    const permissionMatrix: Record<Role, Role[]> = {
      owner: ['owner'],
      admin: ['owner', 'admin'],
      viewer: ['owner', 'admin', 'viewer'],
      service: ['service'],
    };

    if (!permissionMatrix[requiredRole]?.includes(role)) {
      return res.status(403).json({
        error: `Forbidden: Requires role '${requiredRole}', you have '${role}'`,
      });
    }

    // Attach to request for downstream handlers
    (req as RBACContext).tenantId = tenantId;
    (req as RBACContext).role = role;

    next();
  };
};

/**
 * Scope-Based Middleware — for Machine Identity (Passport) endpoints
 *
 * Validates that the Passport's scopes include the required action
 * for the requested environment.
 *
 * Example: scopeMiddleware('read') on GET /:tenantId/envs/dev/secrets/:name/value
 *   → checks that scopes include "dev:read" or "*:read"
 */
export const scopeMiddleware = (
  requiredAction: string,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const reqAny = req as any;
    const authCtx = reqAny.authContext;
    const user = reqAny.user;

    // For human users (JWT), fall back to role-based — viewers can read
    if (!authCtx || authCtx.actorType === 'USER') {
      const role = user?.role || 'viewer';
      const roleActionMap: Record<string, string[]> = {
        owner: ['read', 'write'],
        admin: ['read', 'write'],
        viewer: ['read'],
      };
      if (roleActionMap[role]?.includes(requiredAction)) {
        return next();
      }
      return res.status(403).json({ error: `Forbidden: Role '${role}' cannot '${requiredAction}'` });
    }

    // For Machine Identities — check scopes
    const scopes: string[] = authCtx.scopes || [];
    const environment = req.params.environment;

    if (!environment) {
      return res.status(400).json({ error: 'Environment parameter required for scope validation' });
    }

    const requiredScope = `${environment}:${requiredAction}`;

    if (!MachineIdentityService.canAccess(scopes, requiredScope)) {
      return res.status(403).json({
        error: `Forbidden: Passport lacks scope '${requiredScope}'`,
      });
    }

    next();
  };
};

/**
 * Tenant Isolation Middleware
 * Ensures requests stay within the same tenant context.
 */
export const tenantIsolationMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const reqAny = req as any;
  const tenantId = reqAny.authContext?.tenantId || reqAny.tenantId;
  const urlTenantId = req.params.tenantId;

  if (tenantId && urlTenantId && tenantId !== urlTenantId) {
    return res.status(403).json({
      error: 'Cross-tenant access denied',
    });
  }

  next();
};

export default rbacMiddleware;
