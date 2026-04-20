/**
 * Passport Authentication Middleware
 *
 * Authenticates Machine Identity tokens sent via X-Passport-Token header.
 * Used by CLI tools and service-to-service communication.
 *
 * Constraint: This middleware prohibits logging the raw authentication token.
 */

import { Request, Response, NextFunction } from 'express';
import { machineIdentityService } from '../services/machine-identity.service';

export const authenticatePassport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const passportToken = req.headers['x-passport-token'] as string | undefined;

  if (!passportToken) {
    return res.status(401).json({ error: 'Unauthorized: Missing X-Passport-Token header' });
  }

  try {
    const identity = await machineIdentityService.validatePassport(passportToken);

    if (!identity) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired passport' });
    }

    // Attach normalized auth context for downstream middleware/controllers
    (req as any).authContext = {
      actorId: identity.identityId,
      actorType: 'MACHINE_IDENTITY',
      tenantId: identity.tenantId,
      scopes: identity.scopes,
      identityName: identity.name,
    };

    // Also set tenantId directly for RLS enforcement
    (req as any).tenantId = identity.tenantId;

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Passport validation failed' });
  }
};
