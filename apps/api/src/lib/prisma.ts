/**
 * Shared Prisma Client Singleton
 *
 * All services MUST import from here instead of creating new PrismaClient instances.
 * Prevents connection pool exhaustion in production (each instance opens its own pool).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
