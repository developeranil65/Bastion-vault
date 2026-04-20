import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config/env';
import { prisma, createTenantWithUsers, resetDatabase } from '../helpers/seed';
import { requireTestEnv } from '../helpers/test-env';

describe('Security: tenant isolation (BOLA)', () => {
  beforeAll(() => requireTestEnv());

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('blocks cross-tenant access even with valid JWT', async () => {
    const victim = await createTenantWithUsers();
    const attackerTenant = await prisma.tenant.create({
      data: { name: 'Attacker', slug: `attacker-${Date.now()}`, settings: {} },
    });
    const attackerUser = await prisma.user.create({
      data: { email: `attacker-${Date.now()}@evil.test`, password: 'x', recoveryCodes: [] },
    });
    await prisma.userTenant.create({
      data: { userId: attackerUser.id, tenantId: attackerTenant.id, role: 'ADMIN' },
    });

    const attackerToken = jwt.sign(
      {
        sub: attackerUser.id,
        email: attackerUser.email,
        role: 'admin',
        tenantId: attackerTenant.id,
        permissions: ['read_secrets', 'manage_secrets', 'rotate_secrets', 'delete_secrets'],
      },
      config.JWT_SECRET,
      { expiresIn: '1h' },
    );

    // Victim creates a secret in their tenant.
    const created = await request(app)
      .post(`/api/v1/secrets/${victim.tenant.id}/envs/prod/secrets`)
      .set('Authorization', `Bearer ${victim.adminToken}`)
      .send({ name: 'VICTIM_DB_PASSWORD', value: 'super-secret-123' });

    expect(created.status).toBe(201);

    // Attacker attempts to list victim secrets by swapping tenantId in URL.
    const listRes = await request(app)
      .get(`/api/v1/secrets/${victim.tenant.id}/envs/prod/secrets`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect([401, 403]).toContain(listRes.status);
  });
});

