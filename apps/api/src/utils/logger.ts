/**
 * Structured Application Logger
 *
 * Automatically redacts sensitive fields from log output.
 * NEVER logs: secret values, tokens, passwords, encryption keys.
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.info('Secret created', { secretId, tenantId });
 *   logger.error('Decryption failed', { code: err.code });
 */

const REDACTED_FIELDS = new Set([
  'value',
  'secret',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'passportToken',
  'encryptedData',
  'encryptedDek',
  'dekIv',
  'dekAuthTag',
  'authTag',
  'iv',
  'kek',
  'dek',
  'masterKey',
  'otp',
]);

function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (REDACTED_FIELDS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitize(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

function formatMessage(level: string, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const sanitizedMeta = meta ? sanitize(meta) : undefined;
  const metaStr = sanitizedMeta ? ` ${JSON.stringify(sanitizedMeta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

export const logger = {
  info(message: string, meta?: any): void {
    console.log(formatMessage('INFO', message, meta));
  },

  warn(message: string, meta?: any): void {
    console.warn(formatMessage('WARN', message, meta));
  },

  error(message: string, meta?: any): void {
    console.error(formatMessage('ERROR', message, meta));
  },

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('DEBUG', message, meta));
    }
  },

  /**
   * Log an audit-grade event. These are always logged regardless of level.
   */
  audit(message: string, meta?: any): void {
    console.log(formatMessage('AUDIT', message, meta));
  },
};
