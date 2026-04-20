import { config } from '../../src/config/env';

export function requireTestEnv() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for tests');
  }
  if (!process.env.REDIS_URL) {
    // Redis is optional in the app (falls back), but security tests should run with it.
    throw new Error('REDIS_URL is required for tests');
  }
  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured for tests');
  }
}

