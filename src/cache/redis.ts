import { getEnvironment } from '../config/env.js';

let redisClient: typeof import('bun').redis | null = null;
let redisAvailable = true;

/**
 * Gets the Redis client instance.
 * Uses Bun's native Redis client which reads from $REDIS_URL.
 * Returns null if Redis is not configured or unavailable.
 */
export async function getRedisClient(): Promise<typeof import('bun').redis | null> {
    if (!redisAvailable) return null;

    if (!redisClient) {
        const env = getEnvironment();
        if (!env.REDIS_URL) {
            redisAvailable = false;
            console.warn('REDIS_URL not configured - caching disabled');
            return null;
        }

        try {
            const { redis } = await import('bun');
            redisClient = redis;
        } catch (err) {
            console.error('Failed to initialize Redis client:', err);
            redisAvailable = false;
            return null;
        }
    }

    return redisClient;
}

/**
 * Checks if Redis is available and configured.
 */
export function isRedisAvailable(): boolean {
    return redisAvailable;
}

/**
 * Resets Redis availability flag (useful for testing).
 */
export function resetRedisState(): void {
    redisClient = null;
    redisAvailable = true;
}
