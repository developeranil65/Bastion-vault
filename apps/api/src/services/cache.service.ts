import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export class CacheService {
  async getJSON<T>(key: string): Promise<T | null> {
    const redis = await getRedisClient();
    if (!redis) return null;

    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      logger.warn('[Cache] Failed to read key', { key, error: error instanceof Error ? error.message : 'unknown' });
      return null;
    }
  }

  async setJSON(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;

    try {
      await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (error) {
      logger.warn('[Cache] Failed to write key', { key, error: error instanceof Error ? error.message : 'unknown' });
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;

    try {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      logger.warn('[Cache] Failed to delete prefix', { prefix, error: error instanceof Error ? error.message : 'unknown' });
    }
  }
}

export const cacheService = new CacheService();
