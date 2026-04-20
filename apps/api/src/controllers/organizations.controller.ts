/**
 * Tenants Controller — Multi-Tenant Administration
 *
 * Constraint: Restricts outputting encryptedData or decrypted payloads.
 * All queries enforce tenant isolation via tenantId.
 */

import { Request, Response } from 'express';
import { SecretService } from '../services/secret-service';
import { cacheService } from '../services/cache.service';
import prisma from '../lib/prisma';
import { getAuthContext } from '../utils/request';
import { logger } from '../utils/logger';
import { tenantIdSchema, tenantSettingsSchema } from '../schemas/common-schema';

const secretService = new SecretService();

/** GET /api/v1/tenants/:tenantId/settings */
export async function getTenantSettings(req: Request, res: Response): Promise<void> {
  const { tenantId } = req.params;
  const authCtx = getAuthContext(req);
  const tenantCheck = tenantIdSchema.safeParse(tenantId);

  if (!tenantCheck.success) {
    res.status(400).json({ error: 'Invalid tenantId' });
    return;
  }

  if (authCtx.tenantId && authCtx.tenantId !== tenantCheck.data) {
    res.status(403).json({ error: 'Cross-tenant access blocked' });
    return;
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantCheck.data },
      select: { settings: true },
    });
    res.json({ settings: tenant?.settings || {} });
  } catch {
    res.status(500).json({ error: 'Failed to read settings' });
  }
}

/** PUT /api/v1/tenants/:tenantId/settings */
export async function updateTenantSettings(req: Request, res: Response): Promise<void> {
  const { tenantId } = req.params;
  const authCtx = getAuthContext(req);
  const tenantCheck = tenantIdSchema.safeParse(tenantId);

  if (!tenantCheck.success) {
    res.status(400).json({ error: 'Invalid tenantId' });
    return;
  }

  // Cross-tenant isolation — enforce authContext.tenantId matches
  if (authCtx.tenantId && authCtx.tenantId !== tenantCheck.data) {
    res.status(403).json({ error: 'Cross-tenant access blocked' });
    return;
  }

  const parsedSettings = tenantSettingsSchema.safeParse(req.body);
  if (!parsedSettings.success) {
    res.status(400).json({ error: 'Invalid settings payload', details: parsedSettings.error.flatten() });
    return;
  }

  try {
    const existing = await prisma.tenant.findUnique({
      where: { id: tenantCheck.data },
      select: { settings: true },
    });
    const existingSettings = (existing?.settings || {}) as Record<string, unknown>;
    const incoming = parsedSettings.data as Record<string, unknown>;
    const mergedSettings = {
      ...existingSettings,
      ...incoming,
      secretGuardrails: {
        ...((existingSettings.secretGuardrails as Record<string, unknown> | undefined) || {}),
        ...((incoming.secretGuardrails as Record<string, unknown> | undefined) || {}),
      },
    };

    await prisma.tenant.update({
      where: { id: tenantCheck.data },
      data: { settings: mergedSettings as any },
    });

    logger.audit('Tenant settings updated', { tenantId: tenantCheck.data, updatedBy: authCtx.actorId });

    res.json({ success: true });
  } catch (err) {
    logger.error('[Tenants:Settings] Update failed', { tenantId: tenantCheck.data });
    res.status(500).json({ error: 'Update failed' });
  }
}

/** GET /api/v1/tenants/:tenantId/secrets */
export async function listTenantSecrets(req: Request, res: Response): Promise<void> {
  const { tenantId } = req.params;
  const authCtx = getAuthContext(req);
  const tenantCheck = tenantIdSchema.safeParse(tenantId);

  if (!tenantCheck.success) {
    res.status(400).json({ error: 'Invalid tenantId' });
    return;
  }

  if (authCtx.tenantId && authCtx.tenantId !== tenantCheck.data) {
    res.status(403).json({ error: 'Cross-tenant access blocked' });
    return;
  }

  try {
    const cacheKey = `tenant-secrets:${tenantCheck.data}:all`;
    const cached = await cacheService.getJSON<{ secrets: Array<Record<string, unknown>> }>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const secrets = await secretService.getSecrets(
      tenantCheck.data, undefined,
      ['id', 'name', 'version', 'environment', 'createdAt', 'updatedAt'],
    );

    const payload = { secrets };
    await cacheService.setJSON(cacheKey, payload, 30);

    res.json(payload);
  } catch (err) {
    logger.error('[Tenants:Secrets] Read failed', { tenantId: tenantCheck.data });
    res.status(500).json({ error: 'Failed to read secrets' });
  }
}
