import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config/env';

export const prisma = new PrismaClient();

export async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.secret.deleteMany();
  await prisma.machineIdentity.deleteMany();
  await prisma.userTenant.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

export async function createTenantWithUsers() {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenant = await prisma.tenant.create({
    data: {
      name: `Test Tenant ${unique}`,
      slug: `test-${unique}`,
      settings: { defaultRegion: 'us-east-1' },
    },
  });

  const admin = await prisma.user.create({
    data: { email: `admin-${unique}@bastionvault.test`, password: 'x', recoveryCodes: [] },
  });
  const viewer = await prisma.user.create({
    data: { email: `viewer-${unique}@bastionvault.test`, password: 'x', recoveryCodes: [] },
  });

  await prisma.userTenant.createMany({
    data: [
      { userId: admin.id, tenantId: tenant.id, role: 'ADMIN' },
      { userId: viewer.id, tenantId: tenant.id, role: 'USER' },
    ],
  });

  const adminToken = jwt.sign(
    { sub: admin.id, email: admin.email, role: 'admin', tenantId: tenant.id, permissions: ['read_secrets', 'manage_secrets', 'rotate_secrets', 'delete_secrets'] },
    config.JWT_SECRET,
    { expiresIn: '1h' },
  );

  const viewerToken = jwt.sign(
    { sub: viewer.id, email: viewer.email, role: 'viewer', tenantId: tenant.id, permissions: ['read_secrets'] },
    config.JWT_SECRET,
    { expiresIn: '1h' },
  );

  return { tenant, admin, viewer, adminToken, viewerToken };
}

