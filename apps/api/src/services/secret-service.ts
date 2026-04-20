/**
 * Secret Service — Core Secrets Management
 *
 * Rules:
 * 1. Plaintext secrets exist ONLY in RAM during encrypt/decrypt operations
 * 2. NEVER log, console.log, or persist decrypted values
 * 3. Every DB query MUST filter by tenantId (Row-Level Security)
 * 4. Audit logs NEVER contain secret values — only metadata
 * 5. Soft-deleted secrets are renamed to free the namespace for reuse
 */

import prisma from '../lib/prisma';
import { encryptionService } from './encryption';
import { hashPassword } from '../utils/crypto';
import { config } from '../config/env';

export class SecretService {

  // ─── Create ────────────────────────────────────────────────────────────────

  /**
   * Create a new secret with envelope encryption.
   *
   * Flow:
   * 1. Encrypt plaintext → encryptedData + encryptedDek + IV + authTag
   * 2. Store only encrypted values in DB
   * 3. Plaintext is never persisted or logged
   */
  async createSecret(
    tenantId: string,
    environment: string,
    data: {
      name: string;
      value: string;
      metadata?: Record<string, any>;
      ownerId?: string;
    },
  ) {
    const encrypted = encryptionService.encrypt(data.value);

    return prisma.secret.create({
      data: {
        tenantId,
        environment,
        name: data.name,
        encryptedData: encrypted.encryptedData,
        encryptedDek: encrypted.encryptedDek,
        algorithm: encrypted.algorithm,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        dekIv: encrypted.dekIv,
        dekAuthTag: encrypted.dekAuthTag,
        metadata: data.metadata || {},
        ownerId: data.ownerId,
      },
    });
  }

  // ─── Read (Metadata Only) ─────────────────────────────────────────────────

  /**
   * Get secret by composite key — returns encryption fields for decrypt.
   */
  async getSecret(tenantId: string, environment: string, name: string) {
    const secret = await prisma.secret.findUnique({
      where: { tenantId_environment_name: { tenantId, environment, name } },
      select: {
        id: true,
        name: true,
        encryptedData: true,
        encryptedDek: true,
        algorithm: true,
        iv: true,
        authTag: true,
        dekIv: true,
        dekAuthTag: true,
        version: true,
        environment: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
        isDeleted: true,
        deletedAt: true,
      },
    });

    if (!secret) throw new Error('Secret not found');
    if (secret.isDeleted) throw new Error('Secret has been deleted');

    return secret;
  }

  /**
   * List secrets — metadata only, no encrypted data or values.
   */
  async getSecrets(tenantId: string, environment?: string, selectFields?: string[]) {
    const defaultSelect = {
      id: true,
      name: true,
      version: true,
      environment: true,
      createdAt: true,
      updatedAt: true,
      isDeleted: true,
    };

    const customSelect = selectFields
      ? selectFields.reduce((acc, f) => ({ ...acc, [f]: true }), {} as Record<string, boolean>)
      : undefined;

    return prisma.secret.findMany({
      where: { tenantId, environment, isDeleted: false },
      select: customSelect || defaultSelect,
    });
  }

  // ─── Decrypt (Memory-Only) ────────────────────────────────────────────────

  /**
   * Fetch, decrypt, and return the plaintext secret.
   * Decrypted payloads exist exclusively in volatile memory.
   */
  async getDecryptedSecret(tenantId: string, environment: string, name: string): Promise<string> {
    const secret = await this.getSecret(tenantId, environment, name);

    const { decryptedData, keyValid } = encryptionService.decrypt(
      secret.encryptedData,
      secret.encryptedDek,
      secret.iv,
      secret.authTag,
      secret.dekIv,
      secret.dekAuthTag,
    );

    if (!keyValid) {
      throw new Error('Decryption failed: invalid key or tampered data');
    }

    return decryptedData;
  }

  // ─── Rotate ───────────────────────────────────────────────────────────────

  /**
   * Rotate a secret: decrypt → re-encrypt with new DEK → increment version.
   */
  async rotateSecret(tenantId: string, environment: string, name: string) {
    const secret = await this.getSecret(tenantId, environment, name);

    const rotated = encryptionService.rotate(
      secret.encryptedData,
      secret.encryptedDek,
      secret.iv,
      secret.authTag,
      secret.dekIv,
      secret.dekAuthTag,
    );

    if (!rotated) {
      throw new Error('Rotation failed: could not decrypt existing secret');
    }

    await prisma.secret.update({
      where: { tenantId_environment_name: { tenantId, environment, name } },
      data: {
        encryptedData: rotated.encryptedData,
        encryptedDek: rotated.encryptedDek,
        algorithm: rotated.algorithm,
        iv: rotated.iv,
        authTag: rotated.authTag,
        dekIv: rotated.dekIv,
        dekAuthTag: rotated.dekAuthTag,
        version: { increment: 1 },
      },
    });

    return {
      success: true,
      rotatedAt: new Date().toISOString(),
      version: secret.version + 1,
    };
  }

  /**
   * Rotate a secret with a new plaintext value (replacement rotation).
   */
  async rotateSecretWithValue(
    tenantId: string,
    environment: string,
    name: string,
    newValue: string,
  ) {
    const secret = await this.getSecret(tenantId, environment, name);
    const encrypted = encryptionService.encrypt(newValue);

    await prisma.secret.update({
      where: { tenantId_environment_name: { tenantId, environment, name } },
      data: {
        encryptedData: encrypted.encryptedData,
        encryptedDek: encrypted.encryptedDek,
        algorithm: encrypted.algorithm,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        dekIv: encrypted.dekIv,
        dekAuthTag: encrypted.dekAuthTag,
        version: { increment: 1 },
      },
    });

    return {
      success: true,
      rotatedAt: new Date().toISOString(),
      version: secret.version + 1,
    };
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  /**
   * Soft-delete a secret.
   *
   * FIX: Renames the secret to `{name}__deleted_{timestamp}` to free the
   * namespace in the @@unique constraint. This allows users to re-create
   * a secret with the same name after deletion.
   */
  async softDeleteSecret(tenantId: string, environment: string, name: string) {
    const secret = await this.getSecret(tenantId, environment, name);

    const tombstoneName = `${name}__deleted_${Date.now()}`;

    return prisma.secret.update({
      where: { tenantId_environment_name: { tenantId, environment, name } },
      data: {
        name: tombstoneName,
        isDeleted: true,
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  // ─── Audit Logging ────────────────────────────────────────────────────────

  /**
   * HMAC-chained audit log entry.
   * Each entry's hash includes the previous entry's hash for tamper detection.
   */
  async logAudit(
    tenantId: string,
    actorId: string,
    action: string,
    resourceId: string,
    metadata: any,
    actorType: string = 'USER',
    resourceType: string = 'SECRET',
  ) {
    const prevLog = await prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const prevHash = prevLog?.hmacHash || 'genesis';
    const hashInput = `${tenantId}-${actorId}-${action}-${resourceId}-${JSON.stringify(metadata)}-${prevHash}`;
    if (!config.ENCRYPTION_MASTER_KEY) {
      throw new Error('Audit signing key is not configured');
    }
    const newHash = hashPassword(hashInput, config.ENCRYPTION_MASTER_KEY);

    return prisma.auditLog.create({
      data: {
        tenantId,
        actorId,
        actorType,
        action,
        resourceType,
        resourceId,
        metadata,
        hmacHash: newHash,
      },
    });
  }
}

export const secretService = new SecretService();
