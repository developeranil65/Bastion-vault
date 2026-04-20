import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, secretsPath, seedDatabase, teardownDatabase } from './helpers/setup';
import jwt from 'jsonwebtoken';

describe('Vulnerability: Auth Security', () => {
  beforeAll(async () => { await seedDatabase(); });
  afterAll(async () => { await teardownDatabase(); });

  it('AUTH-SEC-1: Token malleability (Algorithms None)', async () => {
    // Attempting an alg:none attack
    const payload = Buffer.from(JSON.stringify({ sub: 'admin', role: 'admin' })).toString('base64url');
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const forgedToken = `${header}.${payload}.`;
    
    const res = await request(app)
      .get(secretsPath())
      .set('Authorization', `Bearer ${forgedToken}`);
    expect(res.status).toBe(401);
  });

  it('AUTH-SEC-2: Brute-forced/Wrong Secret Signature', async () => {
    const token = jwt.sign({ sub: 'badmin', role: 'admin' }, 'dictionary_word_secret');
    const res = await request(app)
      .get(secretsPath())
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
