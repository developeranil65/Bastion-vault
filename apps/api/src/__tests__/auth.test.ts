import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, adminToken, secretsPath, seedDatabase, teardownDatabase } from './helpers/setup';

describe('Functionality: Authentication flows', () => {
  beforeAll(async () => { await seedDatabase(); });
  afterAll(async () => { await teardownDatabase(); });

  it('AUTH-BASIC-1: Valid JWT should allow route access', async () => {
    const res = await request(app)
      .get(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
