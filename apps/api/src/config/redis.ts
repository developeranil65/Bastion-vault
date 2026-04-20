/**
 * Redis Client — Singleton connection with circuit breaker
 *
 * Provides a shared Redis client for rate limiting and caching.
 * Implements a circuit breaker pattern: if Redis is down, the client
 * gracefully degrades instead of crashing the API.
 */
import { createClient, RedisClientType } from 'redis';
import { config } from '../config/env';

let client: RedisClientType | null = null;
let isConnected = false;
let circuitOpen = false;
let failureCount = 0;
let lastFailureTime = 0;

const MAX_FAILURES = 5;
const CIRCUIT_RESET_MS = 30_000; // 30s before retrying after circuit opens

/**
 * Get or create the Redis client singleton.
 * Returns null if circuit breaker is open (Redis is down).
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  // Circuit breaker: if too many failures, don't even try
  if (circuitOpen) {
    const elapsed = Date.now() - lastFailureTime;
    if (elapsed < CIRCUIT_RESET_MS) {
      return null; // circuit still open
    }
    // Half-open: try to reconnect
    circuitOpen = false;
    failureCount = 0;
  }

  if (client && isConnected) {
    return client;
  }

  try {
    client = createClient({
      url: config.REDIS_URL,
      socket: {
        connectTimeout: 3000, // 3s connection timeout
        reconnectStrategy: (retries: number) => {
          if (retries > 3) return false; // stop reconnecting after 3 attempts
          return Math.min(retries * 500, 2000); // exponential backoff
        },
      },
    });

    client.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
      handleFailure();
    });

    client.on('connect', () => {
      isConnected = true;
      failureCount = 0;
      circuitOpen = false;
    });

    client.on('end', () => {
      isConnected = false;
    });

    await client.connect();
    isConnected = true;
    return client;
  } catch (err: any) {
    console.error('[Redis] Failed to connect:', err.message);
    handleFailure();
    return null;
  }
}

function handleFailure() {
  failureCount++;
  lastFailureTime = Date.now();
  isConnected = false;

  if (failureCount >= MAX_FAILURES) {
    circuitOpen = true;
    console.warn(`[Redis] Circuit breaker OPEN after ${MAX_FAILURES} failures. Will retry in ${CIRCUIT_RESET_MS / 1000}s.`);
  }
}

/**
 * Disconnect the Redis client (for graceful shutdown / tests)
 */
export async function disconnectRedis(): Promise<void> {
  if (client && isConnected) {
    try {
      await client.quit();
    } catch {
      // ignore quit errors during shutdown
    }
  }
  client = null;
  isConnected = false;
  circuitOpen = false;
  failureCount = 0;
}

/**
 * Check if Redis is currently connected
 */
export function isRedisConnected(): boolean {
  return isConnected && !circuitOpen;
}

/**
 * Get circuit breaker state (for monitoring / tests)
 */
export function getCircuitState() {
  return {
    isConnected,
    circuitOpen,
    failureCount,
    lastFailureTime,
  };
}

/**
 * Reset circuit breaker state (for tests only)
 */
export function resetCircuitBreaker() {
  circuitOpen = false;
  failureCount = 0;
  lastFailureTime = 0;
}
