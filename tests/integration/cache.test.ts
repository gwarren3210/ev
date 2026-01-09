import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { redis } from 'bun';
import type { Offer, CalculateEVRequest, CalculateEVResponse } from '../../src/types/index';

/**
 * Integration tests for Redis cache operations.
 * Tests real Redis connection and cache operations.
 *
 * Requirements:
 * - Redis must be running on localhost:6379 (or REDIS_URL env var)
 */

// Test data
const mockOffer: Offer = {
    eventName: "Cache Test Event",
    tournamentName: "NBA",
    offerName: "Player Points",
    startDate: new Date().toISOString(),
    dateString: "Today",
    hold: 0.045,
    sportsbooks: ["PINNACLE", "DRAFTKINGS"],
    participants: [{
        id: "cache-test-player",
        name: "Cache Test Player",
        title: "Cache Test Player",
        isHome: true,
        participantLogo: "",
        participantType: "player"
    }],
    sides: [
        {
            label: "Over",
            outcomes: [
                {
                    id: "cache-out-1",
                    displayLabel: "Over 15.5",
                    americanOdds: "-110",
                    bestHoldOutcome: false,
                    odds: 1.909,
                    line: "15.5",
                    label: "Over",
                    sportsbookCode: "PINNACLE",
                    sportsbookLogo: "",
                    participantLogo: "",
                    participantType: "",
                    title: "Over 15.5",
                    hashCodeBetSideWithLine: "cache-hash1",
                    hashCode: "cache-h1"
                }
            ]
        },
        {
            label: "Under",
            outcomes: [
                {
                    id: "cache-out-2",
                    displayLabel: "Under 15.5",
                    americanOdds: "-110",
                    bestHoldOutcome: false,
                    odds: 1.909,
                    line: "15.5",
                    label: "Under",
                    sportsbookCode: "PINNACLE",
                    sportsbookLogo: "",
                    participantLogo: "",
                    participantType: "",
                    title: "Under 15.5",
                    hashCodeBetSideWithLine: "cache-hash2",
                    hashCode: "cache-h2"
                }
            ]
        }
    ]
};

const mockRequest: CalculateEVRequest = {
    offerId: "cache-test-offer",
    playerId: "cache-test-player",
    line: 15.5,
    side: "Over",
    targetBook: "DRAFTKINGS",
    sharps: ["PINNACLE"],
    devigMethod: "multiplicative"
};

const mockResponse: CalculateEVResponse = {
    player: "Cache Test Player",
    market: "Player Points",
    line: 15.5,
    side: "Over",
    targetBook: "DRAFTKINGS",
    targetOdds: -110,
    trueProbability: 0.52,
    impliedProbability: 0.5238,
    expectedValue: 2.5,
    sharpsUsed: ["PINNACLE"],
    bestAvailableOdds: {
        sportsbookCode: "PINNACLE",
        americanOdds: -110
    }
};

// Key prefixes used in tests
const TEST_PREFIX = 'cache-test';

describe('Redis Cache Integration Tests', () => {
    beforeAll(async () => {
        // Set up environment
        process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
        process.env.ODDSSHOPPER_API_URL = 'https://api.test.com';
        process.env.REDIS_API_CACHE_TTL = '60';
        process.env.REDIS_EV_CACHE_TTL = '300';
    });

    beforeEach(async () => {
        // Clean up test keys before each test
        const keys = await redis.keys(`*${TEST_PREFIX}*`);
        for (const key of keys) {
            await redis.del(key);
        }
    });

    afterAll(async () => {
        // Final cleanup
        const keys = await redis.keys(`*${TEST_PREFIX}*`);
        for (const key of keys) {
            await redis.del(key);
        }
    });

    describe('Direct Redis Operations', () => {
        test('can connect to Redis and perform basic operations', async () => {
            const testKey = `${TEST_PREFIX}:basic-test`;

            // Set
            await redis.set(testKey, 'test-value');

            // Get
            const value = await redis.get(testKey);
            expect(value).toBe('test-value');

            // Delete
            await redis.del(testKey);
            const deleted = await redis.get(testKey);
            expect(deleted).toBeNull();
        });

        test('can set and retrieve JSON data', async () => {
            const testKey = `${TEST_PREFIX}:json-test`;

            await redis.set(testKey, JSON.stringify(mockOffer));
            const retrieved = await redis.get(testKey);

            expect(retrieved).not.toBeNull();
            const parsed = JSON.parse(retrieved as string) as Offer;
            expect(parsed.eventName).toBe("Cache Test Event");
            expect(parsed.participants[0]!.name).toBe("Cache Test Player");

            await redis.del(testKey);
        });

        test('can set TTL on keys', async () => {
            const testKey = `${TEST_PREFIX}:ttl-test`;

            await redis.set(testKey, 'temp-value');
            await redis.expire(testKey, 60);

            const ttl = await redis.ttl(testKey);
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(60);

            await redis.del(testKey);
        });

        test('can use SCAN to find keys by pattern', async () => {
            // Create some test keys
            await redis.set(`${TEST_PREFIX}:scan:key1`, 'value1');
            await redis.set(`${TEST_PREFIX}:scan:key2`, 'value2');
            await redis.set(`${TEST_PREFIX}:scan:key3`, 'value3');

            // Scan for keys
            const foundKeys: string[] = [];
            let cursor: string | number = 0;

            do {
                const result = await redis.scan(cursor, 'MATCH', `${TEST_PREFIX}:scan:*`, 'COUNT', 100);
                const [nextCursor, keys] = result as [string, string[]];
                cursor = nextCursor;
                foundKeys.push(...keys);
            } while (String(cursor) !== '0');

            expect(foundKeys).toContain(`${TEST_PREFIX}:scan:key1`);
            expect(foundKeys).toContain(`${TEST_PREFIX}:scan:key2`);
            expect(foundKeys).toContain(`${TEST_PREFIX}:scan:key3`);

            // Cleanup
            for (const key of foundKeys) {
                await redis.del(key);
            }
        });
    });

    describe('Offer Cache Operations', () => {
        test('caches offer data with correct key format', async () => {
            const offerId = `${TEST_PREFIX}-offer`;
            const playerId = 'cache-test-player';
            const cacheKey = `oddsshopper:offers:${offerId}:${playerId}`;

            await redis.set(cacheKey, JSON.stringify(mockOffer));

            const cached = await redis.get(cacheKey);
            expect(cached).not.toBeNull();

            const parsed = JSON.parse(cached as string) as Offer;
            expect(parsed.participants[0]!.id).toBe('cache-test-player');

            await redis.del(cacheKey);
        });

        test('stores offer hash for invalidation detection', async () => {
            const offerId = `${TEST_PREFIX}-offer`;
            const playerId = 'cache-test-player';
            const hashKey = `oddsshopper:hash:${offerId}:${playerId}`;

            const hash = Bun.hash(JSON.stringify(mockOffer)).toString(16);
            await redis.set(hashKey, hash);

            const storedHash = await redis.get(hashKey);
            expect(storedHash).toBe(hash);

            await redis.del(hashKey);
        });

        test('detects hash change for cache invalidation', async () => {
            const offerId = `${TEST_PREFIX}-offer`;
            const playerId = 'cache-test-player';
            const hashKey = `oddsshopper:hash:${offerId}:${playerId}`;

            // Store original hash
            const originalHash = Bun.hash(JSON.stringify(mockOffer)).toString(16);
            await redis.set(hashKey, originalHash);

            // Modify offer and compute new hash
            const modifiedOffer = { ...mockOffer, eventName: "Modified Event" };
            const newHash = Bun.hash(JSON.stringify(modifiedOffer)).toString(16);

            // Verify hashes are different
            expect(originalHash).not.toBe(newHash);

            const storedHash = await redis.get(hashKey);
            expect(storedHash).toBe(originalHash);
            expect(storedHash).not.toBe(newHash);

            await redis.del(hashKey);
        });
    });

    describe('EV Cache Operations', () => {
        test('caches EV result with correct key format', async () => {
            const sortedSharps = [...mockRequest.sharps].sort().join(',');
            const cacheKey = `ev:calc:${mockRequest.offerId}:${mockRequest.playerId}:${mockRequest.line}:${mockRequest.side}:${mockRequest.targetBook}:${sortedSharps}:${mockRequest.devigMethod}`;

            await redis.set(cacheKey, JSON.stringify(mockResponse));

            const cached = await redis.get(cacheKey);
            expect(cached).not.toBeNull();

            const parsed = JSON.parse(cached as string) as CalculateEVResponse;
            expect(parsed.expectedValue).toBe(2.5);
            expect(parsed.player).toBe("Cache Test Player");

            await redis.del(cacheKey);
        });

        test('EV cache key sorts sharps for consistency', async () => {
            const sharps1 = ['BETMGM', 'PINNACLE', 'FANDUEL'];
            const sharps2 = ['PINNACLE', 'FANDUEL', 'BETMGM'];

            const sorted1 = [...sharps1].sort().join(',');
            const sorted2 = [...sharps2].sort().join(',');

            expect(sorted1).toBe(sorted2);
            expect(sorted1).toBe('BETMGM,FANDUEL,PINNACLE');
        });

        test('different parameters produce different cache keys', async () => {
            const key1Parts = [
                mockRequest.offerId,
                mockRequest.playerId,
                '15.5',
                'Over',
                'DRAFTKINGS',
                'PINNACLE',
                'multiplicative'
            ];

            const key2Parts = [
                mockRequest.offerId,
                mockRequest.playerId,
                '20.5', // Different line
                'Over',
                'DRAFTKINGS',
                'PINNACLE',
                'multiplicative'
            ];

            const key1 = `ev:calc:${key1Parts.join(':')}`;
            const key2 = `ev:calc:${key2Parts.join(':')}`;

            expect(key1).not.toBe(key2);
        });
    });

    describe('Cache Invalidation', () => {
        test('can delete EV cache entries by pattern', async () => {
            const offerId = `${TEST_PREFIX}-invalidate`;
            const playerId = 'cache-test-player';

            // Create multiple EV cache entries
            const keys = [
                `ev:calc:${offerId}:${playerId}:15.5:Over:DRAFTKINGS:PINNACLE:multiplicative`,
                `ev:calc:${offerId}:${playerId}:15.5:Under:DRAFTKINGS:PINNACLE:multiplicative`,
                `ev:calc:${offerId}:${playerId}:20.5:Over:DRAFTKINGS:PINNACLE:additive`
            ];

            for (const key of keys) {
                await redis.set(key, JSON.stringify(mockResponse));
            }

            // Verify all keys exist
            for (const key of keys) {
                const exists = await redis.get(key);
                expect(exists).not.toBeNull();
            }

            // Delete using SCAN
            const pattern = `ev:calc:${offerId}:${playerId}:*`;
            let cursor: string | number = 0;
            let deletedCount = 0;

            do {
                const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                const [nextCursor, foundKeys] = result as [string, string[]];
                cursor = nextCursor;

                for (const key of foundKeys) {
                    await redis.del(key);
                    deletedCount++;
                }
            } while (String(cursor) !== '0');

            expect(deletedCount).toBe(3);

            // Verify all keys are gone
            for (const key of keys) {
                const exists = await redis.get(key);
                expect(exists).toBeNull();
            }
        });
    });

    describe('TTL Configuration', () => {
        test('offer cache uses configured TTL', async () => {
            const ttl = parseInt(process.env.REDIS_API_CACHE_TTL || '60');
            const testKey = `${TEST_PREFIX}:ttl-offer`;

            await redis.set(testKey, 'test');
            await redis.expire(testKey, ttl);

            const actualTTL = await redis.ttl(testKey);
            expect(actualTTL).toBeGreaterThan(ttl - 5);
            expect(actualTTL).toBeLessThanOrEqual(ttl);

            await redis.del(testKey);
        });

        test('EV cache uses configured TTL', async () => {
            const ttl = parseInt(process.env.REDIS_EV_CACHE_TTL || '300');
            const testKey = `${TEST_PREFIX}:ttl-ev`;

            await redis.set(testKey, 'test');
            await redis.expire(testKey, ttl);

            const actualTTL = await redis.ttl(testKey);
            expect(actualTTL).toBeGreaterThan(ttl - 5);
            expect(actualTTL).toBeLessThanOrEqual(ttl);

            await redis.del(testKey);
        });
    });

    describe('Error Handling', () => {
        test('handles non-existent keys gracefully', async () => {
            const value = await redis.get('non-existent-key-12345');
            expect(value).toBeNull();
        });

        test('handles invalid JSON in cache gracefully', async () => {
            const testKey = `${TEST_PREFIX}:invalid-json`;
            await redis.set(testKey, 'not-valid-json{');

            const value = await redis.get(testKey);
            expect(value).toBe('not-valid-json{');

            // Parsing should throw
            expect(() => JSON.parse(value as string)).toThrow();

            await redis.del(testKey);
        });
    });

    describe('Batch Cache Operations', () => {
        test('caches multiple offers efficiently', async () => {
            const offerId = `${TEST_PREFIX}-batch`;
            const players = ['player1', 'player2', 'player3'];

            // Cache multiple offers
            for (const playerId of players) {
                const offer = {
                    ...mockOffer,
                    participants: [{
                        ...mockOffer.participants[0]!,
                        id: playerId,
                        name: `Player ${playerId}`
                    }]
                };
                const key = `oddsshopper:offers:${offerId}:${playerId}`;
                await redis.set(key, JSON.stringify(offer));
            }

            // Verify all cached
            for (const playerId of players) {
                const key = `oddsshopper:offers:${offerId}:${playerId}`;
                const cached = await redis.get(key);
                expect(cached).not.toBeNull();

                const parsed = JSON.parse(cached as string) as Offer;
                expect(parsed.participants[0]!.id).toBe(playerId);

                await redis.del(key);
            }
        });
    });
});
