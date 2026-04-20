import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, prisma, adminToken, tenantId, environment, secretsPath, secretActionPath, seedDatabase, cleanSecrets, teardownDatabase } from './helpers/setup';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

describe('Vulnerability: Broken Object Level Authorization (BOLA) - Tenant Isolation', () => {
  let victimSecretId: string;
  let attackerToken: string;
  let attackerTenantId: string;

  beforeAll(async () => {
    await seedDatabase();

    // 1. Setup the "Attacker" Tenant and Token
    const attackerOrg = await prisma.tenant.create({
      data: {
        name: 'Attacker Corp',
        slug: 'attacker-corp-' + Date.now(),
        settings: {},
      },
    });
    attackerTenantId = attackerOrg.id;

    // Attacker token is perfectly valid but belongs to a different tenant!
    attackerToken = jwt.sign(
      {
        sub: 'attacker-admin',
        email: 'attacker@evil.com',
        role: 'admin',
        tenantId: attackerOrg.id,
        permissions: ['read_secrets', 'manage_secrets', 'rotate_secrets', 'delete_secrets'],
      },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // Create attacker user account + membership
    const attackerEmail = `attacker-${Date.now()}@evil.com`;
    await prisma.user.create({
      data: {
        id: 'attacker-admin',
        email: attackerEmail,
        password: 'hashed-mock-password',
        recoveryCodes: [],
      }
    });
    await prisma.userTenant.create({
      data: {
        userId: 'attacker-admin',
        tenantId: attackerTenantId,
        role: 'ADMIN',
      }
    });

  });

  beforeEach(async () => {
    await cleanSecrets();
    
    // 2. Setup Victim Secret using legitimate admin token
    const res = await request(app)
      .post(secretsPath())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'victim_db_password', value: 'super-secret-123' });
    
    expect(res.status).toBe(201);
    victimSecretId = res.body.secret.id;
  });

  afterAll(async () => {
    // Cleanup attacker (correct FK order)
    await prisma.userTenant.deleteMany({ where: { tenantId: attackerTenantId } });
    await prisma.user.deleteMany({ where: { id: 'attacker-admin' } });
    await prisma.tenant.delete({ where: { id: attackerTenantId } });
    await teardownDatabase();
  });

  it('BOLA 1: Attacker should NOT be able to read Victim\'s secret using Victim\'s tenant ID in URL', async () => {
    // The attacker calls the victim's tenant ID route but uses the attacker's token
    const res = await request(app)
      .get(secretsPath(tenantId)) // URL asks for victim
      .set('Authorization', `Bearer ${attackerToken}`); // Attacker auth
    
    // We expect 403 Forbidden or 404 Not Found due to Middleware / RLS
    // If it returns 200, the app is vulnerable to BOLA!
    expect(res.status).not.toBe(200);
    expect(res.status).toBe(403);
  });

  it('BOLA 2: Attacker should NOT be able to delete Victim\'s specific secret', async () => {
    const res = await request(app)
      .delete(secretActionPath(victimSecretId, undefined, tenantId))
      .set('Authorization', `Bearer ${attackerToken}`);
    
    // If 200/204, BOLA vulnerability!
    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(204);
    
    // Verify it wasn't actually deleted from the DB
    const secretInDb = await prisma.secret.findUnique({ where: { id: victimSecretId } });
    expect(secretInDb).toBeDefined();
    expect(secretInDb?.isDeleted).toBe(false);
  });



});
