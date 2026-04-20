import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from './helpers/setup';

describe('Vulnerability: Security Headers & CSRF', () => {
  it('SEC-1: API should return strict security headers powered by Helmet', async () => {
    const res = await request(app).get('/api/health'); // Public endpoint
    
    expect(res.headers).toHaveProperty('x-dns-prefetch-control');
    expect(res.headers['x-frame-options']?.toUpperCase() || '').toBe('DENY');
    expect(res.headers).toHaveProperty('strict-transport-security');
    expect(res.headers).toHaveProperty('x-download-options', 'noopen');
    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined(); // Express powered-by header MUST be hidden
  });

  it('SEC-2: CORS must be configured to deny unknown origins aggressively', async () => {
    const res = await request(app)
      .options('/api/v1/secrets/some-tenant/envs/dev/secrets')
      .set('Origin', 'http://malicious-website.com');
      
    // Should NOT reflect the malicious origin in Access-Control-Allow-Origin
    expect(res.headers['access-control-allow-origin']).not.toBe('http://malicious-website.com');
  });
});
