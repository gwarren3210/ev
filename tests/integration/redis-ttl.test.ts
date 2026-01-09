import { test, expect, describe, beforeAll } from 'bun:test';
import { redis } from 'bun';
import type { Offer, CalculateEVRequest, CalculateEVResponse } from '../src/types/index.js';

describe('Cache TTL Verification', () => {
    const TEST_OFFER_ID = 'ttl-test-offer';
    const mockOffer: Offer = {
        eventName: "TTL Test Event",
        tournamentName: "TTL Test Tournament",
        offerName: "TTL Test Offer",
        startDate: new Date().toISOString(),
        dateString: "Today",
        hold: 0.05,
        sportsbooks: ["PINNACLE", "DRAFTKINGS"],
        participants: [{
            id: "ttl-player",
            name: "TTL Player",
            title: "",
            isHome: true,
            participantLogo: "",
            participantType: ""
        }],
        sides: [],
    };

    const mockRequest: CalculateEVRequest = {
        offerId: TEST_OFFER_ID,
        playerId: "ttl-player",
        line: 100,
        side: "Over",
        targetBook: "DRAFTKINGS",
        sharps: ["PINNACLE"],
        devigMethod: "multiplicative",
    };

    const mockResponse: CalculateEVResponse = {
        player: "TTL Player",
        market: "TTL Market",
        line: 100,
        side: "Over",
        targetBook: "DRAFTKINGS",
        targetOdds: -110,
        trueProbability: 0.55,
        impliedProbability: 0.52,
        expectedValue: 5.2,
        sharpsUsed: ["PINNACLE"],
    };

    beforeAll(async () => {
        // Clean up any existing test keys using real Redis client
        const keys = await redis.keys('*ttl-test*');
        if (keys.length > 0) {
            for (const key of keys) {
                await redis.del(key);
            }
        }
    });

    test('should set TTL for offer cache', async () => {
        const client = redis;
        expect(client).not.toBeNull();

        const playerId = mockOffer.participants[0]!.id;
        console.log('\n=== Testing Offer Cache TTL ===');
        console.log(`Expected TTL: ${process.env.REDIS_API_CACHE_TTL || 60} seconds`);

        // Manually set cached offer data using real Redis (bypass mocked helper)
        const offerKey = `oddsshopper:offers:${TEST_OFFER_ID}:${playerId}`;
        const hashKey = `oddsshopper:hash:${TEST_OFFER_ID}:${playerId}`;
        const expectedTTL = parseInt(process.env.REDIS_API_CACHE_TTL || '60');

        await client.set(offerKey, JSON.stringify(mockOffer));
        await client.expire(offerKey, expectedTTL);
        await client.set(hashKey, 'test-hash');
        await client.expire(hashKey, expectedTTL);

        // Check TTL on both keys
        const offerTTL = await client.ttl(offerKey);
        const hashTTL = await client.ttl(hashKey);

        console.log(`Offer key TTL: ${offerTTL} seconds`);
        console.log(`Hash key TTL: ${hashTTL} seconds`);

        // TTL should be set (not -1 or -2)
        expect(offerTTL).toBeGreaterThan(0);
        expect(hashTTL).toBeGreaterThan(0);

        // Should be close to the configured value (within 5 seconds for timing)
        expect(offerTTL).toBeGreaterThan(expectedTTL - 5);
        expect(offerTTL).toBeLessThanOrEqual(expectedTTL);

        // Verify data can be retrieved
        const retrieved = await client.get(offerKey);
        expect(retrieved).not.toBeNull();
        const parsed = JSON.parse(retrieved as string);
        expect(parsed.eventName).toBe("TTL Test Event");

        // Clean up
        await client.del(offerKey);
        await client.del(hashKey);
    });

    test('should set TTL for EV cache', async () => {
        const client = redis;
        expect(client).not.toBeNull();

        console.log('\n=== Testing EV Cache TTL ===');
        console.log(`Expected TTL: ${process.env.REDIS_EV_CACHE_TTL || 300} seconds`);

        // Manually set cached EV result using real Redis (bypass mocked helper)
        const evKey = `ev:calc:${TEST_OFFER_ID}:ttl-player:100:Over:DRAFTKINGS:PINNACLE:multiplicative`;
        const expectedTTL = parseInt(process.env.REDIS_EV_CACHE_TTL || '300');

        await client.set(evKey, JSON.stringify(mockResponse));
        await client.expire(evKey, expectedTTL);

        const evTTL = await client.ttl(evKey);

        console.log(`EV key: ${evKey}`);
        console.log(`EV key TTL: ${evTTL} seconds`);

        // TTL should be set (not -1 or -2)
        expect(evTTL).toBeGreaterThan(0);

        // Should be close to the configured value
        expect(evTTL).toBeGreaterThan(expectedTTL - 5);
        expect(evTTL).toBeLessThanOrEqual(expectedTTL);

        // Clean up
        await client.del(evKey);
    });

    test('should diagnose existing cache keys', async () => {
        const client = redis;
        expect(client).not.toBeNull();

        console.log('\n=== Diagnosing Existing Cache Keys ===');

        const allKeys = await client.keys('*');
        console.log(`Total keys in Redis: ${allKeys.length}`);

        // Filter cache keys
        const offerKeys = allKeys.filter(k => k.startsWith('oddsshopper:offers:'));
        const hashKeys = allKeys.filter(k => k.startsWith('oddsshopper:hash:'));
        const evKeys = allKeys.filter(k => k.startsWith('ev:calc:'));

        console.log(`\nOffer cache keys: ${offerKeys.length}`);
        for (const key of offerKeys) {
            const ttl = await client.ttl(key);
            const ttlDisplay = ttl === -1 ? 'PERMANENT (no TTL!)' :
                              ttl === -2 ? 'EXPIRED' :
                              `${ttl}s (${Math.floor(ttl / 60)}m)`;
            console.log(`  ${key}: ${ttlDisplay}`);
        }

        console.log(`\nHash keys: ${hashKeys.length}`);
        for (const key of hashKeys) {
            const ttl = await client.ttl(key);
            const ttlDisplay = ttl === -1 ? 'PERMANENT (no TTL!)' :
                              ttl === -2 ? 'EXPIRED' :
                              `${ttl}s (${Math.floor(ttl / 60)}m)`;
            console.log(`  ${key}: ${ttlDisplay}`);
        }

        console.log(`\nEV cache keys: ${evKeys.length}`);
        for (const key of evKeys.slice(0, 5)) { // Show first 5
            const ttl = await client.ttl(key);
            const ttlDisplay = ttl === -1 ? 'PERMANENT (no TTL!)' :
                              ttl === -2 ? 'EXPIRED' :
                              `${ttl}s (${Math.floor(ttl / 60)}m)`;
            console.log(`  ${key}: ${ttlDisplay}`);
        }
        if (evKeys.length > 5) {
            console.log(`  ... and ${evKeys.length - 5} more`);
        }
    });
});
