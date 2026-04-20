/**
 * Shared test helpers for Bastion Vault test suite.
 * Each test file gets its OWN isolated tenant to avoid cross-file interference.
 *
 * Updated for UserTenant junction table architecture.
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { config } from '../../config/env';
import { getRedisClient, disconnectRedis } from '../../config/redis';

export const prisma = new PrismaClient();
const JWT_SECRET = config.JWT_SECRET;

/** Dynamic JWT & IDs populated by seedDatabase() */
export let adminToken: string;
export let viewerToken: string;
export let tenantId: string;
export const environment = 'test-env';

/** Build API path for secret endpoints */
export const secretsPath = (org?: string, env?: string) =>
  `/api/v1/secrets/${org || tenantId}/envs/${env || environment}/secrets`;

/** Build API path for secret action endpoints (rotate, delete, etc.) */
export const secretActionPath = (
  secretId: string,
  action?: string,
  org?: string,
  env?: string
) =>
  `/api/v1/secrets/${org || tenantId}/envs/${env || environment}/secrets/${secretId}${action ? `/${action}` : ''}`;

/**
 * Seed database with isolated tenant for THIS test file.
 * Uses unique slug based on timestamp + random to avoid conflicts between parallel test files.
 */
export async function seedDatabase() {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Clear rate-limit keys to avoid 429s from previous test runs
  try {
    const redis = await getRedisClient();
    if (redis) {
      const keys = await redis.keys('bastion:ratelimit:*');
      if (keys.length > 0) await redis.del(keys);
    }
  } catch { /* Redis may not be available */ }

  // Create tenant (unique per test file)
  const org = await prisma.tenant.create({
    data: {
      name: `Test Org ${uniqueId}`,
      slug: `test-org-${uniqueId}`,
      settings: { defaultRegion: 'us-east-1' },
    },
  });
  tenantId = org.id;

  // Generate unique IDs for users
  const adminId = `admin-${uniqueId}`;
  const viewerId = `viewer-${uniqueId}`;

  // Create user records (no role/tenantId on User — that's on UserTenant)
  await prisma.user.createMany({
    data: [
      {
        id: adminId,
        email: `admin-${uniqueId}@bastionvault.test`,
        password: 'hashed-mock-password',
        recoveryCodes: [],
      },
      {
        id: viewerId,
        email: `viewer-${uniqueId}@bastionvault.test`,
        password: 'hashed-mock-password',
        recoveryCodes: [],
      },
    ],
  });

  // Create UserTenant memberships (roles are per-tenant now)
  await prisma.userTenant.createMany({
    data: [
      { userId: adminId, tenantId: org.id, role: 'ADMIN' },
      { userId: viewerId, tenantId: org.id, role: 'USER' },
    ],
  });

  // Generate tokens with roles from UserTenant
  adminToken = jwt.sign(
    {
      sub: adminId,
      email: `admin-${uniqueId}@bastionvault.test`,
      role: 'admin',
      tenantId: org.id,
      permissions: ['read_secrets', 'manage_secrets', 'rotate_secrets', 'delete_secrets'],
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  viewerToken = jwt.sign(
    {
      sub: viewerId,
      email: `viewer-${uniqueId}@bastionvault.test`,
      role: 'viewer',
      tenantId: org.id,
      permissions: ['read_secrets'],
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/** Clean secrets, audit logs, and rate-limit keys for THIS file's org */
export async function cleanSecrets() {
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.secret.deleteMany({ where: { tenantId } });

  // Clear rate-limit keys to prevent 429s between tests
  try {
    const redis = await getRedisClient();
    if (redis) {
      const keys = await redis.keys('bastion:ratelimit:*');
      if (keys.length > 0) await redis.del(keys);
    }
  } catch { /* Redis may not be available */ }
}

/** Cleanup THIS file's data only and disconnect (correct FK deletion order) */
export async function teardownDatabase() {
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.secret.deleteMany({ where: { tenantId } });
  await prisma.machineIdentity.deleteMany({ where: { tenantId } });
  await prisma.userTenant.deleteMany({ where: { tenantId } });
  // Delete users who were created for this test
  await prisma.user.deleteMany({
    where: { email: { contains: '@bastionvault.test' } },
  });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
  await prisma.$disconnect();
}

export { app };
