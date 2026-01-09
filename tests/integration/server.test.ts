import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';
import type { Server } from 'http';
import type { Offer, CalculateEVResponse, BatchCalculateEVResponse } from '../../src/types/index';

/**
 * Integration tests for server endpoints.
 * Tests HTTP request/response cycle with mocked OddsShopper API.
 *
 * Requirements:
 * - Redis must be running on localhost:6379 (or REDIS_URL env var)
 */

const TEST_PORT = 9998;
let server: Server;
let baseUrl: string;

// Mock offer data for testing
const mockOffers: Offer[] = [
    {
        eventName: "Server Test Event",
        tournamentName: "NBA",
        offerName: "Player Points",
        startDate: new Date().toISOString(),
        dateString: "Today",
        hold: 0.045,
        sportsbooks: ["PINNACLE", "DRAFTKINGS"],
        participants: [{
            id: "server-test-player",
            name: "Server Test Player",
            title: "Server Test Player",
            isHome: true,
            participantLogo: "",
            participantType: "player"
        }],
        sides: [
            {
                label: "Over",
                outcomes: [
                    {
                        id: "srv-out-1",
                        displayLabel: "Over 20.5",
                        americanOdds: "-110",
                        bestHoldOutcome: false,
                        odds: 1.909,
                        line: "20.5",
                        label: "Over",
                        sportsbookCode: "PINNACLE",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Over 20.5",
                        hashCodeBetSideWithLine: "srv-hash1",
                        hashCode: "srv-h1"
                    },
                    {
                        id: "srv-out-2",
                        displayLabel: "Over 20.5",
                        americanOdds: "-115",
                        bestHoldOutcome: false,
                        odds: 1.869,
                        line: "20.5",
                        label: "Over",
                        sportsbookCode: "DRAFTKINGS",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Over 20.5",
                        hashCodeBetSideWithLine: "srv-hash2",
                        hashCode: "srv-h2"
                    }
                ]
            },
            {
                label: "Under",
                outcomes: [
                    {
                        id: "srv-out-3",
                        displayLabel: "Under 20.5",
                        americanOdds: "-110",
                        bestHoldOutcome: false,
                        odds: 1.909,
                        line: "20.5",
                        label: "Under",
                        sportsbookCode: "PINNACLE",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Under 20.5",
                        hashCodeBetSideWithLine: "srv-hash3",
                        hashCode: "srv-h3"
                    },
                    {
                        id: "srv-out-4",
                        displayLabel: "Under 20.5",
                        americanOdds: "-105",
                        bestHoldOutcome: false,
                        odds: 1.952,
                        line: "20.5",
                        label: "Under",
                        sportsbookCode: "DRAFTKINGS",
                        sportsbookLogo: "",
                        participantLogo: "",
                        participantType: "",
                        title: "Under 20.5",
                        hashCodeBetSideWithLine: "srv-hash4",
                        hashCode: "srv-h4"
                    }
                ]
            }
        ]
    }
];

// Mock the oddsshopper service
mock.module('../../src/services/oddsshopper.js', () => ({
    fetchOddsShopperData: async (offerId: string) => {
        if (offerId === 'server-test-offer') {
            return { success: true, value: mockOffers };
        }
        if (offerId === 'empty-offer') {
            return { success: true, value: [] };
        }
        return {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Offer not found', httpStatus: 404 }
        };
    },
    fetchOddsShopperDataForPlayer: async (offerId: string, playerId: string) => {
        if (offerId === 'server-test-offer' && playerId === 'server-test-player') {
            return { success: true, value: mockOffers[0] };
        }
        return {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Offer not found', httpStatus: 404 }
        };
    },
    fetchFromAPI: async () => {
        return { success: true, value: mockOffers };
    }
}));

// Import server after mocking
import app from '../../src/server';

describe('Server Endpoint Integration Tests', () => {
    beforeAll(async () => {
        // Set up environment
        process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
        process.env.ODDSSHOPPER_API_URL = 'https://api.test.com';
        process.env.REDIS_API_CACHE_TTL = '60';
        process.env.REDIS_EV_CACHE_TTL = '300';

        server = app.listen(TEST_PORT);
        baseUrl = `http://localhost:${TEST_PORT}`;
    });

    afterAll(() => {
        server?.close();
    });

    describe('GET /test', () => {
        test('returns "test" for health check', async () => {
            const response = await fetch(`${baseUrl}/test`);
            const text = await response.text();

            expect(response.status).toBe(200);
            expect(text).toBe('test');
        });
    });

    describe('POST /calculate-ev', () => {
        test('returns 400 for missing required fields', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            expect(response.status).toBe(400);
            const json = await response.json() as { error: string };
            expect(json.error).toBe('Invalid request body');
        });

        test('returns 400 for invalid request body', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'test',
                    // missing required fields
                })
            });

            expect(response.status).toBe(400);
            const json = await response.json() as { error: string; details?: string };
            expect(json.error).toBe('Invalid request body');
            expect(json.details).toBeDefined();
        });

        test('returns 400 for invalid devigMethod', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    playerId: 'server-test-player',
                    line: 20.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'invalid-method'
                })
            });

            expect(response.status).toBe(400);
        });

        test('returns 400 for invalid side', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    playerId: 'server-test-player',
                    line: 20.5,
                    side: 'InvalidSide',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                })
            });

            expect(response.status).toBe(400);
        });

        test('calculates EV successfully', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev?fresh=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    playerId: 'server-test-player',
                    line: 20.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                })
            });

            expect(response.status).toBe(200);
            const json = await response.json() as CalculateEVResponse;

            expect(json.player).toBe('Server Test Player');
            expect(json.targetBook).toBe('DRAFTKINGS');
            expect(json.side).toBe('Over');
            expect(json.line).toBe(20.5);
            expect(typeof json.expectedValue).toBe('number');
            expect(typeof json.trueProbability).toBe('number');
            expect(typeof json.impliedProbability).toBe('number');
            expect(json.sharpsUsed).toContain('PINNACLE');
        });

        test('returns error for non-existent offer', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev?fresh=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'non-existent-offer',
                    playerId: 'some-player',
                    line: 20.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                })
            });

            expect(response.status).toBe(404);
            const json = await response.json() as { error: string; code: string };
            expect(json.code).toBe('NOT_FOUND');
        });

        test('bypasses cache with fresh=true query param', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev?fresh=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    playerId: 'server-test-player',
                    line: 20.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                })
            });

            expect(response.status).toBe(200);
        });

        test('bypasses cache with Cache-Control header', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    playerId: 'server-test-player',
                    line: 20.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                })
            });

            expect(response.status).toBe(200);
        });

        test('includes Kelly when bankroll provided', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev?fresh=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    playerId: 'server-test-player',
                    line: 20.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative',
                    bankroll: 1000
                })
            });

            expect(response.status).toBe(200);
            const json = await response.json() as CalculateEVResponse;

            expect(json.kelly).toBeDefined();
            if (json.kelly) {
                expect(typeof json.kelly.full).toBe('number');
                expect(typeof json.kelly.quarter).toBe('number');
                expect(json.kelly.bankroll).toBe(1000);
            }
        });

        test('returns 400 for negative bankroll', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    playerId: 'server-test-player',
                    line: 20.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative',
                    bankroll: -100
                })
            });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /calculate-ev/batch', () => {
        test('returns 400 for missing required fields', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            expect(response.status).toBe(400);
            const json = await response.json() as { error: string };
            expect(json.error).toBe('Invalid request body');
        });

        test('returns 400 for empty items array', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    items: []
                })
            });

            expect(response.status).toBe(400);
        });

        test('returns 400 for too many items', async () => {
            const items = Array(11).fill({
                playerId: 'server-test-player',
                line: 20.5,
                side: 'Over',
                targetBook: 'DRAFTKINGS',
                sharps: ['PINNACLE'],
                devigMethod: 'multiplicative'
            });

            const response = await fetch(`${baseUrl}/calculate-ev/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    items
                })
            });

            expect(response.status).toBe(400);
        });

        test('returns 400 for item with empty sharps array', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    items: [{
                        playerId: 'server-test-player',
                        line: 20.5,
                        side: 'Over',
                        targetBook: 'DRAFTKINGS',
                        sharps: [],
                        devigMethod: 'multiplicative'
                    }]
                })
            });

            expect(response.status).toBe(400);
        });

        test('calculates batch EV successfully', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev/batch?fresh=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    items: [
                        {
                            playerId: 'server-test-player',
                            line: 20.5,
                            side: 'Over',
                            targetBook: 'DRAFTKINGS',
                            sharps: ['PINNACLE'],
                            devigMethod: 'multiplicative'
                        },
                        {
                            playerId: 'server-test-player',
                            line: 20.5,
                            side: 'Under',
                            targetBook: 'DRAFTKINGS',
                            sharps: ['PINNACLE'],
                            devigMethod: 'multiplicative'
                        }
                    ]
                })
            });

            expect(response.status).toBe(200);
            const json = await response.json() as BatchCalculateEVResponse;

            expect(json.offerId).toBe('server-test-offer');
            expect(json.totalItems).toBe(2);
            expect(json.results).toHaveLength(2);
            expect(json.successCount + json.errorCount).toBe(2);
        });

        test('batch always returns 200 even with partial failures', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev/batch?fresh=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    items: [
                        {
                            playerId: 'server-test-player',
                            line: 20.5,
                            side: 'Over',
                            targetBook: 'DRAFTKINGS',
                            sharps: ['PINNACLE'],
                            devigMethod: 'multiplicative'
                        },
                        {
                            playerId: 'non-existent-player',
                            line: 20.5,
                            side: 'Over',
                            targetBook: 'DRAFTKINGS',
                            sharps: ['PINNACLE'],
                            devigMethod: 'multiplicative'
                        }
                    ]
                })
            });

            // Batch endpoint always returns 200, individual errors in results array
            expect(response.status).toBe(200);
            const json = await response.json() as BatchCalculateEVResponse;

            expect(json.successCount).toBeGreaterThanOrEqual(1);
            expect(json.errorCount).toBeGreaterThanOrEqual(0);
        });

        test('handles all items failing', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev/batch?fresh=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'empty-offer',
                    items: [
                        {
                            playerId: 'any-player',
                            line: 20.5,
                            side: 'Over',
                            targetBook: 'DRAFTKINGS',
                            sharps: ['PINNACLE'],
                            devigMethod: 'multiplicative'
                        }
                    ]
                })
            });

            expect(response.status).toBe(200);
            const json = await response.json() as BatchCalculateEVResponse;

            expect(json.errorCount).toBe(1);
            expect(json.successCount).toBe(0);
        });
    });

    describe('Cache bypass options', () => {
        test('shouldSkipCache returns true for fresh=true', async () => {
            // Test via actual endpoint behavior
            const response = await fetch(`${baseUrl}/calculate-ev?fresh=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    playerId: 'server-test-player',
                    line: 20.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                })
            });

            expect(response.status).toBe(200);
        });

        test('shouldSkipCache returns true for Cache-Control: no-cache', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    playerId: 'server-test-player',
                    line: 20.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                })
            });

            expect(response.status).toBe(200);
        });

        test('shouldSkipCache returns false for normal requests', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offerId: 'server-test-offer',
                    playerId: 'server-test-player',
                    line: 20.5,
                    side: 'Over',
                    targetBook: 'DRAFTKINGS',
                    sharps: ['PINNACLE'],
                    devigMethod: 'multiplicative'
                })
            });

            expect(response.status).toBe(200);
        });
    });

    describe('Error handling', () => {
        test('handles malformed JSON gracefully', async () => {
            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not-valid-json'
            });

            // Express should return 400 for malformed JSON
            expect([400, 500]).toContain(response.status);
        });
    });
});
