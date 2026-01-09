import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';
import { redis } from 'bun';
import type { Offer, BatchCalculateEVRequest, BatchCalculateEVResponse } from '../../src/types/index';

/**
 * Integration tests for batch EV calculation.
 * These tests use real Redis for caching but mock the OddsShopper API.
 *
 * Requirements:
 * - Redis must be running on localhost:6379 (or REDIS_URL env var)
 */

// Mock offer data for testing
const mockOffers: Offer[] = [
    {
        eventName: "Test Event 1",
        tournamentName: "NBA",
        offerName: "Player Points",
        startDate: new Date().toISOString(),
        dateString: "Today",
        hold: 0.045,
        sportsbooks: ["PINNACLE", "DRAFTKINGS", "FANDUEL"],
        participants: [{
            id: "player-001",
            name: "Test Player 1",
            title: "Test Player 1",
            isHome: true,
            participantLogo: "",
            participantType: "player"
        }],
        sides: [
            {
                label: "Over",
                outcomes: [
                    {
                        id: "out-1",
                        displayLabel: "Over 25.5",
                        americanOdds: "-110",
                        bestHoldOutcome: false,
                        odds: 1.909,
                        line: "25.5",
                        label: "Over",
                        sportsbookCode: "PINNACLE",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Over 25.5",
                        hashCodeBetSideWithLine: "hash1",
                        hashCode: "h1"
                    },
                    {
                        id: "out-2",
                        displayLabel: "Over 25.5",
                        americanOdds: "-115",
                        bestHoldOutcome: false,
                        odds: 1.869,
                        line: "25.5",
                        label: "Over",
                        sportsbookCode: "DRAFTKINGS",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Over 25.5",
                        hashCodeBetSideWithLine: "hash2",
                        hashCode: "h2"
                    },
                    {
                        id: "out-3",
                        displayLabel: "Over 25.5",
                        americanOdds: "-112",
                        bestHoldOutcome: false,
                        odds: 1.893,
                        line: "25.5",
                        label: "Over",
                        sportsbookCode: "FANDUEL",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Over 25.5",
                        hashCodeBetSideWithLine: "hash3",
                        hashCode: "h3"
                    }
                ]
            },
            {
                label: "Under",
                outcomes: [
                    {
                        id: "out-4",
                        displayLabel: "Under 25.5",
                        americanOdds: "-110",
                        bestHoldOutcome: false,
                        odds: 1.909,
                        line: "25.5",
                        label: "Under",
                        sportsbookCode: "PINNACLE",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Under 25.5",
                        hashCodeBetSideWithLine: "hash4",
                        hashCode: "h4"
                    },
                    {
                        id: "out-5",
                        displayLabel: "Under 25.5",
                        americanOdds: "-105",
                        bestHoldOutcome: false,
                        odds: 1.952,
                        line: "25.5",
                        label: "Under",
                        sportsbookCode: "DRAFTKINGS",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Under 25.5",
                        hashCodeBetSideWithLine: "hash5",
                        hashCode: "h5"
                    },
                    {
                        id: "out-6",
                        displayLabel: "Under 25.5",
                        americanOdds: "-108",
                        bestHoldOutcome: false,
                        odds: 1.926,
                        line: "25.5",
                        label: "Under",
                        sportsbookCode: "FANDUEL",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Under 25.5",
                        hashCodeBetSideWithLine: "hash6",
                        hashCode: "h6"
                    }
                ]
            }
        ]
    },
    {
        eventName: "Test Event 2",
        tournamentName: "NBA",
        offerName: "Player Points",
        startDate: new Date().toISOString(),
        dateString: "Today",
        hold: 0.045,
        sportsbooks: ["PINNACLE", "DRAFTKINGS"],
        participants: [{
            id: "player-002",
            name: "Test Player 2",
            title: "Test Player 2",
            isHome: false,
            participantLogo: "",
            participantType: "player"
        }],
        sides: [
            {
                label: "Over",
                outcomes: [
                    {
                        id: "out-7",
                        displayLabel: "Over 18.5",
                        americanOdds: "-108",
                        bestHoldOutcome: false,
                        odds: 1.926,
                        line: "18.5",
                        label: "Over",
                        sportsbookCode: "PINNACLE",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Over 18.5",
                        hashCodeBetSideWithLine: "hash7",
                        hashCode: "h7"
                    },
                    {
                        id: "out-8",
                        displayLabel: "Over 18.5",
                        americanOdds: "-120",
                        bestHoldOutcome: false,
                        odds: 1.833,
                        line: "18.5",
                        label: "Over",
                        sportsbookCode: "DRAFTKINGS",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Over 18.5",
                        hashCodeBetSideWithLine: "hash8",
                        hashCode: "h8"
                    }
                ]
            },
            {
                label: "Under",
                outcomes: [
                    {
                        id: "out-9",
                        displayLabel: "Under 18.5",
                        americanOdds: "-112",
                        bestHoldOutcome: false,
                        odds: 1.893,
                        line: "18.5",
                        label: "Under",
                        sportsbookCode: "PINNACLE",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Under 18.5",
                        hashCodeBetSideWithLine: "hash9",
                        hashCode: "h9"
                    },
                    {
                        id: "out-10",
                        displayLabel: "Under 18.5",
                        americanOdds: "+100",
                        bestHoldOutcome: false,
                        odds: 2.0,
                        line: "18.5",
                        label: "Under",
                        sportsbookCode: "DRAFTKINGS",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Under 18.5",
                        hashCodeBetSideWithLine: "hash10",
                        hashCode: "h10"
                    }
                ]
            }
        ]
    }
];

// Mock the oddsshopper service to return our test data
mock.module('../../src/services/oddsshopper.js', () => ({
    fetchOddsShopperData: async (offerId: string) => {
        if (offerId === 'test-batch-offer') {
            return { success: true, value: mockOffers };
        }
        if (offerId === 'empty-offer') {
            return { success: true, value: [] };
        }
        if (offerId === 'api-error-offer') {
            return {
                success: false,
                error: { code: 'API_ERROR', message: 'Upstream error', httpStatus: 502 }
            };
        }
        return { success: false, error: { code: 'NOT_FOUND', message: 'Offer not found', httpStatus: 404 } };
    },
    fetchOddsShopperDataForPlayer: async () => {
        return { success: true, value: mockOffers[0] };
    },
    fetchFromAPI: async () => {
        return { success: true, value: mockOffers };
    }
}));

// Import after mocking
import { calculateEVBatch } from '../../src/logic/batch';

const TEST_OFFER_ID = 'test-batch-offer';

describe('Batch EV Calculation Integration Tests', () => {
    beforeAll(async () => {
        // Set up environment
        process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
        process.env.ODDSSHOPPER_API_URL = 'https://api.test.com';
        process.env.REDIS_API_CACHE_TTL = '60';
        process.env.REDIS_EV_CACHE_TTL = '300';

        // Clean up any existing test keys
        const keys = await redis.keys('*test-batch*');
        for (const key of keys) {
            await redis.del(key);
        }
    });

    afterAll(async () => {
        // Clean up test keys
        const keys = await redis.keys('*test-batch*');
        for (const key of keys) {
            await redis.del(key);
        }
    });

    test('processes batch with single player successfully', async () => {
        const request: BatchCalculateEVRequest = {
            offerId: TEST_OFFER_ID,
            items: [
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                }
            ]
        };

        const result = await calculateEVBatch(request, { skipCache: true });

        expect(result.offerId).toBe(TEST_OFFER_ID);
        expect(result.totalItems).toBe(1);
        expect(result.successCount).toBe(1);
        expect(result.errorCount).toBe(0);
        expect(result.results).toHaveLength(1);
        expect(result.results[0]!.success).toBe(true);

        if (result.results[0]!.success) {
            expect(result.results[0]!.result.player).toBe('Test Player 1');
            expect(result.results[0]!.result.targetBook).toBe('DRAFTKINGS');
            expect(result.results[0]!.result.side).toBe('Over');
            expect(typeof result.results[0]!.result.expectedValue).toBe('number');
        }
    });

    test('processes batch with multiple items for same player', async () => {
        const request: BatchCalculateEVRequest = {
            offerId: TEST_OFFER_ID,
            items: [
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                },
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Under',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                }
            ]
        };

        const result = await calculateEVBatch(request, { skipCache: true });

        expect(result.totalItems).toBe(2);
        expect(result.successCount).toBe(2);
        expect(result.errorCount).toBe(0);

        // Both Over and Under should succeed
        expect(result.results[0]!.success).toBe(true);
        expect(result.results[1]!.success).toBe(true);

        if (result.results[0]!.success && result.results[1]!.success) {
            expect(result.results[0]!.result.side).toBe('Over');
            expect(result.results[1]!.result.side).toBe('Under');
        }
    });

    test('processes batch with multiple players', async () => {
        const request: BatchCalculateEVRequest = {
            offerId: TEST_OFFER_ID,
            items: [
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                },
                {
                    playerId: 'player-002',
                    line: 18.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                }
            ]
        };

        const result = await calculateEVBatch(request, { skipCache: true });

        expect(result.totalItems).toBe(2);
        expect(result.successCount).toBe(2);
        expect(result.errorCount).toBe(0);

        if (result.results[0]!.success && result.results[1]!.success) {
            expect(result.results[0]!.result.player).toBe('Test Player 1');
            expect(result.results[1]!.result.player).toBe('Test Player 2');
        }
    });

    test('handles multiple devig methods in batch', async () => {
        const devigMethods = ['multiplicative', 'additive', 'power', 'shin'] as const;

        const request: BatchCalculateEVRequest = {
            offerId: TEST_OFFER_ID,
            items: devigMethods.map(method => ({
                playerId: 'player-001',
                line: 25.5,
                side: 'Over' as const,
                targetBook: 'DRAFTKINGS',
                sharps: ['PINNACLE'],
                devigMethod: method
            }))
        };

        const result = await calculateEVBatch(request, { skipCache: true });

        expect(result.totalItems).toBe(4);
        expect(result.results).toHaveLength(4);

        // Each method should produce a result (success or error)
        for (const item of result.results) {
            expect(typeof item.index).toBe('number');
            expect(typeof item.success).toBe('boolean');
        }
    });

    test('handles partial failures in batch', async () => {
        const request: BatchCalculateEVRequest = {
            offerId: TEST_OFFER_ID,
            items: [
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                },
                {
                    playerId: 'non-existent-player',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                }
            ]
        };

        const result = await calculateEVBatch(request, { skipCache: true });

        expect(result.totalItems).toBe(2);
        expect(result.successCount).toBe(1);
        expect(result.errorCount).toBe(1);

        // First item should succeed
        expect(result.results[0]!.success).toBe(true);
        // Second item should fail (player not found)
        expect(result.results[1]!.success).toBe(false);
        if (!result.results[1]!.success) {
            expect(result.results[1]!.error.code).toBeDefined();
        }
    });

    test('handles empty offer result', async () => {
        const request: BatchCalculateEVRequest = {
            offerId: 'empty-offer',
            items: [
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                }
            ]
        };

        const result = await calculateEVBatch(request, { skipCache: true });

        expect(result.totalItems).toBe(1);
        expect(result.errorCount).toBe(1);
        expect(result.results[0]!.success).toBe(false);
        if (!result.results[0]!.success) {
            expect(result.results[0]!.error.code).toBe('NOT_FOUND');
        }
    });

    test('handles API error for offer', async () => {
        const request: BatchCalculateEVRequest = {
            offerId: 'api-error-offer',
            items: [
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                },
                {
                    playerId: 'player-002',
                    line: 18.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                }
            ]
        };

        const result = await calculateEVBatch(request);

        // All items should fail when API returns error
        expect(result.totalItems).toBe(2);
        expect(result.errorCount).toBe(2);
        expect(result.successCount).toBe(0);

        for (const item of result.results) {
            expect(item.success).toBe(false);
            if (!item.success) {
                expect(item.error.code).toBe('API_ERROR');
            }
        }
    });

    test('returns consistent results for identical requests', async () => {
        const request: BatchCalculateEVRequest = {
            offerId: TEST_OFFER_ID,
            items: [
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'FANDUEL',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                }
            ]
        };

        // First call
        const result1 = await calculateEVBatch(request, { skipCache: true });
        expect(result1.successCount).toBe(1);

        // Second call with same params
        const result2 = await calculateEVBatch(request, { skipCache: true });
        expect(result2.successCount).toBe(1);

        // Results should be the same (deterministic calculation)
        if (result1.results[0]!.success && result2.results[0]!.success) {
            expect(result1.results[0]!.result.expectedValue).toBe(result2.results[0]!.result.expectedValue);
            expect(result1.results[0]!.result.trueProbability).toBe(result2.results[0]!.result.trueProbability);
        }
    });

    test('skips cache when skipCache option is true', async () => {
        const cacheKey = 'ev:calc:test-batch-offer:player-001:25.5:Over:DRAFTKINGS:PINNACLE:additive';

        // Pre-populate cache with fake data
        const fakeResult = {
            player: 'Fake Player',
            market: 'Fake Market',
            line: 25.5,
            side: 'Over',
            targetBook: 'DRAFTKINGS',
            targetOdds: -115,
            trueProbability: 0.5,
            impliedProbability: 0.5,
            expectedValue: 99.99,
            sharpsUsed: ['PINNACLE']
        };
        await redis.set(cacheKey, JSON.stringify(fakeResult));

        const request: BatchCalculateEVRequest = {
            offerId: TEST_OFFER_ID,
            items: [
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'additive'
                }
            ]
        };

        // With skipCache, should NOT use the fake cached data
        const result = await calculateEVBatch(request, { skipCache: true });

        if (result.results[0]!.success) {
            // Should get real calculation, not the fake 99.99
            expect(result.results[0]!.result.expectedValue).not.toBe(99.99);
            expect(result.results[0]!.result.player).toBe('Test Player 1');
        }

        // Clean up
        await redis.del(cacheKey);
    });

    test('includes Kelly bet sizing when bankroll provided', async () => {
        const request: BatchCalculateEVRequest = {
            offerId: TEST_OFFER_ID,
            items: [
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative',
                    bankroll: 1000
                }
            ]
        };

        const result = await calculateEVBatch(request, { skipCache: true });

        expect(result.successCount).toBe(1);
        if (result.results[0]!.success) {
            const evResult = result.results[0]!.result;
            expect(evResult.kelly).toBeDefined();
            if (evResult.kelly) {
                expect(typeof evResult.kelly.full).toBe('number');
                expect(typeof evResult.kelly.quarter).toBe('number');
                expect(typeof evResult.kelly.recommendedBet).toBe('number');
                expect(evResult.kelly.bankroll).toBe(1000);
            }
        }
    });

    test('handles mixed bankroll/no-bankroll items in batch', async () => {
        const request: BatchCalculateEVRequest = {
            offerId: TEST_OFFER_ID,
            items: [
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative',
                    bankroll: 1000
                },
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Under',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                    // No bankroll
                }
            ]
        };

        const result = await calculateEVBatch(request, { skipCache: true });

        expect(result.successCount).toBe(2);

        // First item should have Kelly
        if (result.results[0]!.success) {
            expect(result.results[0]!.result.kelly).toBeDefined();
        }

        // Second item should NOT have Kelly
        if (result.results[1]!.success) {
            expect(result.results[1]!.result.kelly).toBeUndefined();
        }
    });

    test('maintains correct indices in results', async () => {
        const request: BatchCalculateEVRequest = {
            offerId: TEST_OFFER_ID,
            items: [
                {
                    playerId: 'player-001',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                },
                {
                    playerId: 'non-existent',
                    line: 25.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                },
                {
                    playerId: 'player-002',
                    line: 18.5,
                    side: 'Under',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                }
            ]
        };

        const result = await calculateEVBatch(request, { skipCache: true });

        expect(result.results[0]!.index).toBe(0);
        expect(result.results[1]!.index).toBe(1);
        expect(result.results[2]!.index).toBe(2);

        expect(result.results[0]!.success).toBe(true);
        expect(result.results[1]!.success).toBe(false);
        expect(result.results[2]!.success).toBe(true);
    });
});
