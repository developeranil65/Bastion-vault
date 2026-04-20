import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, adminToken, secretsPath, seedDatabase, teardownDatabase } from './helpers/setup';

describe('Vulnerability: Concurrency & Race Conditions', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  it('RACE 1: Concurrent Secret Creation should handle DB Unique Constraint safely', async () => {
    const payload = { name: 'race_condition_secret', value: 'secret' };
    const numParallelRequests = 5;

    // Fire 5 POST requests simultaneously
    const requests = Array.from({ length: numParallelRequests }).map(() =>
      request(app)
        .post(secretsPath())
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
    );

    const responses = await Promise.all(requests);

    let successCount = 0;
    let conflictCount = 0;
    let fallbackErrorCount = 0;

    responses.forEach(res => {
      if (res.status === 201) successCount++;
      else if (res.status === 409 || res.status === 400) conflictCount++; // Graceful conflict/bad request
      else fallbackErrorCount++; // Unhandled 500s or timeouts
    });

    // We expect exactly ONE to succeed based on Prisma @@unique
    expect(successCount).toBe(1);
    
    // We expect ALL others to be handled gracefully (e.g. 409 Conflict), NOT 500 internal server error
    expect(conflictCount).toBe(numParallelRequests - 1);
    expect(fallbackErrorCount).toBe(0);
  });
});
