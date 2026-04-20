import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { prisma, createTenantWithUsers, resetDatabase } from '../helpers/seed';
import { requireTestEnv } from '../helpers/test-env';

describe('Security: rate limiting / DoS resistance', () => {
  beforeAll(() => requireTestEnv());

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rate limits secret value fetch attempts (simulated DDoS)', async () => {
    const { tenant, adminToken } = await createTenantWithUsers();

    const created = await request(app)
      .post(`/api/v1/secrets/${tenant.id}/envs/prod/secrets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'API_KEY', value: 'abc' });
    expect(created.status).toBe(201);

    // Burst requests: expect at least one 429 due to limit (60/60s)
    const burst = await Promise.all(
      Array.from({ length: 80 }).map(() =>
        request(app)
          .get(`/api/v1/secrets/${tenant.id}/envs/prod/secrets/API_KEY/value`)
          .set('Authorization', `Bearer ${adminToken}`),
      ),
    );

    expect(burst.some((r) => r.status === 429)).toBe(true);
  });
});

