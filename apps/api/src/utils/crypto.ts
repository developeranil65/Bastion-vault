import crypto from 'crypto';

export function hashPassword(input: string, masterKey: string): string {
  return crypto.createHmac('sha256', Buffer.from(masterKey.padEnd(32, '0').slice(0, 32)))
               .update(input)
               .digest('hex');
}
