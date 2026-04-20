import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, adminToken, secretsPath, seedDatabase, teardownDatabase } from './helpers/setup';
import { prisma } from './helpers/setup';

describe('Vulnerability & Compliance: Audit Log Integrity', () => {
  beforeAll(async () => { await seedDatabase(); });
  afterAll(async () => { await teardownDatabase(); });

  it('AUDIT-1: Creating a secret should automatically write an immutable audit log', async () => {
    // 1. Create secret
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'audit_me', value: '123' });
    expect(res.status).toBe(201);

    // 2. Direct DB check ensures service layer didn't drop the ball
    const logs = await prisma.auditLog.findMany({
      where: { action: 'CREATE', resourceId: 'audit_me' }
    });

    // We expect exactly 1 log!
    expect(logs.length).toBe(1);
    expect(logs[0].actorType).toBe('USER');
    
    // Most importantly, the raw value MUST NOT be in metadata
    const metadataStr = JSON.stringify(logs[0].metadata);
    expect(metadataStr).not.toContain('123'); // Doesn't leak value!
  });
});
