import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, viewerToken, adminToken, secretsPath, secretActionPath, seedDatabase, teardownDatabase } from './helpers/setup';

describe('Vulnerability: RBAC Cross-Role Privilege Escalation', () => {
  let adminSecretId: string;
  beforeAll(async () => {
    await seedDatabase();
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'admin_only', value: '123' });
    adminSecretId = res.body.secret?.id;
  });
  afterAll(async () => { await teardownDatabase(); });

  it('RBAC-1: Viewer cannot access DELETE endpoints (Vertical Escalation Prevention)', async () => {
    const res = await request(app)
      .delete(secretActionPath('admin_only'))
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });

  it('RBAC-2: Viewer cannot access CREATE endpoints', async () => {
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'forged_by_viewer', value: '123' });
    expect(res.status).toBe(403);
  });

  it('RBAC-3: Viewer CAN access list secrets endpoint', async () => {
    const res = await request(app)
      .get(secretsPath())
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });
});
