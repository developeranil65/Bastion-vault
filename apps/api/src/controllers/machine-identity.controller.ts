/**
 * Machine Identity Controller — Passport Management
 *
 * Admin-only operations for creating, listing, and revoking Machine Identity Passports.
 *
 * Operations constraint: The unhashed Passport token string operates write-once on creation.
 * After that, only metadata is accessible.
 */

import { Request, Response } from 'express';
import { machineIdentityService } from '../services/machine-identity.service';
import { cacheService } from '../services/cache.service';
import { SecretService } from '../services/secret-service';
import { getAuthContext } from '../utils/request';
import { logger } from '../utils/logger';
import { identityIdSchema, tenantIdSchema } from '../schemas/common-schema';

const secretService = new SecretService();

/** POST /:tenantId/passports */
export async function createPassport(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId } = req.params;
    const { name, scopes, expiresAt } = req.body;
    const authCtx = getAuthContext(req);

    const tenantCheck = tenantIdSchema.safeParse(tenantId);
    if (!tenantCheck.success) {
      res.status(400).json({ error: 'Invalid tenantId' });
      return;
    }

    if (!name || !scopes || !Array.isArray(scopes) || scopes.length === 0) {
      res.status(400).json({
        error: 'name (string) and scopes (string[]) are required',
      });
      return;
    }

    // Validate scope format: "env:action" — env can be any word (supports custom envs)
    const validScopePattern = /^(\*|[\w-]+):(read|write|\*)$/;
    for (const scope of scopes) {
      if (!validScopePattern.test(scope)) {
        res.status(400).json({
          error: `Invalid scope format: "${scope}". Expected "env:action" (e.g., "dev:read", "prod:write", "preview-1:read", "*:read")`,
        });
        return;
      }
    }

    const passport = await machineIdentityService.createPassport(
      tenantCheck.data,
      name,
      scopes,
      expiresAt ? new Date(expiresAt) : undefined,
    );

    await cacheService.deleteByPrefix(`passports:${tenantCheck.data}:`);

    // Audit log — never log the token
    await secretService.logAudit(
      tenantId, authCtx.actorId, 'CREATE', passport.identityId,
      { name, scopes, expiresAt: passport.expiresAt },
      authCtx.actorType,
      'MACHINE_IDENTITY',
    );

    logger.audit('Machine Identity created', {
      tenantId,
      identityId: passport.identityId,
      name,
      scopes,
    });

    // GLASS VAULT: Raw token returned ONCE. Admin must save it now.
    res.status(201).json({
      message: 'Machine Identity created. Save this passport — the token will NOT be shown again.',
      passport,
    });
  } catch (err: any) {
    logger.error('[MachineIdentity:Create] Error', { code: err.code || 'unknown' });
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** GET /:tenantId/passports */
export async function listPassports(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId } = req.params;
    const tenantCheck = tenantIdSchema.safeParse(tenantId);
    if (!tenantCheck.success) {
      res.status(400).json({ error: 'Invalid tenantId' });
      return;
    }

    const cacheKey = `passports:${tenantCheck.data}:list`;
    const cached = await cacheService.getJSON<{ data: Awaited<ReturnType<typeof machineIdentityService.listPassports>> }>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const identities = await machineIdentityService.listPassports(tenantCheck.data);
    const payload = { data: identities };
    await cacheService.setJSON(cacheKey, payload, 30);

    res.json(payload);
  } catch (err: any) {
    logger.error('[MachineIdentity:List] Error', { code: err.code || 'unknown' });
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** GET /:tenantId/passports/:identityId */
export async function getPassport(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId, identityId } = req.params;
    const tenantCheck = tenantIdSchema.safeParse(tenantId);
    const identityCheck = identityIdSchema.safeParse(identityId);
    if (!tenantCheck.success || !identityCheck.success) {
      res.status(400).json({ error: 'Invalid path parameters' });
      return;
    }

    const identity = await machineIdentityService.getPassport(tenantCheck.data, identityCheck.data);

    res.json({ data: identity });
  } catch (err: any) {
    if (err.message === 'Machine Identity not found') {
      res.status(404).json({ error: 'Machine Identity not found' });
      return;
    }
    logger.error('[MachineIdentity:Get] Error', { code: err.code || 'unknown' });
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** DELETE /:tenantId/passports/:identityId */
export async function revokePassport(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId, identityId } = req.params;
    const authCtx = getAuthContext(req);
    const tenantCheck = tenantIdSchema.safeParse(tenantId);
    const identityCheck = identityIdSchema.safeParse(identityId);
    if (!tenantCheck.success || !identityCheck.success) {
      res.status(400).json({ error: 'Invalid path parameters' });
      return;
    }

    await machineIdentityService.revokePassport(tenantCheck.data, identityCheck.data, authCtx.actorId);
    await cacheService.deleteByPrefix(`passports:${tenantCheck.data}:`);

    await secretService.logAudit(
      tenantCheck.data, authCtx.actorId, 'REVOKE', identityCheck.data,
      { reason: 'Admin revoked Machine Identity' },
      authCtx.actorType,
      'MACHINE_IDENTITY',
    );

    logger.audit('Machine Identity revoked', { tenantId, identityId, revokedBy: authCtx.actorId });

    res.json({ success: true, message: 'Machine Identity revoked. All associated tokens are now invalid.' });
  } catch (err: any) {
    if (err.message === 'Machine Identity not found') {
      res.status(404).json({ error: 'Machine Identity not found' });
      return;
    }
    logger.error('[MachineIdentity:Revoke] Error', { code: err.code || 'unknown' });
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
