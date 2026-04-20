/**
 * Rate Limiting Middleware — Redis-backed Sliding Window
 *
 * Uses Redis sorted sets for a true sliding window rate limiter.
 * Falls back to in-memory express-rate-limit if Redis is unavailable.
 *
 * Key format: bastion:ratelimit:{IP}:{route}
 * TTL: windowMs (auto-expires old keys)
 */
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

const KEY_PREFIX = 'bastion:ratelimit:';

/**
 * Create a rate limiting middleware.
 *
 * @param max - Maximum requests per window
 * @param windowStr - Window duration (e.g. '60s', '300s')
 */
export const rateLimitMiddleware = (max: number, windowStr: string) => {
  const windowMs = parseInt(windowStr.replace('s', '')) * 1000;
  const windowS = isNaN(windowMs) ? 60 : windowMs / 1000;

  // In-memory fallback for when Redis is unavailable
  const fallback = rateLimit({
    windowMs: isNaN(windowMs) ? 60000 : windowMs,
    max,
    message: { error: 'Too Many Requests' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    const redis = await getRedisClient();

    if (!redis) {
      // Redis unavailable — use in-memory fallback
      return fallback(req, res, next);
    }

    try {
      const identifier = getIdentifier(req);
      const key = `${KEY_PREFIX}${identifier}`;
      const now = Date.now();
      const windowStart = now - (windowS * 1000);

      // Sliding window using Redis sorted set
      const multi = redis.multi();

      // 1. Remove entries outside the window
      multi.zRemRangeByScore(key, 0, windowStart);

      // 2. Count entries in the current window
      multi.zCard(key);

      // 3. Add the current request
      multi.zAdd(key, { score: now, value: `${now}-${Math.random().toString(36).slice(2, 8)}` });

      // 4. Set TTL on the key (auto-cleanup)
      multi.expire(key, Math.ceil(windowS));

      const results = await multi.exec();

      // results[1] = count of requests in current window (before this request)
      const currentCount = results[1] as number;

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - currentCount - 1));
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowS * 1000) / 1000));

      if (currentCount >= max) {
        // Over limit
        res.setHeader('Retry-After', windowS);
        return res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: windowS,
        });
      }

      next();
    } catch (err: any) {
      logger.warn('[RateLimit] Redis error, falling back to in-memory', { error: err.message });
      // Fall back to in-memory on any Redis error
      return fallback(req, res, next);
    }
  };
};

/**
 * Get a unique identifier for rate limiting.
 * Uses IP address by default + route path for per-endpoint limiting.
 */
function getIdentifier(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const route = req.baseUrl + req.path;
  return `${ip}:${route}`;
}

export default rateLimitMiddleware;
