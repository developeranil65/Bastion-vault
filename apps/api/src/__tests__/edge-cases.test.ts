import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, adminToken, secretsPath, seedDatabase, teardownDatabase } from './helpers/setup';

describe('Vulnerability & Robustness: Extreme Edge Cases', () => {
  beforeAll(async () => { await seedDatabase(); });
  afterAll(async () => { await teardownDatabase(); });

  it('EDGE-1: Extremely short and unusual secret names', async () => {
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'a', value: '1' });
    expect([201, 400]).toContain(res.status); // Depends on minimum length in Zod Schema
  });

  it('EDGE-2: Malformed JSON Bodies should be rejected as 400', async () => {
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send('{"name": "broken", "value": '); // Syntactically invalid JSON
    expect(res.status).toBe(400); 
  });
});
