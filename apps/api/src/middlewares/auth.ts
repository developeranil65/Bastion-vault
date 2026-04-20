/**
 * Authentication Middleware — Dual-Path
 *
 * Supports two authentication methods:
 * 1. Bearer JWT (Authorization header) — for human users (Web UI, Admin)
 * 2. X-Passport-Token — for Machine Identities (CLI, services)
 *
 * Both paths attach a normalized `req.authContext` object for downstream use.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { machineIdentityService } from '../services/machine-identity.service';
import { config } from '../config/env';

export interface AuthContext {
  actorId: string;
  actorType: 'USER' | 'MACHINE_IDENTITY';
  tenantId?: string;
  email?: string;
  role?: string;
  scopes?: string[];
  permissions?: string[];
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const passportToken = req.headers['x-passport-token'] as string | undefined;

  // ─── Path 1: Machine Identity (X-Passport-Token) ──────────────────────
  if (passportToken) {
    try {
      const identity = await machineIdentityService.validatePassport(passportToken);

      if (!identity) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired passport' });
      }

      const authContext: AuthContext = {
        actorId: identity.identityId,
        actorType: 'MACHINE_IDENTITY',
        tenantId: identity.tenantId,
        scopes: identity.scopes,
      };

      (req as any).authContext = authContext;
      (req as any).tenantId = identity.tenantId;
      (req as any).user = {
        sub: identity.identityId,
        role: 'service',
        scopes: identity.scopes,
        tenantId: identity.tenantId,
        actorType: 'MACHINE_IDENTITY',
      };

      return next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized: Passport validation failed' });
    }
  }

  // ─── Path 2: Bearer JWT (Authorization header) ────────────────────────
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      config.JWT_SECRET,
    ) as jwt.JwtPayload;

    if (!decoded || !decoded.sub) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const authContext: AuthContext = {
      actorId: decoded.sub,
      actorType: 'USER',
      tenantId: decoded.tenantId,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions,
    };

    (req as any).authContext = authContext;
    (req as any).user = decoded;
    (req as any).tenantId = decoded.tenantId;

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
