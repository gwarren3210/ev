import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { Offer, CalculateEVRequest, CalculateEVResponse } from "../../src/types/index";

// Mock data
const mockOffer: Offer = {
    eventName: "Test Event",
    tournamentName: "Test Tournament",
    offerName: "Test Offer",
    startDate: new Date().toISOString(),
    dateString: "Today",
    hold: 0.05,
    sportsbooks: ["PINNACLE"],
    participants: [{ id: "player1", name: "Test Player", title: "", isHome: true, participantLogo: "", participantType: "" }],
    sides: [],
};

const mockRequest: CalculateEVRequest = {
    offerId: "offer123",
    playerId: "player1",
    line: -110,
    side: "Over",
    targetBook: "DRAFTKINGS",
    sharps: ["PINNACLE", "BETMGM"],
    devigMethod: "multiplicative",
};

const mockResponse: CalculateEVResponse = {
    player: "Test Player",
    market: "Test Market",
    line: -110,
    side: "Over",
    targetBook: "DRAFTKINGS",
    targetOdds: -110,
    trueProbability: 0.55,
    impliedProbability: 0.52,
    expectedValue: 5.2,
    sharpsUsed: ["PINNACLE"],
    bestAvailableOdds: {
        sportsbookCode: "PINNACLE",
        americanOdds: -105,
    },
};

// ==========================================
// Mock Redis Client
// ==========================================
// We'll recreate these in beforeEach to get fresh call history
let mockRedis: any;
let mockGetRedisClient: any;
let mockIsRedisAvailable: any;
let mockResetRedisState: any;

// Mock the redis module to return our mock client
// This mock should respect the actual function logic when needed
mock.module("../../src/cache/redis.js", () => ({
    getRedisClient: () => mockGetRedisClient(),
    isRedisAvailable: () => mockIsRedisAvailable(),
    resetRedisState: () => mockResetRedisState(),
}));

// Import cache functions after mocking redis module
import {
    getCachedOfferData,
    setCachedOfferData,
    generateEVCacheKey,
    getCachedEVResult,
    setCachedEVResult,
    generateOfferHash,
    invalidateEVCacheForOffer,
} from "../../src/cache/index";

describe("Cache Module", () => {
    // Store original console methods
    const originalConsole = {
        error: console.error,
        log: console.log,
        warn: console.warn,
    };

    beforeEach(() => {
        process.env.REDIS_URL = "redis://localhost:6379";
        process.env.ODDSSHOPPER_API_URL = "https://api.example.com";

        // Suppress console output during tests
        console.error = mock(() => {});
        console.log = mock(() => {});
        console.warn = mock(() => {});

        // Recreate mock Redis client with fresh call history
        mockRedis = {
            get: mock(async () => null),
            set: mock(async () => "OK"),
            expire: mock(async () => 1),
            del: mock(async () => 1),
            scan: mock(async () => ["0", []]),
            keys: mock(async () => []),
            ttl: mock(async () => -1),
        };

        // Recreate mock functions
        mockGetRedisClient = mock(async () => mockRedis);
        mockIsRedisAvailable = mock(() => true);
        mockResetRedisState = mock(() => {});
    });

    describe("getCachedOfferData", () => {
        it("returns null when Redis is unavailable", async () => {
            mockGetRedisClient.mockImplementation(async () => null);
            const result = await getCachedOfferData("offer123", "player1");
            expect(result).toBeNull();
        });

        it("returns data on hit", async () => {
            mockRedis.get.mockImplementation(async () => JSON.stringify(mockOffer));

            const result = await getCachedOfferData("offer123", "player1");
            expect(result).not.toBeNull();
            expect(result!.eventName).toBe("Test Event");
            expect(mockRedis.get).toHaveBeenCalledWith(`oddsshopper:offers:offer123:player1`);
        });

        it("handles Redis errors gracefully", async () => {
            mockRedis.get.mockImplementation(async () => { throw new Error("Redis disconnect"); });

            const result = await getCachedOfferData("offer123", "player1");
            expect(result).toBeNull();
        });

        it("returns null when cached data is invalid JSON", async () => {
            mockRedis.get.mockImplementation(async () => "invalid{json");

            const result = await getCachedOfferData("offer123", "player1");
            expect(result).toBeNull();
        });

        it("returns null on cache miss", async () => {
            mockRedis.get.mockImplementation(async () => null);

            const result = await getCachedOfferData("offer123", "player1");
            expect(result).toBeNull();
        });
    });

    describe("setCachedOfferData", () => {
        it("does nothing when Redis is unavailable", async () => {
            mockGetRedisClient.mockImplementation(async () => null);
            await expect(setCachedOfferData("offer123", "player1", mockOffer)).resolves.toBeUndefined();
        });

        it("stores data and hash", async () => {
            await setCachedOfferData("offer123", "player1", mockOffer);

            expect(mockRedis.set).toHaveBeenCalled();
            expect(mockRedis.expire).toHaveBeenCalled();
        });

        it("invalidates EV cache when hash changes", async () => {
            // Setup: old hash exists
            mockRedis.get.mockImplementation(async (key: string) => {
                if (key.includes("oddsshopper:hash:")) return "old-hash";
                return null;
            });

            // Mock scan to find one EV key to delete
            mockRedis.scan.mockImplementation(async () => ["0", ["ev:calc:offer123:player1:req1"]]);

            await setCachedOfferData("offer123", "player1", mockOffer);

            expect(mockRedis.scan).toHaveBeenCalled();
            expect(mockRedis.del).toHaveBeenCalledWith("ev:calc:offer123:player1:req1");
        });

        it("does not invalidate EV cache when hash is the same", async () => {
            const currentHash = generateOfferHash(mockOffer);

            // Setup: old hash exists and matches new hash
            mockRedis.get.mockImplementation(async (key: string) => {
                if (key.includes("oddsshopper:hash:")) return currentHash;
                return null;
            });

            await setCachedOfferData("offer123", "player1", mockOffer);

            // scan should not be called since hash didn't change
            expect(mockRedis.scan).not.toHaveBeenCalled();
        });

        it("does not invalidate EV cache when no old hash exists", async () => {
            // No old hash
            mockRedis.get.mockImplementation(async () => null);

            await setCachedOfferData("offer123", "player1", mockOffer);

            // scan should not be called for first-time cache
            expect(mockRedis.scan).not.toHaveBeenCalled();
        });

        it("handles Redis errors gracefully", async () => {
            mockRedis.set.mockImplementation(async () => { throw new Error("Redis error"); });

            // Should not throw
            await expect(setCachedOfferData("offer123", "player1", mockOffer)).resolves.toBeUndefined();
        });
    });

    describe("generateEVCacheKey", () => {
        it("generates deterministic key from request", () => {
            const key = generateEVCacheKey(mockRequest);
            expect(key).toContain("offer123");
            expect(key).toContain("player1");
            expect(key).toContain("-110");
            expect(key).toContain("Over");
            expect(key).toContain("DRAFTKINGS");
            expect(key).toContain("multiplicative");
        });

        it("sorts sharps array for consistency", () => {
            const req1 = { ...mockRequest, sharps: ["PINNACLE", "BETMGM"] };
            const req2 = { ...mockRequest, sharps: ["BETMGM", "PINNACLE"] };

            const key1 = generateEVCacheKey(req1);
            const key2 = generateEVCacheKey(req2);

            expect(key1).toBe(key2);
        });

        it("handles empty sharps array", () => {
            const req = { ...mockRequest, sharps: [] };
            const key = generateEVCacheKey(req);

            expect(key).toContain("offer123");
            expect(key).toContain("player1");
        });

        it("generates different keys for different parameters", () => {
            const req1 = { ...mockRequest, line: -110 };
            const req2 = { ...mockRequest, line: -120 };

            const key1 = generateEVCacheKey(req1);
            const key2 = generateEVCacheKey(req2);

            expect(key1).not.toBe(key2);
        });
    });

    describe("getCachedEVResult", () => {
        it("returns data on hit", async () => {
            mockRedis.get.mockImplementation(async () => JSON.stringify(mockResponse));

            const result = await getCachedEVResult(mockRequest);
            expect(result).not.toBeNull();
            expect(result!.player).toBe("Test Player");
            expect(mockRedis.get).toHaveBeenCalled();
        });

        it("returns null on miss", async () => {
            mockRedis.get.mockImplementation(async () => null);

            const result = await getCachedEVResult(mockRequest);
            expect(result).toBeNull();
        });

        it("returns null when Redis is unavailable", async () => {
            mockGetRedisClient.mockImplementation(async () => null);

            const result = await getCachedEVResult(mockRequest);
            expect(result).toBeNull();
        });

        it("handles Redis errors gracefully", async () => {
            mockRedis.get.mockImplementation(async () => { throw new Error("Redis error"); });

            const result = await getCachedEVResult(mockRequest);
            expect(result).toBeNull();
        });

        it("returns null when cached data is invalid JSON", async () => {
            mockRedis.get.mockImplementation(async () => "invalid{json");

            const result = await getCachedEVResult(mockRequest);
            expect(result).toBeNull();
        });
    });

    describe("setCachedEVResult", () => {
        it("stores EV result", async () => {
            await setCachedEVResult(mockRequest, mockResponse);
            expect(mockRedis.set).toHaveBeenCalled();
            expect(mockRedis.expire).toHaveBeenCalled();
        });

        it("does nothing when Redis is unavailable", async () => {
            mockGetRedisClient.mockImplementation(async () => null);

            await expect(setCachedEVResult(mockRequest, mockResponse)).resolves.toBeUndefined();
        });

        it("handles Redis errors gracefully", async () => {
            mockRedis.set.mockImplementation(async () => { throw new Error("Redis error"); });

            // Should not throw
            await expect(setCachedEVResult(mockRequest, mockResponse)).resolves.toBeUndefined();
        });
    });

    describe("generateOfferHash", () => {
        it("generates consistent hash for same data", () => {
            const hash1 = generateOfferHash(mockOffer);
            const hash2 = generateOfferHash(mockOffer);
            expect(hash1).toBe(hash2);
        });

        it("generates different hashes for different data", () => {
            const offer1 = { ...mockOffer, eventName: "Event 1" };
            const offer2 = { ...mockOffer, eventName: "Event 2" };

            const hash1 = generateOfferHash(offer1);
            const hash2 = generateOfferHash(offer2);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe("invalidateEVCacheForOffer", () => {
        it("returns 0 when Redis is unavailable", async () => {
            mockGetRedisClient.mockImplementation(async () => null);
            const result = await invalidateEVCacheForOffer("offer123", "player1");
            expect(result).toBe(0);
        });

        it("deletes multiple keys using SCAN", async () => {
            // Mock two pages of SCAN results
            mockRedis.scan
                .mockImplementationOnce(async () => ["1", ["key1", "key2"]])
                .mockImplementationOnce(async () => ["0", ["key3"]]);

            const deletedCount = await invalidateEVCacheForOffer("offer123", "player1");

            expect(deletedCount).toBe(3);
            expect(mockRedis.del).toHaveBeenCalledTimes(3);
        });

        it("handles Redis errors gracefully", async () => {
            mockRedis.scan.mockImplementation(async () => { throw new Error("Scan failed"); });

            const result = await invalidateEVCacheForOffer("offer123", "player1");
            expect(result).toBe(0);
        });

        it("returns 0 when no keys are found", async () => {
            // SCAN returns empty keys array
            mockRedis.scan.mockImplementation(async () => ["0", []]);

            const deletedCount = await invalidateEVCacheForOffer("offer123", "player1");
            expect(deletedCount).toBe(0);
            expect(mockRedis.del).not.toHaveBeenCalled();
        });

        it("handles deletion of single key", async () => {
            mockRedis.scan.mockImplementation(async () => ["0", ["key1"]]);

            const deletedCount = await invalidateEVCacheForOffer("offer123", "player1");

            expect(deletedCount).toBe(1);
            expect(mockRedis.del).toHaveBeenCalledTimes(1);
            expect(mockRedis.del).toHaveBeenCalledWith("key1");
        });
    });
});
