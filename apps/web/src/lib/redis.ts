import { Redis } from "@upstash/redis";

let redisInstance: Redis | null = null;
let redisInitialized = false;

export function getRedisClient(): Redis | null {
  if (redisInitialized) return redisInstance;

  try {
    const hasEnv =
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

    if (hasEnv) {
      redisInstance = Redis.fromEnv();
    } else {
      redisInstance = null;
    }
  } catch {
    redisInstance = null;
  }

  redisInitialized = true;
  return redisInstance;
}

export { CacheKeys } from "@stoneway/shared";

/**
 * Safe Cache Get: Returns null on cache miss OR when Redis is unconfigured/down.
 * Authority remains strictly in Neon PostgreSQL.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const val = await redis.get<T>(key);
    return val ?? null;
  } catch {
    // Fail open to database read
    return null;
  }
}

/**
 * Safe Cache Set: Explicit TTL in seconds, silent fail on Redis unavailability.
 */
export async function cacheSet(key: string, value: any, ttlSeconds: number = 120): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Graceful degradation
  }
}

/**
 * Safe Cache Invalidation
 */
export async function cacheDel(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch {
    // Graceful degradation
  }
}

/**
 * Rate Limiting Helper (Token bucket / window count)
 * Returns { allowed: true } if Redis is not configured, ensuring availability.
 */
export async function checkRateLimit(
  key: string,
  limit: number = 60,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
  const redis = getRedisClient();
  if (!redis) {
    return { allowed: true, remaining: limit, resetSeconds: 0 };
  }

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);
    const reset = ttl > 0 ? ttl : windowSeconds;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: reset,
    };
  } catch {
    // Fail open
    return { allowed: true, remaining: limit, resetSeconds: 0 };
  }
}
