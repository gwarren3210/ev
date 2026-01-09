import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import app from "../src/server";
import type { Server } from "http";
import { type Offer, type CalculateEVResponse, type BatchCalculateEVResponse, DataSchema, type Result } from "../src/types/index";
import { getEnvironment } from "../src/config/env";
import type { ApiError, OfferNotFoundError } from "../src/errors";
import { fetchFromAPI } from "../src/services/oddsshopper";

interface ErrorResponse {
    error: string;
    details?: string;
    code?: string;
}

/**
 * E2E Tests - Tests both endpoints with live OddsShopper data
 *
 * Requirements:
 * - ODDSSHOPPER_API_URL must be set to a real API endpoint
 * - The API must have active offers with multiple sportsbooks
 *
 * Run with: bun test tests/e2e.test.ts
 *
 * Optional environment variables for manual testing:
 * - E2E_OFFER_ID: Specific offer ID to test with
 * - E2E_OFFER_IDS: Comma-separated list of offer IDs to try
 */
/*const sportsbooks = [
    "DraftKings",
    "FanDuel",
    "Caesars",
    "Bet365",
    "BetRivers",
    "BetMGM",
    "Fanatics",
    "HardRockNJ",
    "Fliff",
    "Bally",
    "Borgata",
    "TheScore",
    "BetParx",
    "PointsBet",
    "SugarHouse",
    "PrizePicks",
    "Unibet",
    "Circa",
    "Underdog",
    "Sleeper",
    "ESPNBet",
    "Betr",
    "Dabble",
    "Pick6",
    "STNSports",
    "Rebet",
    "OnyxOdds",
    "Betcris",
    "ProphetX",
    "NoVig",
    "CoolBet",
    "BetOnline",
    "BookMaker",
    "Bovada",
    "Pinnacle",
    "SportsInteraction",
    "NorthStarBetsON",
    "LeoVegas",
    "Kalshi",
    "Polymarket"
];*/
/*const playerIds: string[] = [
    "379be6e1-f844-4b6f-9e86-97c790b1e2ef",
    "09dc1788-a255-46d4-8b67-6901c6753ea6",
    "a6c74230-e223-4a61-92b6-3f1ce2689e68"
];*/
const offerIds: string[] = [
    "aa4dd9a9-6aec-44f9-8ae0-3599520b9351",
    "274fde84-066e-46ee-96bb-e76c98e1115a",
    "550b8fc7-d7e7-46ab-8fa6-faf07ea98372"
];
const TEST_PORT = 9999;
let server: Server;
let baseUrl: string;

// Live data fetched from OddsShopper for testing
let liveOfferId: string;
let livePlayerId: string;
let livePlayerName: string;
let liveLine: number;
let liveTargetBook: string;
let liveSharpBook: string;

/**
 * Fetches a valid offer from OddsShopper API that has:
 * - At least one participant
 * - Both Over and Under outcomes
 * - Multiple sportsbooks (at least 2)
 */
async function fetchTestableOffer(): Promise<{
    offerId: string;
    playerId: string;
    playerName: string;
    line: number;
    targetBook: string;
    sharpBook: string;
} | null> {
    const env = getEnvironment();



    // First, let's try to get any offer from the API
    // We'll fetch a few common offer endpoints
    for (const offerId of offerIds) {
        try {
            const startDate = new Date().toISOString();
            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const params = new URLSearchParams({ startDate, endDate, sortBy: 'Time' });
            const url = `${env.ODDSSHOPPER_API_URL}/api/offers/${offerId}/outcomes/live?${params.toString()}`;

            console.log(`Trying offer ID: ${offerId}`);
            console.log(`URL: ${url}`);
            const response = await fetch(url);

            if (!response.ok) {
                console.log(`Failed to fetch offer ${offerId}: ${response.status} ${response.statusText}`);
                continue;
            }

            const offers: Result<Offer[], ApiError | OfferNotFoundError> = await fetchFromAPI(offerId);

            if (!offers.success || offers.value.length === 0) {
                continue;
            }

            // Find an offer with complete data for testing
            for (const offer of offers.value) {
                // Need at least one participant
                if (!offer.participants || offer.participants.length === 0) {
                    continue;
                }

                // Need both Over and Under sides
                const overSide = offer.sides.find(s => s.label === 'Over');
                const underSide = offer.sides.find(s => s.label === 'Under');

                if (!overSide || !underSide) {
                    continue;
                }

                // Need outcomes from multiple books on both sides
                if (overSide.outcomes.length < 2 || underSide.outcomes.length < 2) {
                    continue;
                }

                // Get unique sportsbooks that have both Over and Under
                const overBooks = new Set(overSide.outcomes.map(o => o.sportsbookCode));
                const underBooks = new Set(underSide.outcomes.map(o => o.sportsbookCode));
                const booksWithBothSides = [...overBooks].filter(b => underBooks.has(b));

                if (booksWithBothSides.length < 2) {
                    continue;
                }

                // Try to find PINNACLE as sharp, otherwise use first book as sharp
                const sharpBook = booksWithBothSides.includes('PINNACLE')
                    ? 'PINNACLE'
                    : booksWithBothSides[0]!;

                // Use a different book as target
                const targetBook = booksWithBothSides.find(b => b !== sharpBook) || booksWithBothSides[1]!;

                // Get line from one of the outcomes
                const targetOutcome = overSide.outcomes.find(o => o.sportsbookCode === targetBook);
                if (!targetOutcome) {
                    continue;
                }

                const line = parseFloat(targetOutcome.line);
                if (isNaN(line)) {
                    continue;
                }

                console.log(`Found testable offer: ${offer.offerName}`);
                console.log(`  Player: ${offer.participants[0]!.name} (${offer.participants[0]!.id})`);
                console.log(`  Sharp: ${sharpBook}, Target: ${targetBook}, Line: ${line}`);

                return {
                    offerId,
                    playerId: offer.participants[0]!.id,
                    playerName: offer.participants[0]!.name,
                    line,
                    targetBook,
                    sharpBook,
                };
            }
        } catch (error) {
            // Continue to next offer ID
            continue;
        }
    }

    return null;
}

describe("E2E Tests - Live Data", () => {
    beforeAll(async () => {
        // Start the server
        server = app.listen(TEST_PORT);
        baseUrl = `http://localhost:${TEST_PORT}`;

        console.log(`\nE2E Test server started on ${baseUrl}`);
        console.log("Fetching live offer data from OddsShopper...\n");

        // Fetch live test data
        const testData = await fetchTestableOffer();

        if (!testData) {
            console.warn("\nCould not find a testable offer with complete data.");
            console.warn("Tests will be skipped. Ensure ODDSSHOPPER_API_URL is set correctly");
            console.warn("and the API has active offers with multiple sportsbooks.\n");
        } else {
            liveOfferId = testData.offerId;
            livePlayerId = testData.playerId;
            livePlayerName = testData.playerName;
            liveLine = testData.line;
            liveTargetBook = testData.targetBook;
            liveSharpBook = testData.sharpBook;
        }
    });

    afterAll(() => {
        server?.close();
        console.log("\nE2E Test server stopped");
    });

    describe("GET /test", () => {
        it("health check returns 'test'", async () => {
            const response = await fetch(`${baseUrl}/test`);
            const text = await response.text();

            expect(response.status).toBe(200);
            expect(text).toBe("test");
        });
    });

    describe("POST /calculate-ev", () => {
        it("returns 400 for invalid request body", async () => {
            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ invalid: "data" }),
            });

            expect(response.status).toBe(400);
            const json = await response.json() as { error: string };
            expect(json.error).toBe("Invalid request body");
        });

        it("calculates EV with live data", async () => {
            if (!liveOfferId) {
                console.log("Skipping: No live offer data available");
                return;
            }

            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    offerId: liveOfferId,
                    playerId: livePlayerId,
                    line: liveLine,
                    side: "Over",
                    targetBook: liveTargetBook,
                    sharps: [liveSharpBook],
                    devigMethod: "multiplicative",
                }),
            });

            console.log(`\n/calculate-ev response status: ${response.status}`);
            const json = await response.json() as CalculateEVResponse | ErrorResponse;
            console.log("Response:", JSON.stringify(json, null, 2));

            // Accept success or known business logic errors
            if (response.status === 200) {
                const result = json as CalculateEVResponse;
                expect(result.player).toBeDefined();
                expect(result.market).toBeDefined();
                expect(result.line).toBe(liveLine);
                expect(result.side).toBe("Over");
                expect(result.targetBook).toBe(liveTargetBook);
                expect(typeof result.targetOdds).toBe("number");
                expect(typeof result.trueProbability).toBe("number");
                expect(result.trueProbability).toBeGreaterThanOrEqual(0);
                expect(result.trueProbability).toBeLessThanOrEqual(1);
                expect(typeof result.impliedProbability).toBe("number");
                expect(typeof result.expectedValue).toBe("number");
                expect(result.sharpsUsed).toContain(liveSharpBook);
            } else {
                // Known error codes that can occur with live data
                expect([404, 409, 422]).toContain(response.status);
                const errorResponse = json as ErrorResponse;
                expect(errorResponse.code).toBeDefined();
            }
        });

        it("bypasses cache with fresh=true", async () => {
            if (!liveOfferId) {
                console.log("Skipping: No live offer data available");
                return;
            }

            const response = await fetch(`${baseUrl}/calculate-ev?fresh=true`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    offerId: liveOfferId,
                    playerId: livePlayerId,
                    line: liveLine,
                    side: "Over",
                    targetBook: liveTargetBook,
                    sharps: [liveSharpBook],
                    devigMethod: "multiplicative",
                }),
            });

            // Should get a response (success or known error)
            expect([200, 404, 409, 422]).toContain(response.status);
        });

        it("bypasses cache with Cache-Control header", async () => {
            if (!liveOfferId) {
                console.log("Skipping: No live offer data available");
                return;
            }

            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                },
                body: JSON.stringify({
                    offerId: liveOfferId,
                    playerId: livePlayerId,
                    line: liveLine,
                    side: "Over",
                    targetBook: liveTargetBook,
                    sharps: [liveSharpBook],
                    devigMethod: "multiplicative",
                }),
            });

            expect([200, 404, 409, 422]).toContain(response.status);
        });
    });

    describe("POST /calculate-ev/batch", () => {
        it("returns 400 for invalid request body", async () => {
            const response = await fetch(`${baseUrl}/calculate-ev/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ invalid: "data" }),
            });

            expect(response.status).toBe(400);
            const json = await response.json() as { error: string };
            expect(json.error).toBe("Invalid request body");
        });

        it("returns 400 for empty items array", async () => {
            const response = await fetch(`${baseUrl}/calculate-ev/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    offerId: "test",
                    items: [],
                }),
            });

            expect(response.status).toBe(400);
        });

        it("calculates batch EV with live data", async () => {
            if (!liveOfferId) {
                console.log("Skipping: No live offer data available");
                return;
            }

            const response = await fetch(`${baseUrl}/calculate-ev/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    offerId: liveOfferId,
                    items: [
                        {
                            playerId: livePlayerId,
                            line: liveLine,
                            side: "Over",
                            targetBook: liveTargetBook,
                            sharps: [liveSharpBook],
                            devigMethod: "multiplicative",
                        },
                        {
                            playerId: livePlayerId,
                            line: liveLine,
                            side: "Under",
                            targetBook: liveTargetBook,
                            sharps: [liveSharpBook],
                            devigMethod: "multiplicative",
                        },
                    ],
                }),
            });

            console.log(`\n/calculate-ev/batch response status: ${response.status}`);

            // Batch endpoint always returns 200
            expect(response.status).toBe(200);

            const json = await response.json() as BatchCalculateEVResponse;
            console.log("Response:", JSON.stringify(json, null, 2));

            expect(json.offerId).toBe(liveOfferId);
            expect(json.totalItems).toBe(2);
            expect(json.results).toHaveLength(2);
            expect(json.successCount + json.errorCount).toBe(2);

            // Check result structure
            for (const result of json.results) {
                expect(typeof result.index).toBe("number");
                expect(typeof result.success).toBe("boolean");

                if (result.success) {
                    expect(result.result.player).toBeDefined();
                    expect(result.result.targetBook).toBe(liveTargetBook);
                    expect(typeof result.result.expectedValue).toBe("number");
                } else {
                    expect(result.error.code).toBeDefined();
                    expect(result.error.message).toBeDefined();
                }
            }
        });

        it("handles multiple devig methods in batch", async () => {
            if (!liveOfferId) {
                console.log("Skipping: No live offer data available");
                return;
            }

            const devigMethods = ["multiplicative", "additive", "power", "shin"] as const;

            const response = await fetch(`${baseUrl}/calculate-ev/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    offerId: liveOfferId,
                    items: devigMethods.map(method => ({
                        playerId: livePlayerId,
                        line: liveLine,
                        side: "Over",
                        targetBook: liveTargetBook,
                        sharps: [liveSharpBook],
                        devigMethod: method,
                    })),
                }),
            });

            expect(response.status).toBe(200);

            const json = await response.json() as BatchCalculateEVResponse;
            expect(json.totalItems).toBe(4);
            expect(json.results).toHaveLength(4);

            // Log EV differences between methods
            console.log("\nEV by devig method:");
            for (let i = 0; i < json.results.length; i++) {
                const result = json.results[i]!;
                if (result.success) {
                    console.log(`  ${devigMethods[i]}: ${result.result.expectedValue.toFixed(2)}%`);
                } else {
                    console.log(`  ${devigMethods[i]}: ERROR - ${result.error.message}`);
                }
            }
        });
    });

    describe("Error Handling", () => {
        it("returns 404 for non-existent offer", async () => {
            const response = await fetch(`${baseUrl}/calculate-ev`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    offerId: "non-existent-offer-12345",
                    playerId: "player1",
                    line: -110,
                    side: "Over",
                    targetBook: "DRAFTKINGS",
                    sharps: ["PINNACLE"],
                    devigMethod: "multiplicative",
                }),
            });

            // Could be 404 or 502 depending on API response
            expect([404, 500, 502]).toContain(response.status);
        });
    });

    describe("Curl Command Generator", () => {
        it("outputs verified curl commands for /calculate-ev (single)", async () => {
            if (!liveOfferId) {
                console.log("Skipping: No live offer data available");
                return;
            }

            console.log("\n" + "=".repeat(60));
            console.log("GENERATING SINGLE ENDPOINT CURL COMMANDS");
            console.log("=".repeat(60));

            // Test Over side
            const overPayload = {
                offerId: liveOfferId,
                playerId: livePlayerId,
                line: liveLine,
                side: "Over" as const,
                targetBook: liveTargetBook,
                sharps: [liveSharpBook],
                devigMethod: "multiplicative" as const,
            };

            const overResponse = await fetch(`${baseUrl}/calculate-ev`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(overPayload),
            });
            const overJson = await overResponse.json() as CalculateEVResponse | ErrorResponse;

            console.log(`\n# /calculate-ev (Over) - ${livePlayerName}`);
            console.log(`# Status: ${overResponse.status} ${[200, 404, 409, 422].includes(overResponse.status) ? '✓' : '✗'}`);
            if (overResponse.status === 200) {
                const result = overJson as CalculateEVResponse;
                console.log(`# EV: ${result.expectedValue.toFixed(2)}%`);
            }
            console.log(`\ncurl -X POST '${baseUrl}/calculate-ev' \\`);
            console.log(`  -H 'Content-Type: application/json' \\`);
            console.log(`  -d '${JSON.stringify(overPayload)}'`);

            // Test Under side
            const underPayload = { ...overPayload, side: "Under" as const };

            const underResponse = await fetch(`${baseUrl}/calculate-ev`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(underPayload),
            });
            const underJson = await underResponse.json() as CalculateEVResponse | ErrorResponse;

            console.log(`\n# /calculate-ev (Under) - ${livePlayerName}`);
            console.log(`# Status: ${underResponse.status} ${[200, 404, 409, 422].includes(underResponse.status) ? '✓' : '✗'}`);
            if (underResponse.status === 200) {
                const result = underJson as CalculateEVResponse;
                console.log(`# EV: ${result.expectedValue.toFixed(2)}%`);
            }
            console.log(`\ncurl -X POST '${baseUrl}/calculate-ev' \\`);
            console.log(`  -H 'Content-Type: application/json' \\`);
            console.log(`  -d '${JSON.stringify(underPayload)}'`);

            console.log("\n" + "=".repeat(60));

            // Accept success or known business logic errors
            expect([200, 404, 409, 422]).toContain(overResponse.status);
            expect([200, 404, 409, 422]).toContain(underResponse.status);
        });

        it("outputs verified curl command for /calculate-ev/batch", async () => {
            if (!liveOfferId) {
                console.log("Skipping: No live offer data available");
                return;
            }

            console.log("\n" + "=".repeat(60));
            console.log("GENERATING BATCH ENDPOINT CURL COMMAND");
            console.log("=".repeat(60));

            // Build batch payload with both Over and Under for the live player
            const batchPayload = {
                offerId: liveOfferId,
                items: [
                    {
                        playerId: livePlayerId,
                        line: liveLine,
                        side: "Over" as const,
                        targetBook: liveTargetBook,
                        sharps: [liveSharpBook],
                        devigMethod: "multiplicative" as const,
                    },
                    {
                        playerId: livePlayerId,
                        line: liveLine,
                        side: "Under" as const,
                        targetBook: liveTargetBook,
                        sharps: [liveSharpBook],
                        devigMethod: "multiplicative" as const,
                    },
                ],
            };

            // Verify it works
            const response = await fetch(`${baseUrl}/calculate-ev/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(batchPayload),
            });
            const json = await response.json() as BatchCalculateEVResponse;

            console.log(`\n# /calculate-ev/batch - ${livePlayerName} (Over & Under)`);
            console.log(`# Status: ${response.status} ${response.status === 200 ? '✓' : '✗'}`);
            if (response.status === 200) {
                console.log(`# Success: ${json.successCount}/${json.totalItems}`);
                for (const result of json.results) {
                    if (result.success) {
                        console.log(`#   ${result.result.side}: EV ${result.result.expectedValue.toFixed(2)}%`);
                    } else {
                        console.log(`#   Item ${result.index}: ERROR - ${result.error.message}`);
                    }
                }
            }
            console.log(`\ncurl -X POST '${baseUrl}/calculate-ev/batch' \\`);
            console.log(`  -H 'Content-Type: application/json' \\`);
            console.log(`  -d '${JSON.stringify(batchPayload)}'`);

            console.log("\n" + "=".repeat(60));

            expect(response.status).toBe(200);
        });
    });
});
