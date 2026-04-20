import { describe, it, expect } from 'vitest';
import { prisma } from './helpers/setup';

describe('System: Database Connection & State', () => {
  it('DB-1: Should correctly connect to PostgreSQL', async () => {
    // Testing prisma $queryRaw
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    expect(result).toBeDefined();
    expect((result as any)[0].result).toBe(1);
  });
});
