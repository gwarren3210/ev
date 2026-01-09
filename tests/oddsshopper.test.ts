import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { fetchOddsShopperData } from "../src/services/oddsshopper";
import type { Offer } from "../src/types/index";
import { ApiError, OfferNotFoundError } from "../src/errors/index";
import { resetRedisState } from "../src/cache/redis";

// Mock offer data
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

describe("OddsShopper Service", () => {
    const originalFetch = global.fetch;
    const originalEnv = { ...process.env };

    beforeEach(() => {
        resetRedisState();
        process.env = { ...originalEnv };
        process.env.ODDSSHOPPER_API_URL = "https://api.example.com";
        delete process.env.REDIS_URL; // Disable Redis for simpler testing
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env = { ...originalEnv };
    });

    describe("fetchOddsShopperData", () => {
        it("fetches from API when cache is disabled", async () => {
            global.fetch = mock(async () => ({
                ok: true,
                status: 200,
                json: async () => [mockOffer],
            })) as any;

            const result = await fetchOddsShopperData("offer123");

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value).toHaveLength(1);
                expect(result.value[0]!.offerName).toBe("Test Offer");
            }
        });

        it("returns OfferNotFoundError for 404 response", async () => {
            global.fetch = mock(async () => ({
                ok: false,
                status: 404,
                statusText: "Not Found",
            })) as any;

            const result = await fetchOddsShopperData("nonexistent");

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(OfferNotFoundError);
            }
        });

        it("returns ApiError for 500 response", async () => {
            global.fetch = mock(async () => ({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
            })) as any;

            const result = await fetchOddsShopperData("offer123");

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ApiError);
                if (result.error instanceof ApiError) {
                    expect(result.error.statusCode).toBe(500);
                }
            }
        });

        it("returns ApiError for network failure", async () => {
            global.fetch = mock(async () => {
                throw new Error("Network error");
            }) as any;

            const result = await fetchOddsShopperData("offer123");

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ApiError);
                expect(result.error.message).toContain("Network or parsing failure");
            }
        });

        it("returns OfferNotFoundError when response is not an array", async () => {
            global.fetch = mock(async () => ({
                ok: true,
                status: 200,
                json: async () => ({ error: "Invalid response" }),
            })) as any;

            const result = await fetchOddsShopperData("offer123");

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(OfferNotFoundError);
            }
        });

        it("returns ApiError when response fails schema validation", async () => {
            global.fetch = mock(async () => ({
                ok: true,
                status: 200,
                json: async () => [{ invalid: "data" }], // Missing required fields
            })) as any;

            const result = await fetchOddsShopperData("offer123");

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ApiError);
                expect(result.error.message).toContain("Upstream error");
            }
        });

        it("constructs correct API URL with parameters", async () => {
            let capturedUrl = "";
            global.fetch = mock(async (url: string) => {
                capturedUrl = url;
                return {
                    ok: true,
                    status: 200,
                    json: async () => [mockOffer],
                };
            }) as any;

            await fetchOddsShopperData("offer123");

            expect(capturedUrl).toContain("https://api.example.com/api/offers/offer123/outcomes/live");
            expect(capturedUrl).toContain("startDate=");
            expect(capturedUrl).toContain("sortBy=Time");
        });

        it("respects skipCache option", async () => {
            global.fetch = mock(async () => ({
                ok: true,
                status: 200,
                json: async () => [mockOffer],
            })) as any;

            const result = await fetchOddsShopperData("offer123", { skipCache: true });

            expect(result.success).toBe(true);
        });

        it("handles empty array response", async () => {
            global.fetch = mock(async () => ({
                ok: true,
                status: 200,
                json: async () => [],
            })) as any;

            const result = await fetchOddsShopperData("offer123");

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value).toHaveLength(0);
            }
        });

        it("handles multiple offers in response", async () => {
            const offer2 = { ...mockOffer, offerName: "Offer 2" };
            global.fetch = mock(async () => ({
                ok: true,
                status: 200,
                json: async () => [mockOffer, offer2],
            })) as any;

            const result = await fetchOddsShopperData("offer123");

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.value).toHaveLength(2);
            }
        });
    });
});
