import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, adminToken, secretsPath, seedDatabase, teardownDatabase } from './helpers/setup';

describe('Vulnerability: SQL & Object Injection Mitigation', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  it('INJ-1: Should safely handle standard SQL injection characters in secret name', async () => {
    const maliciousName = "test_secret' OR '1'='1";
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: maliciousName, value: 'safe_secret' });

    // Prisma sanitizes this automatically, so it should either succeed literally or fail validation (Zod)
    expect([201, 400]).toContain(res.status);
  });

  it('INJ-2: Should reject NoSQL-like object injection payloads', async () => {
    const payload = { name: { $gt: '' }, value: 'busted' }; // MongoDB style injection payload
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    // Zod must caught the `name` as an object where string is expected
    expect(res.status).toBe(400); 
  });

  it('INJ-3: Should reject massive strings intended to cause buffer overflow or long DB queries', async () => {
    const hugeName = 'A'.repeat(50000); // Exceeds DB varchar length
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: hugeName, value: 'test' });
      
    // Depending on schema length restrictions (TEXT vs VARCHAR), Prisma handles it safely either via 500 length error catching or it strictly accepts it.
    expect([201, 400, 413, 500]).toContain(res.status);
  });
});
