import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { prisma, createTenantWithUsers, resetDatabase } from '../helpers/seed';
import { requireTestEnv } from '../helpers/test-env';

describe('Security: input hardening', () => {
  beforeAll(() => requireTestEnv());

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects secret names with injection characters', async () => {
    const { tenant, adminToken } = await createTenantWithUsers();
    const res = await request(app)
      .post(`/api/v1/secrets/${tenant.id}/envs/prod/secrets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: "test' OR '1'='1", value: 'x' });

    expect(res.status).toBe(400);
  });

  it('rejects oversized secret values', async () => {
    const { tenant, adminToken } = await createTenantWithUsers();
    const huge = 'a'.repeat(20000);
    const res = await request(app)
      .post(`/api/v1/secrets/${tenant.id}/envs/prod/secrets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'HUGE', value: huge });

    expect(res.status).toBe(400);
  });

  it('rejects too-large JSON bodies (413)', async () => {
    const { tenant, adminToken } = await createTenantWithUsers();
    const bigMetadata: Record<string, string> = {};
    for (let i = 0; i < 10000; i++) bigMetadata[`k${i}`] = 'x'.repeat(50);

    const res = await request(app)
      .post(`/api/v1/secrets/${tenant.id}/envs/prod/secrets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'META', value: 'x', metadata: bigMetadata });

    expect([400, 413]).toContain(res.status);
  });
});

