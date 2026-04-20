import dotenv from 'dotenv';
dotenv.config();

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  // App Settings
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: readNumber(process.env.PORT, 3000),
  APP_NAME: 'Bastion Vault',
  IS_PRODUCTION: (process.env.NODE_ENV || 'development') === 'production',
  TRUST_PROXY: process.env.TRUST_PROXY || 'loopback',
  
  // Database (PostgreSQL)
  DATABASE_URL: 
    process.env.DATABASE_URL || 
    'postgresql://keyvaultx_user:password@localhost:5432/keyvaultx',
  
  // Database Pool
  DATABASE_POOL: {
    max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
    min: parseInt(process.env.DATABASE_POOL_MIN || '0'),
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),
    retryAttempts: parseInt(process.env.DATABASE_RETRY_ATTEMPTS || '5'),
    retryDelayMillis: parseInt(process.env.DATABASE_RETRY_DELAY || '3000'),
  },

  // TimescaleDB Audit Logs
  AUDIT_LOG_TABLE: 'audit_logs',

  // Redis Cache (Rate Limiting)
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  REDIS_DB: parseInt(process.env.REDIS_DB || '0'),
  
  // Security & Auth
  JWT_SECRET: process.env.JWT_SECRET || (((process.env.NODE_ENV || 'development') === 'production') ? '' : 'dev-jwt-secret-change-me'),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || (((process.env.NODE_ENV || 'development') === 'production') ? '' : 'dev-refresh-secret-change-me'),
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
  
  // Encryption (Envelope Encryption Keys)
  ENCRYPTION_MASTER_KEY:
    process.env.ENCRYPTION_MASTER_KEY ||
    (((process.env.NODE_ENV || 'development') === 'production')
      ? ''
      : '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  
  // Org/Tenant Context
  DEFAULT_ORG_SLUG: process.env.DEFAULT_ORG_SLUG || 'default',
};

// Backward compat
export const env = config;

export function assertRuntimeConfig(): void {
  const missing: string[] = [];

  if (!config.DATABASE_URL) missing.push('DATABASE_URL');

  if (config.IS_PRODUCTION) {
    if (!config.JWT_SECRET) missing.push('JWT_SECRET');
    if (!config.JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');
    if (!config.ENCRYPTION_MASTER_KEY) missing.push('ENCRYPTION_MASTER_KEY');
  }

  if (config.ENCRYPTION_MASTER_KEY && !/^[a-fA-F0-9]{64}$/.test(config.ENCRYPTION_MASTER_KEY)) {
    throw new Error('ENCRYPTION_MASTER_KEY must be 64 hex characters');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
