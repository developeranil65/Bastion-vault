import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, adminToken, secretsPath, secretActionPath, seedDatabase, teardownDatabase } from './helpers/setup';

describe('Application Functionality: Secrets CRUD', () => {
  let secretId: string;
  beforeAll(async () => { await seedDatabase(); });
  afterAll(async () => { await teardownDatabase(); });

  it('CRUD-1: Should create a secret successfully', async () => {
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'crud_test', value: 'my_secret_val' });
    expect(res.status).toBe(201);
    expect(res.body.secret.id).toBeDefined();
    secretId = res.body.secret.id;
  });

  it('CRUD-2: Should list secrets without returning plaintext', async () => {
    const res = await request(app)
      .get(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].value).toBeUndefined(); // Crucial!
  });

  it('CRUD-3: Should rotate a secret successfully', async () => {
    const res = await request(app)
      .put(secretActionPath('crud_test', 'rotate'))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newValue: 'new_secret_val' });
    expect(res.status).toBe(200);
  });

  it('CRUD-4: Should delete a secret successfully', async () => {
    const res = await request(app)
      .delete(secretActionPath('crud_test'))
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
