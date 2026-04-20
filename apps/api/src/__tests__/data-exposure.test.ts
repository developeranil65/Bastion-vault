import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, adminToken, secretsPath, secretActionPath, seedDatabase, teardownDatabase, cleanSecrets } from './helpers/setup';

describe('Vulnerability: Data Exposure & Memory Zeroing', () => {
  let victimId: string;
  beforeAll(async () => { await seedDatabase(); });
  beforeEach(async () => {
    await cleanSecrets();
    const res = await request(app).post(secretsPath()).set('Authorization', `Bearer ${adminToken}`).send({ name: 'mem_test', value: 'foo' });
    victimId = res.body.secret.id;
  });
  afterAll(async () => { await teardownDatabase(); });

  it('DE-1: Application never exposes the raw database IDs for DEK tables', async () => {
    const res = await request(app).get(secretsPath()).set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data[0]).not.toHaveProperty('encryptedDek');
  });

  it('DE-2: API error stack traces should not leak in development/production mode', async () => {
    // Intentionally pass an invalid parameter to try and break the API badly
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: { invalid: 'object_in_string_field' }, value: 'ok' });
    
    // We expect Zod to catch it and NOT leak a stack trace containing absolute paths
    expect(res.status).toBe(400);
    expect(res.text).not.toContain('C:\\');
    expect(res.text).not.toContain('/usr/src/app');
  });
});
