import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, prisma, adminToken, tenantId, environment, secretsPath, secretActionPath, seedDatabase, cleanSecrets, teardownDatabase } from './helpers/setup';

describe('Vulnerability: Cryptographic Validation & Data Integrity Tampering', () => {
  let victimSecretId: string;

  beforeAll(async () => {
    await seedDatabase();
  });

  beforeEach(async () => {
    await cleanSecrets();
    
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'crypto_test_pass', value: 'super-secret-123' });
    
    expect(res.status).toBe(201);
    victimSecretId = res.body.secret.id;
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  it('CRYPTO 1: Application should not crash (500) if Database EncryptedData is manually corrupted', async () => {
    // 1. Manually corrupt the database row (simulate DB intrusion / bit flip / raw SQL update)
    await prisma.secret.update({
      where: { id: victimSecretId },
      data: {
        encryptedData: 'corrupted-hex-string-not-a-valid-aes-gcm-payload'
      }
    });

    // 2. Fetch the secret via API
    const res = await request(app)
      .get(secretActionPath('crypto_test_pass', 'value'))
      .set('Authorization', `Bearer ${adminToken}`);
    
    // It should handle the decryption failure gracefully (e.g. 500 but controlled, or 422, but NOT crash node)
    // Actually, usually a KMS failure returns a 500 but it MUST be a structured JSON error, not an unhandled exception dropping the connection.
    expect(res.status).toBe(500); 
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Internal Server Error'); 
  });

  it('CRYPTO 2: Application should reject overly massive metadata payloads (DoS prevention)', async () => {
    // Generate a 5MB string
    const massivePayload = 'A'.repeat(5 * 1024 * 1024);

    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ 
        name: 'massive_payload_test', 
        value: 'test',
        metadata: { junk: massivePayload } 
      });

    // We expect the payload to be rejected by input validation (e.g. 400 Bad Request or 413 Payload Too Large)
    // BEFORE it hits the crypto engine or database
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
  
  it('CRYPTO 3: No raw cryptographic keys should ever be returned in the API response', async () => {
     const res = await request(app)
      .get(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`);
      
     expect(res.status).toBe(200);
     expect(res.body.data).toBeDefined();
     expect(res.body.data.length).toBeGreaterThan(0);
     const secret = res.body.data.find((s: any) => s.id === victimSecretId);
     expect(secret).toBeDefined();
     
     // The raw value SHOULD be returned if they requested it, but NOT the ENCRYPTED keys
     expect(secret.encryptedData).toBeUndefined();
     expect(secret.encryptedDek).toBeUndefined();
     expect(secret.iv).toBeUndefined();
     expect(secret.authTag).toBeUndefined();
     expect(secret.dekIv).toBeUndefined();
     expect(secret.dekAuthTag).toBeUndefined();
  });
});
