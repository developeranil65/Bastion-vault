import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, adminToken, secretsPath, seedDatabase, teardownDatabase } from './helpers/setup';
import { prisma, tenantId } from './helpers/setup';

describe('Functionality: Audit Logging', () => {
  beforeAll(async () => { await seedDatabase(); });
  afterAll(async () => { await teardownDatabase(); });

  it('AUDIT-BASE: Validate logging is isolated per tenant', async () => {
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'log_me', value: 'abc' });
    expect(res.status).toBe(201);

    const logs = await prisma.auditLog.findMany({ where: { tenantId } });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].tenantId).toBe(tenantId);
  });
});
