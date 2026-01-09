import { getRedisClient } from './redis.js';
import { getEnvironment } from '../config/env.js';
import type { Offer, CalculateEVRequest, CalculateEVResponse } from '../types/index.js';

// ============================================
// Cache Key Constants
// ============================================

const API_CACHE_PREFIX = 'oddsshopper:offers:';
const API_HASH_PREFIX = 'oddsshopper:hash:';
const EV_CACHE_PREFIX = 'ev:calc:';

// ============================================
// Layer 1: OddsShopper API Response Cache
// ============================================

/**
 * Gets cached offer data for a given offerId.
 */
export async function getCachedOfferData(offerId: string): Promise<Offer[] | null> {
    const client = await getRedisClient();
    if (!client) return null;

    try {
        const cached = await client.get(`${API_CACHE_PREFIX}${offerId}`);
        if (cached) {
            return JSON.parse(cached) as Offer[];
        }
    } catch (err) {
        console.error('Redis get error (offer):', err);
    }
    return null;
}

/**
 * Stores offer data in cache with invalidation check.
 * If the data has changed, invalidates all dependent EV cache entries.
 */
export async function setCachedOfferData(offerId: string, data: Offer[]): Promise<void> {
    const client = await getRedisClient();
    if (!client) return;

    try {
        const env = getEnvironment();
        const ttl = env.REDIS_API_CACHE_TTL;

        const newHash = generateOfferHash(data);
        const oldHash = await client.get(`${API_HASH_PREFIX}${offerId}`);

        // If hash changed, invalidate all EV results for this offer
        if (oldHash && oldHash !== newHash) {
            await invalidateEVCacheForOffer(offerId);
        }

        // Store new data and hash
        await client.set(`${API_CACHE_PREFIX}${offerId}`, JSON.stringify(data));
        await client.expire(`${API_CACHE_PREFIX}${offerId}`, ttl);
        await client.set(`${API_HASH_PREFIX}${offerId}`, newHash);
        await client.expire(`${API_HASH_PREFIX}${offerId}`, ttl);
    } catch (err) {
        console.error('Redis set error (offer):', err);
    }
}

// ============================================
// Layer 2: EV Calculation Result Cache
// ============================================

/**
 * Generates a deterministic cache key from EV calculation parameters.
 * Key format: ev:calc:{offerId}:{playerId}:{line}:{side}:{targetBook}:{sharps_sorted}:{devigMethod}
 */
export function generateEVCacheKey(req: CalculateEVRequest): string {
    const sortedSharps = [...req.sharps].sort().join(',');
    const keyParts = [
        req.offerId,
        req.playerId,
        req.line.toString(),
        req.side,
        req.targetBook,
        sortedSharps,
        req.devigMethod
    ];
    return `${EV_CACHE_PREFIX}${keyParts.join(':')}`;
}

/**
 * Gets cached EV result for a given request.
 */
export async function getCachedEVResult(req: CalculateEVRequest): Promise<CalculateEVResponse | null> {
    const client = await getRedisClient();
    if (!client) return null;

    try {
        const key = generateEVCacheKey(req);
        const cached = await client.get(key);
        if (cached) {
            return JSON.parse(cached) as CalculateEVResponse;
        }
    } catch (err) {
        console.error('Redis get error (EV):', err);
    }
    return null;
}

/**
 * Stores EV calculation result in cache.
 */
export async function setCachedEVResult(req: CalculateEVRequest, result: CalculateEVResponse): Promise<void> {
    const client = await getRedisClient();
    if (!client) return;

    try {
        const env = getEnvironment();
        const key = generateEVCacheKey(req);
        await client.set(key, JSON.stringify(result));
        await client.expire(key, env.REDIS_EV_CACHE_TTL);
    } catch (err) {
        console.error('Redis set error (EV):', err);
    }
}

// ============================================
// Invalidation Logic
// ============================================

/**
 * Generates a hash of offer data for change detection.
 * Uses a simple hash of the stringified data.
 */
export function generateOfferHash(data: Offer[]): string {
    const str = JSON.stringify(data);
    return Bun.hash(str).toString(16);
}

/**
 * Invalidates all EV cache entries for a given offerId.
 * Uses Redis SCAN to find and delete matching keys.
 */
export async function invalidateEVCacheForOffer(offerId: string): Promise<number> {
    const client = await getRedisClient();
    if (!client) return 0;

    const pattern = `${EV_CACHE_PREFIX}${offerId}:*`;
    let deletedCount = 0;

    try {
        // Use SCAN to find all matching keys
        // Bun's redis scan returns [cursor, keys] tuple
        let cursor: string | number = 0;
        do {
            const result = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            // Result is [nextCursor, keys[]]
            const [nextCursor, keys] = result as [string, string[]];
            cursor = nextCursor;

            if (keys && keys.length > 0) {
                // Delete each key individually
                for (const key of keys) {
                    await client.del(key);
                    deletedCount++;
                }
            }
        } while (String(cursor) !== '0');

        if (deletedCount > 0) {
            console.log(`Invalidated ${deletedCount} EV cache entries for offer ${offerId}`);
        }
    } catch (err) {
        console.error('Redis invalidation error:', err);
    }

    return deletedCount;
}
