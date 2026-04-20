/**
 * Secrets Controllers
 *
 * Rules:
 * 1. Memory-Only: Fetched secrets exist ONLY in RAM, never logged
 * 2. Strict Scoping: API enforces Tenant/Environment boundaries
 * 3. No Leakage: Secrets omitted from responses unless via /value endpoint
 * 4. Dual Auth: Supports both JWT (human) and Passport (machine) actors
 */

import { Request, Response } from 'express';
import { SecretService } from '../services/secret-service';
import { cacheService } from '../services/cache.service';
import { ZodSchema } from '../schemas/secret-schema';
import { environmentSchema, secretNameSchema, tenantIdSchema } from '../schemas/common-schema';
import { getAuthContext } from '../utils/request';
import { logger } from '../utils/logger';

const secretService = new SecretService();

/** POST /:tenantId/envs/:environment/secrets */
export async function createSecret(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId, environment } = req.params;
    const { name, value, metadata } = req.body;
    const tenantCheck = tenantIdSchema.safeParse(tenantId);
    const envCheck = environmentSchema.safeParse(environment);
    if (!tenantCheck.success || !envCheck.success) {
      res.status(400).json({ error: 'Invalid tenantId or environment' });
      return;
    }

    const validatedData = ZodSchema.secret.create({ name, value, metadata });

    const authCtx = getAuthContext(req);

    const secret = await secretService.createSecret(tenantCheck.data, envCheck.data, {
      name: validatedData.name,
      value: validatedData.value,
      metadata: validatedData.metadata,
      ownerId: authCtx.actorType === 'USER' ? authCtx.actorId : undefined,
    });

    // Explicit execution constraint: Cryptographic payload is discarded. Only record metadata.
    await secretService.logAudit(
      tenantCheck.data,
      authCtx.actorId,
      'CREATE',
      secret.name,
      { environment: envCheck.data, secretName: secret.name },
      authCtx.actorType,
    );
    await cacheService.deleteByPrefix(`secrets:${tenantCheck.data}:`);
    await cacheService.deleteByPrefix(`tenant-secrets:${tenantCheck.data}:`);

    logger.audit('Secret created', { tenantId, environment, name: secret.name });

    res.status(201).json({
      secret: {
        id: secret.id,
        name: secret.name,
        version: secret.version,
        environment,
        createdAt: secret.createdAt,
      },
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Secret name already exists in this environment' });
      return;
    }
    logger.error('[Secrets:Create] Error', { code: err.code || err.name || 'unknown' });
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** GET /:tenantId/envs/:environment/secrets */
export async function listSecrets(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId, environment } = req.params;
    const authCtx = getAuthContext(req);
    const tenantCheck = tenantIdSchema.safeParse(tenantId);
    const envCheck = environmentSchema.safeParse(environment);
    if (!tenantCheck.success || !envCheck.success) {
      res.status(400).json({ error: 'Invalid tenantId or environment' });
      return;
    }

    const cacheKey = `secrets:${tenantCheck.data}:${envCheck.data}:list`;
    const cached = await cacheService.getJSON<{ data: Array<Record<string, unknown>> }>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // GLASS VAULT: Never include encryptedData, encryptedDek, etc.
    const secrets = await secretService.getSecrets(
      tenantCheck.data,
      envCheck.data,
      ['id', 'name', 'version', 'environment', 'createdAt', 'updatedAt', 'isDeleted'],
    );

    await secretService.logAudit(
      tenantCheck.data, authCtx.actorId, 'LIST', 'BATCH',
      { environment: envCheck.data, count: secrets.length },
      authCtx.actorType,
    );

    const payload = {
      data: secrets.map((s: any) => ({
        id: s.id,
        name: s.name,
        version: s.version,
        environment: s.environment,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    };
    await cacheService.setJSON(cacheKey, payload, 30);

    res.json(payload);
  } catch (err: any) {
    logger.error('[Secrets:List] Error', { code: err.code || err.name || 'unknown' });
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * GET /:tenantId/envs/:environment/secrets/:secretName/value
 *
 * GLASS VAULT: The ONLY endpoint that returns plaintext.
 * Designed for Service Passports to inject directly into RAM.
 */
export async function getSecretValue(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId, environment, secretName } = req.params;
    const authCtx = getAuthContext(req);
    const tenantCheck = tenantIdSchema.safeParse(tenantId);
    const envCheck = environmentSchema.safeParse(environment);
    const nameCheck = secretNameSchema.safeParse(secretName);
    if (!tenantCheck.success || !envCheck.success || !nameCheck.success) {
      res.status(400).json({ error: 'Invalid path parameters' });
      return;
    }

    // 1. Fetch & Decrypt in memory — buffer wiped after conversion
    const plaintextValue = await secretService.getDecryptedSecret(
      tenantCheck.data, envCheck.data, nameCheck.data,
    );

    // 2. Audit log — NEVER log the value
    await secretService.logAudit(
      tenantCheck.data, authCtx.actorId, 'ACCESS_VALUE', nameCheck.data,
      { accessedVia: authCtx.actorType === 'MACHINE_IDENTITY' ? 'CLI/Passport' : 'API', environment: envCheck.data },
      authCtx.actorType,
    );

    logger.audit('Secret value accessed', { tenantId, environment, secretName, actor: authCtx.actorType });

    // 3. Return over TLS; disable caching to prevent proxy/browser leaks
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.json({ value: plaintextValue });

  } catch (err: any) {
    // GLASS VAULT: Never log err.message if it could contain secret fragments
    if (err.message === 'Secret not found' || err.message === 'Secret has been deleted') {
      res.status(404).json({ error: 'Secret not found' });
      return;
    }
    logger.error('[Secrets:GetValue] Secure retrieval failed');
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** PUT /:tenantId/envs/:environment/secrets/:secretName/rotate */
export async function rotateSecret(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId, environment, secretName } = req.params;
    const { newValue } = req.body || {};
    const authCtx = getAuthContext(req);
    const tenantCheck = tenantIdSchema.safeParse(tenantId);
    const envCheck = environmentSchema.safeParse(environment);
    const nameCheck = secretNameSchema.safeParse(secretName);
    if (!tenantCheck.success || !envCheck.success || !nameCheck.success) {
      res.status(400).json({ error: 'Invalid path parameters' });
      return;
    }

    let result;

    if (newValue) {
      // Replacement rotation — new plaintext value provided
      result = await secretService.rotateSecretWithValue(
        tenantCheck.data, envCheck.data, nameCheck.data, newValue,
      );
    } else {
      // Re-encryption rotation — same value, new DEK
      result = await secretService.rotateSecret(tenantCheck.data, envCheck.data, nameCheck.data);
    }

    await secretService.logAudit(
      tenantCheck.data, authCtx.actorId, 'ROTATE', nameCheck.data,
      { environment: envCheck.data, newVersion: result.version },
      authCtx.actorType,
    );
    await cacheService.deleteByPrefix(`secrets:${tenantCheck.data}:`);
    await cacheService.deleteByPrefix(`tenant-secrets:${tenantCheck.data}:`);

    logger.audit('Secret rotated', { tenantId, environment, secretName, version: result.version });

    res.json(result);
  } catch (err: any) {
    if (err.message === 'Secret not found') {
      res.status(404).json({ error: 'Secret not found' });
      return;
    }
    logger.error('[Secrets:Rotate] Error', { code: err.code || err.name || 'unknown' });
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/** DELETE /:tenantId/envs/:environment/secrets/:secretName */
export async function deleteSecret(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId, environment, secretName } = req.params;
    const authCtx = getAuthContext(req);
    const tenantCheck = tenantIdSchema.safeParse(tenantId);
    const envCheck = environmentSchema.safeParse(environment);
    const nameCheck = secretNameSchema.safeParse(secretName);
    if (!tenantCheck.success || !envCheck.success || !nameCheck.success) {
      res.status(400).json({ error: 'Invalid path parameters' });
      return;
    }

    await secretService.logAudit(
      tenantCheck.data, authCtx.actorId, 'DELETE', nameCheck.data,
      { environment: envCheck.data, reason: 'User initiated deletion' },
      authCtx.actorType,
    );

    await secretService.softDeleteSecret(tenantCheck.data, envCheck.data, nameCheck.data);
    await cacheService.deleteByPrefix(`secrets:${tenantCheck.data}:`);
    await cacheService.deleteByPrefix(`tenant-secrets:${tenantCheck.data}:`);

    logger.audit('Secret deleted', { tenantId, environment, secretName });

    res.json({ success: true, message: 'Secret soft-deleted' });
  } catch (err: any) {
    if (err.message === 'Secret not found') {
      res.status(404).json({ error: 'Secret not found' });
      return;
    }
    logger.error('[Secrets:Delete] Error', { code: err.code || err.name || 'unknown' });
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
