import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, adminToken, secretsPath, seedDatabase, teardownDatabase, tenantId } from './helpers/setup';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

describe('Vulnerability: Authentication bypass & Privilege Escalation', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  it('AUTH 1: Reject requests without Authorization header', async () => {
    const res = await request(app).get(secretsPath());
    expect(res.status).toBe(401);
  });

  it('AUTH 2: Reject invalid JWT signatures', async () => {
    const forgedToken = jwt.sign(
      { sub: 'attacker', role: 'admin' },
      'wrong_secret_key'
    );
    const res = await request(app)
      .get(secretsPath())
      .set('Authorization', `Bearer ${forgedToken}`);
    expect(res.status).toBe(401);
  });

  it('AUTH 3: Reject expired JWTs', async () => {
    const expiredToken = jwt.sign(
      { sub: 'attacker', role: 'admin', tenantId },
      config.JWT_SECRET,
      { expiresIn: '-1h' } // Expired 1 hour ago
    );
    const res = await request(app)
      .get(secretsPath())
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('AUTH 4: Validate role-based access control (Viewer Cannot Create)', async () => {
    // Generate viewer token with limited permissions
    const viewerToken = jwt.sign(
      {
        sub: 'viewer-user',
        email: 'viewer@bastionvault.test',
        role: 'viewer',
        tenantId,
        permissions: ['read_secrets'],
      },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'viewer_created', value: '123' });
      
    // Expect 403 Forbidden because a viewer cannot create secrets
    expect(res.status).toBe(403);
  });
});
