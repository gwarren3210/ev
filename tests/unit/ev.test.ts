import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  hasCompleteMarket,
  findSpecificOffer,
  findAvailableSharpBooks,
  findTargetOutcomes,
  calculateAverageTrueProbability,
  calculateEV,
  calculateEVFromOffer,
  extractAmericanOdds,
  findBestOddsAcrossBooks,
} from "../../src/logic/ev";
import { mock } from "bun:test";
import { resetRedisState } from "../../src/cache/redis";
import { devigOdds } from "../../src/logic/devig";
import {
  CalculationError,
  OfferNotFoundError,
  OfferNotFoundForPlayerError,
  ApiError,
  NoSharpOutcomesError,
  TargetOutcomeNotFoundError,
  TargetOutcomeNotCompleteError,
  DevigError,
  OneSidedMarketError,
} from "../../src/errors";
import { calculateEVPercentage } from "../../src/utils/odds";

import type { Outcome } from '../src/types';

// Helper to create mock outcomes
function createOutcome(overrides: Partial<Outcome> = {}): Outcome {
  return {
    id: "1",
    displayLabel: "Test",
    americanOdds: "+100",
    bestHoldOutcome: false,
    odds: 0.5,
    line: "5.5",
    label: "Over",
    sportsbookCode: "PINNACLE",
    sportsbookLogo: "",
    participantLogo: "",
    participantType: "",
    title: "Test",
    hashCodeBetSideWithLine: "hash",
    hashCode: "hash",
    ...overrides,
  } as Outcome;
}

// Helper to create mock offer
function createOffer(overrides = {}) {
  return {
    eventName: "Test Event",
    tournamentName: "Test Tournament",
    offerName: "Test Offer",
    startDate: new Date().toISOString(),
    dateString: "Today",
    hold: 0.05,
    sportsbooks: ["PINNACLE", "DRAFTKINGS"],
    participants: [{ id: "player1", name: "Test Player", title: "", isHome: true, participantLogo: "", participantType: "" }],
    sides: [],
    ...overrides,
  };
}

// ==========================================
// calculateEV tests
// ==========================================
describe("calculateEVPercentage", () => {
  it("returns -100% when probability is zero", () => {
    const result = calculateEVPercentage(0, 2.0);
    expect(result).toBe(-100);
  });

  it("returns correct EV for 100% probability", () => {
    // EV = (1.0 * 2.0 - 1) * 100 = 100%
    const result = calculateEVPercentage(1.0, 2.0);
    expect(result).toBe(100);
  });

  it("returns correct EV for typical odds", () => {
    // 50% probability at 2.0 odds: (0.5 * 2.0 - 1) * 100 = 0%
    const result = calculateEVPercentage(0.5, 2.0);
    expect(result).toBe(0);
  });

  it("returns positive EV when probability exceeds implied odds", () => {
    // 60% probability at 2.0 odds: (0.6 * 2.0 - 1) * 100 = 20%
    const result = calculateEVPercentage(0.6, 2.0);
    expect(result).toBeCloseTo(20);
  });

  it("returns negative EV when probability is below implied odds", () => {
    // 40% probability at 2.0 odds: (0.4 * 2.0 - 1) * 100 = -20%
    const result = calculateEVPercentage(0.4, 2.0);
    expect(result).toBeCloseTo(-20);
  });

  it("handles probability > 1 (invalid but should compute)", () => {
    // 1.5 * 2.0 - 1 = 2 => 200%
    const result = calculateEVPercentage(1.5, 2.0);
    expect(result).toBe(200);
  });

  it("handles negative probability (invalid but should compute)", () => {
    // -0.5 * 2.0 - 1 = -2 => -200%
    const result = calculateEVPercentage(-0.5, 2.0);
    expect(result).toBe(-200);
  });

  it("handles odds = 1 (break-even odds)", () => {
    // 0.5 * 1.0 - 1 = -0.5 => -50%
    const result = calculateEVPercentage(0.5, 1.0);
    expect(result).toBe(-50);
  });

  it("handles very high odds (long shot)", () => {
    // 10% probability at 15.0 odds: (0.1 * 15.0 - 1) * 100 = 50%
    const result = calculateEVPercentage(0.1, 15.0);
    expect(result).toBeCloseTo(50);
  });

  it("handles very low odds (heavy favorite)", () => {
    // 90% probability at 1.05 odds: (0.9 * 1.05 - 1) * 100 = -5.5%
    const result = calculateEVPercentage(0.9, 1.05);
    expect(result).toBeCloseTo(-5.5);
  });

  it("handles extreme long shot odds", () => {
    // 1% probability at 150.0 odds: (0.01 * 150.0 - 1) * 100 = 50%
    const result = calculateEVPercentage(0.01, 150.0);
    expect(result).toBeCloseTo(50);
  });
});

// ==========================================
// devigOdds tests
// ==========================================
describe("devigOdds", () => {
  it("returns DevigError when label outcome not found", () => {
    const outcomes = [createOutcome({ label: "Under", odds: 0.5 })];
    const result = devigOdds(outcomes, "Over");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DevigError);
    }
  });

  it("returns DevigError when opposite outcome not found", () => {
    const outcomes = [createOutcome({ label: "Over", odds: 0.5 })];
    const result = devigOdds(outcomes, "Over");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DevigError);
    }
  });

  it("returns DevigError when both outcomes missing", () => {
    const outcomes: Outcome[] = [];
    const result = devigOdds(outcomes, "Over");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DevigError);
    }
  });

  it("returns DevigError when total odds is zero", () => {
    const outcomes = [
      createOutcome({ label: "Over", odds: 0 }),
      createOutcome({ label: "Under", odds: 0 }),
    ];
    const result = devigOdds(outcomes, "Over");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("zero");
    }
  });

  it("returns correct probability for valid pair", () => {
    const outcomes = [
      createOutcome({ label: "Over", odds: 0.6 }),
      createOutcome({ label: "Under", odds: 0.4 }),
    ];
    const result = devigOdds(outcomes, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(0.6); // 0.6 / (0.6 + 0.4)
    }
  });

  it("returns correct probability for under side", () => {
    const outcomes = [
      createOutcome({ label: "Over", odds: 0.6 }),
      createOutcome({ label: "Under", odds: 0.4 }),
    ];
    const result = devigOdds(outcomes, "Under");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(0.4); // 0.4 / (0.6 + 0.4)
    }
  });

  it("handles equal odds (50/50)", () => {
    const outcomes = [
      createOutcome({ label: "Over", odds: 0.5 }),
      createOutcome({ label: "Under", odds: 0.5 }),
    ];
    const result = devigOdds(outcomes, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(0.5);
    }
  });

  it("handles very high odds (long shot)", () => {
    const outcomes = [
      createOutcome({ label: "Over", odds: 0.01 }),
      createOutcome({ label: "Under", odds: 0.99 }),
    ];
    const result = devigOdds(outcomes, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(0.01); // 0.01 / 1.0
    }
  });

  it("handles very low odds (heavy favorite)", () => {
    const outcomes = [
      createOutcome({ label: "Over", odds: 0.99 }),
      createOutcome({ label: "Under", odds: 0.01 }),
    ];
    const result = devigOdds(outcomes, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(0.99); // 0.99 / 1.0
    }
  });
});

// ==========================================
// hasCompleteMarket tests
// ==========================================
describe("hasCompleteMarket", () => {
  it("returns false for empty sides array", () => {
    const result = hasCompleteMarket([], "PINNACLE");
    expect(result).toBe(false);
  });

  it("returns false when only Over exists", () => {
    const outcomes = [createOutcome({ sportsbookCode: "PINNACLE", label: "Over" })];
    const result = hasCompleteMarket(outcomes, "PINNACLE");
    expect(result).toBe(false);
  });

  it("returns false when only Under exists", () => {
    const outcomes = [createOutcome({ sportsbookCode: "PINNACLE", label: "Under" })];
    const result = hasCompleteMarket(outcomes, "PINNACLE");
    expect(result).toBe(false);
  });

  it("returns true when both Over and Under exist", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE", label: "Over" }),
      createOutcome({ sportsbookCode: "PINNACLE", label: "Under" }),
    ];
    const result = hasCompleteMarket(outcomes, "PINNACLE");
    expect(result).toBe(true);
  });

  it("returns false when sportsbook does not match", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE", label: "Over" }),
      createOutcome({ sportsbookCode: "PINNACLE", label: "Under" }),
    ];
    const result = hasCompleteMarket(outcomes, "DRAFTKINGS");
    expect(result).toBe(false);
  });

  it("handles sides with other labels (ignores non-Over/Under)", () => {
    const outcomes = [createOutcome({ sportsbookCode: "PINNACLE", label: "MoneyLine" as any })];
    const result = hasCompleteMarket(outcomes, "PINNACLE");
    expect(result).toBe(false);
  });
});

// ==========================================
// findSpecificOffer tests
// ==========================================
describe("findSpecificOffer", () => {
  it("returns OfferNotFoundForPlayerError for empty offers array", () => {
    const result = findSpecificOffer([], "player1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OfferNotFoundForPlayerError);
    }
  });

  it("returns OfferNotFoundForPlayerError when playerId not found", () => {
    const offers = [createOffer({ participants: [{ id: "player1", name: "Test", title: "", isHome: true, participantLogo: "", participantType: "" }] })];
    const result = findSpecificOffer(offers, "player999");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OfferNotFoundForPlayerError);
    }
  });

  it("returns the offer when playerId matches", () => {
    const offer = createOffer({ participants: [{ id: "player1", name: "Test Player", title: "", isHome: true, participantLogo: "", participantType: "" }] });
    const result = findSpecificOffer([offer], "player1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(offer);
    }
  });

  it("returns first match when multiple offers have same player", () => {
    const offer1 = createOffer({ offerName: "Offer1", participants: [{ id: "player1", name: "Test", title: "", isHome: true, participantLogo: "", participantType: "" }] });
    const offer2 = createOffer({ offerName: "Offer2", participants: [{ id: "player1", name: "Test", title: "", isHome: true, participantLogo: "", participantType: "" }] });
    const result = findSpecificOffer([offer1, offer2], "player1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.offerName).toBe("Offer1");
    }
  });

  it("uses strict equality for player ID matching", () => {
    const offer = createOffer({ participants: [{ id: "123", name: "Test", title: "", isHome: true, participantLogo: "", participantType: "" }] });
    // Code uses === so types must match exactly
    const result = findSpecificOffer([offer], "123");
    expect(result.success).toBe(true);
  });

  it("returns error when participant array is empty", () => {
    const offer = createOffer({ participants: [] });
    const result = findSpecificOffer([offer], "player1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OfferNotFoundForPlayerError);
    }
  });
});

// ==========================================
// findAvailableSharpBooks tests
// ==========================================
describe("findAvailableSharpBooks", () => {
  it("returns NoSharpOutcomesError for empty sharps array", () => {
    const outcomes = [createOutcome({ sportsbookCode: "PINNACLE" })];
    const result = findAvailableSharpBooks(outcomes, []);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NoSharpOutcomesError);
    }
  });

  it("returns NoSharpOutcomesError when no sharp books in outcomes", () => {
    const outcomes = [createOutcome({ sportsbookCode: "DRAFTKINGS" })];
    const result = findAvailableSharpBooks(outcomes, ["PINNACLE"]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NoSharpOutcomesError);
    }
  });

  it("excludes sharp book with only one side", () => {
    const outcomes = [createOutcome({ sportsbookCode: "PINNACLE", label: "Over" })];
    const result = findAvailableSharpBooks(outcomes, ["PINNACLE"]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NoSharpOutcomesError);
    }
  });

  it("returns sharp books that have both sides", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE", label: "Over" }),
      createOutcome({ sportsbookCode: "PINNACLE", label: "Under" }),
    ];
    const result = findAvailableSharpBooks(outcomes, ["PINNACLE"]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("PINNACLE");
    }
  });

  it("returns multiple valid sharps", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE", label: "Over" }),
      createOutcome({ sportsbookCode: "PINNACLE", label: "Under" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Under" }),
    ];
    const result = findAvailableSharpBooks(outcomes, ["PINNACLE", "BETMGM"]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("PINNACLE");
      expect(result.value).toContain("BETMGM");
    }
  });

  it("filters out sharps without both sides while keeping valid ones", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE", label: "Over" }),
      createOutcome({ sportsbookCode: "PINNACLE", label: "Under" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over" }),
    ];
    const result = findAvailableSharpBooks(outcomes, ["PINNACLE", "BETMGM"]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toContain("PINNACLE");
      expect(result.value).not.toContain("BETMGM");
    }
  });
});

// ==========================================
// findTargetOutcomes tests
// ==========================================
describe("findTargetOutcomes", () => {
  it("returns TargetOutcomeNotFoundError for empty outcomes", () => {
    const result = findTargetOutcomes([], "DRAFTKINGS");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(TargetOutcomeNotFoundError);
    }
  });

  it("returns error when only 1 outcome from target book", () => {
    const outcomes = [createOutcome({ sportsbookCode: "DRAFTKINGS" })];
    const result = findTargetOutcomes(outcomes, "DRAFTKINGS");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(TargetOutcomeNotCompleteError);
    }
  });

  it("returns error when more than 2 outcomes from target book", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", id: "1" }),
      createOutcome({ sportsbookCode: "DRAFTKINGS", id: "2" }),
      createOutcome({ sportsbookCode: "DRAFTKINGS", id: "3" }),
    ];
    const result = findTargetOutcomes(outcomes, "DRAFTKINGS");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(TargetOutcomeNotCompleteError);
    }
  });

  it("returns success when exactly 2 outcomes from target book", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over" }),
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under" }),
    ];
    const result = findTargetOutcomes(outcomes, "DRAFTKINGS");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.length).toBe(2);
    }
  });

  it("returns error when no outcomes from target book", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE" }),
      createOutcome({ sportsbookCode: "BETMGM" }),
    ];
    const result = findTargetOutcomes(outcomes, "DRAFTKINGS");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(TargetOutcomeNotFoundError);
    }
  });

  it("filters correctly among mixed sportsbooks", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE", label: "Over" }),
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over" }),
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over" }),
    ];
    const result = findTargetOutcomes(outcomes, "DRAFTKINGS");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.length).toBe(2);
      expect(result.value.every((o: Outcome) => o.sportsbookCode === "DRAFTKINGS")).toBe(true);
    }
  });
});

// ==========================================
// calculateAverageTrueProbability tests
// ==========================================
describe("calculateAverageTrueProbability", () => {
  it("returns DevigError for empty sharps array", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.5 }),
      createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.5 }),
    ];
    const result = calculateAverageTrueProbability(outcomes, [], "Over", "multiplicative");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DevigError);
    }
  });

  it("returns DevigError when no outcomes match any sharp", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", odds: 0.5 }),
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under", odds: 0.5 }),
    ];
    const result = calculateAverageTrueProbability(outcomes, ["PINNACLE"], "Over", "multiplicative");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DevigError);
    }
  });

  it("returns average when all sharps succeed", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.6 }),
      createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.4 }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over", odds: 0.5 }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Under", odds: 0.5 }),
    ];
    const result = calculateAverageTrueProbability(outcomes, ["PINNACLE", "BETMGM"], "Over", "multiplicative");
    expect(result.success).toBe(true);
    if (result.success) {
      // PINNACLE: 0.6/1.0 = 0.6, BETMGM: 0.5/1.0 = 0.5, avg = 0.55
      expect(result.value).toBe(0.55);
    }
  });

  it("returns average of successful devigs when some fail", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.6 }),
      createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.4 }),
      // BETMGM only has over, will fail devig
      createOutcome({ sportsbookCode: "BETMGM", label: "Over", odds: 0.5 }),
    ];
    const result = calculateAverageTrueProbability(outcomes, ["PINNACLE", "BETMGM"], "Over", "multiplicative");
    expect(result.success).toBe(true);
    if (result.success) {
      // Only PINNACLE succeeds: 0.6/1.0 = 0.6
      expect(result.value).toBe(0.6);
    }
  });

  it("returns probability from single sharp book", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.7 }),
      createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.3 }),
    ];
    const result = calculateAverageTrueProbability(outcomes, ["PINNACLE"], "Over", "multiplicative");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(0.7);
    }
  });

  it("handles under label correctly", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.6 }),
      createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.4 }),
    ];
    const result = calculateAverageTrueProbability(outcomes, ["PINNACLE"], "Under", "multiplicative");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(0.4);
    }
  });
});

// ==========================================
// Error Classes tests
// ==========================================
describe("CalculationError", () => {
  it("instantiates with message and code", () => {
    const error = new CalculationError("Test error", "TEST_CODE");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("CalculationError");
  });

  it("extends Error", () => {
    const error = new CalculationError("Test", "CODE");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("OfferNotFoundError", () => {
  it("formats message with offerId", () => {
    const error = new OfferNotFoundError("offer123");
    expect(error.message).toContain("offer123");
    expect(error.code).toBe("OFFER_NOT_FOUND");
    expect(error.name).toBe("OfferNotFoundError");
  });

  it("extends CalculationError", () => {
    const error = new OfferNotFoundError("id");
    expect(error).toBeInstanceOf(CalculationError);
  });
});

describe("OfferNotFoundForPlayerError", () => {
  it("formats message with playerId", () => {
    const error = new OfferNotFoundForPlayerError("player123");
    expect(error.message).toContain("player123");
    expect(error.code).toBe("OFFER_NOT_FOUND_FOR_PLAYER");
    expect(error.name).toBe("OfferNotFoundForPlayerError");
  });

  it("extends CalculationError", () => {
    const error = new OfferNotFoundForPlayerError("player1");
    expect(error).toBeInstanceOf(CalculationError);
  });
});

describe("ApiError", () => {
  it("instantiates with message and optional statusCode", () => {
    const error = new ApiError("API failed", 500);
    expect(error.message).toBe("API failed");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("API_ERROR");
    expect(error.name).toBe("ApiError");
  });

  it("works without statusCode", () => {
    const error = new ApiError("API failed");
    expect(error.statusCode).toBeUndefined();
    expect(error.code).toBe("API_ERROR");
  });

  it("extends CalculationError", () => {
    const error = new ApiError("msg");
    expect(error).toBeInstanceOf(CalculationError);
  });
});

describe("NoSharpOutcomesError", () => {
  it("formats message with sharps array", () => {
    const error = new NoSharpOutcomesError(["PINNACLE", "BETMGM"]);
    expect(error.message).toContain("PINNACLE");
    expect(error.message).toContain("BETMGM");
    expect(error.code).toBe("NO_SHARP_OUTCOMES");
    expect(error.name).toBe("NoSharpOutcomesError");
  });

  it("extends CalculationError", () => {
    const error = new NoSharpOutcomesError([]);
    expect(error).toBeInstanceOf(CalculationError);
  });
});

describe("TargetOutcomeNotFoundError", () => {
  it("formats message with targetBook", () => {
    const error = new TargetOutcomeNotFoundError("DRAFTKINGS");
    expect(error.message).toContain("DRAFTKINGS");
    expect(error.code).toBe("TARGET_OUTCOME_NOT_FOUND");
    expect(error.name).toBe("TargetOutcomeNotFoundError");
  });

  it("extends CalculationError", () => {
    const error = new TargetOutcomeNotFoundError("book");
    expect(error).toBeInstanceOf(CalculationError);
  });
});

describe("DevigError", () => {
  it("instantiates with message", () => {
    const error = new DevigError("Devig failed");
    expect(error.message).toBe("Devig failed");
    expect(error.code).toBe("DEVIG_ERROR");
    expect(error.name).toBe("DevigError");
  });

  it("extends CalculationError", () => {
    const error = new DevigError("msg");
    expect(error).toBeInstanceOf(CalculationError);
  });
});

// ==========================================
// calculateEV integration tests
// ==========================================
describe("calculateEV", () => {
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

  it("returns cached result when available (cache hit)", async () => {
    // Enable Redis for this test
    process.env.REDIS_URL = "redis://localhost:6379";

    const mockOffer = createOffer({
      participants: [{ id: "player1", name: "Test Player", title: "", isHome: true, participantLogo: "", participantType: "" }],
      sides: [
        {
          label: "Over",
          outcomes: [
            createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under", odds: 0.5, americanOdds: "-110", line: "5.5" }),
          ],
        },
      ],
    });

    global.fetch = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => [mockOffer],
    })) as any;

    const request = {
      offerId: "offer123",
      playerId: "player1",
      line: 5.5,
      side: "Over" as const,
      targetBook: "DRAFTKINGS",
      sharps: ["PINNACLE"],
      devigMethod: "multiplicative" as const,
    };

    // First call - should calculate and cache
    const result1 = await calculateEV(request);
    expect(result1.success).toBe(true);

    // Second call - should return cached result (line 46)
    const result2 = await calculateEV(request);
    expect(result2.success).toBe(true);
    if (result1.success && result2.success) {
      expect(result2.value).toEqual(result1.value);
    }
  });

  it("bypasses cache when skipCache is true", async () => {
    const mockOffer = createOffer({
      participants: [{ id: "player1", name: "Test Player", title: "", isHome: true, participantLogo: "", participantType: "" }],
      sides: [
        {
          label: "Over",
          outcomes: [
            createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under", odds: 0.5, americanOdds: "-110", line: "5.5" }),
          ],
        },
      ],
    });

    global.fetch = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => [mockOffer],
    })) as any;

    const request = {
      offerId: "offer123",
      playerId: "player1",
      line: 5.5,
      side: "Over" as const,
      targetBook: "DRAFTKINGS",
      sharps: ["PINNACLE"],
      devigMethod: "multiplicative" as const,
    };

    const result = await calculateEV(request, { skipCache: true });
    expect(result.success).toBe(true);
  });

  it("returns error when API fetch fails", async () => {
    global.fetch = mock(async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    })) as any;

    const request = {
      offerId: "offer123",
      playerId: "player1",
      line: -110,
      side: "Over" as const,
      targetBook: "DRAFTKINGS",
      sharps: ["PINNACLE"],
      devigMethod: "multiplicative" as const,
    };

    const result = await calculateEV(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ApiError);
    }
  });

  it("returns error when offer not found via API 404", async () => {
    global.fetch = mock(async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
    })) as any;

    const request = {
      offerId: "nonexistent",
      playerId: "player1",
      line: -110,
      side: "Over" as const,
      targetBook: "DRAFTKINGS",
      sharps: ["PINNACLE"],
      devigMethod: "multiplicative" as const,
    };

    const result = await calculateEV(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OfferNotFoundError);
    }
  });

  it("returns error when player not found in fetched offers (line 60)", async () => {
    // API succeeds but returns offers for different players
    const mockOffer = createOffer({
      participants: [{ id: "player999", name: "Different Player", title: "", isHome: true, participantLogo: "", participantType: "" }],
      sides: [],
    });

    global.fetch = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => [mockOffer],
    })) as any;

    const request = {
      offerId: "offer123",
      playerId: "player1", // Looking for player1 but API returns player999
      line: -110,
      side: "Over" as const,
      targetBook: "DRAFTKINGS",
      sharps: ["PINNACLE"],
      devigMethod: "multiplicative" as const,
    };

    const result = await calculateEV(request);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OfferNotFoundForPlayerError);
      expect(result.error.message).toContain("player1");
    }
  });
});

describe("calculateEVFromOffer", () => {
  it("returns error when target book has no outcomes at requested line", () => {
    const offer = createOffer({
      participants: [{ id: "player1", name: "Test Player", title: "", isHome: true, participantLogo: "", participantType: "" }],
      sides: [
        {
          outcomes: [
            createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", odds: 0.5, americanOdds: "-120", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under", odds: 0.5, americanOdds: "+100", line: "5.5" }),
          ],
        },
      ],
    });

    const request = {
      playerId: "player1",
      line: 6.5, // Request line doesn't match any outcome line (5.5)
      side: "Over" as const,
      targetBook: "DRAFTKINGS",
      sharps: ["PINNACLE"],
      devigMethod: "multiplicative" as const,
    };

    const result = calculateEVFromOffer(offer, request);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(TargetOutcomeNotFoundError);
      expect(result.error.message).toContain("not found");
    }
  });

  it("successfully calculates EV when all conditions are met", () => {
    const offer = createOffer({
      participants: [{ id: "player1", name: "Test Player", title: "", isHome: true, participantLogo: "", participantType: "" }],
      sides: [
        {
          outcomes: [
            createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under", odds: 0.5, americanOdds: "-110", line: "5.5" }),
          ],
        },
      ],
    });

    const request = {
      playerId: "player1",
      line: 5.5,
      side: "Over" as const,
      targetBook: "DRAFTKINGS",
      sharps: ["PINNACLE"],
      devigMethod: "multiplicative" as const,
    };

    const result = calculateEVFromOffer(offer, request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.player).toBe("Test Player");
      expect(result.value.targetOdds).toBe(-110);
    }
  });
});

describe("extractAmericanOdds", () => {
  it("returns error when outcome for side is missing", () => {
    const outcomes = [
      createOutcome({ label: "Under", americanOdds: "-110" }),
    ];

    const result = extractAmericanOdds(outcomes, "Over");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(CalculationError);
      expect(result.error.message).toContain("side missing");
    }
  });

  it("returns error when American odds are invalid (non-numeric)", () => {
    const outcomes = [
      createOutcome({ label: "Over", americanOdds: "invalid" }),
    ];

    const result = extractAmericanOdds(outcomes, "Over");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(CalculationError);
      expect(result.error.message).toContain("Invalid American odds");
    }
  });

  it("successfully extracts valid positive American odds", () => {
    const outcomes = [
      createOutcome({ label: "Over", americanOdds: "+150" }),
    ];

    const result = extractAmericanOdds(outcomes, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(150);
    }
  });

  it("successfully extracts valid negative American odds", () => {
    const outcomes = [
      createOutcome({ label: "Over", americanOdds: "-110" }),
    ];

    const result = extractAmericanOdds(outcomes, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(-110);
    }
  });

  it("handles odds without + or - prefix", () => {
    const outcomes = [
      createOutcome({ label: "Over", americanOdds: "100" }),
    ];

    const result = extractAmericanOdds(outcomes, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(100);
    }
  });
});

// ==========================================
// Kelly Criterion integration tests
// ==========================================
describe("calculateEVFromOffer with Kelly", () => {
  it("includes Kelly output when bankroll is provided", () => {
    const offer = createOffer({
      participants: [{ id: "player1", name: "Test Player", title: "", isHome: true, participantLogo: "", participantType: "" }],
      sides: [
        {
          outcomes: [
            // Sharp has 55% on Over, which should create positive EV
            createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.55, americanOdds: "-122", line: "5.5" }),
            createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.45, americanOdds: "+100", line: "5.5" }),
            // Target book offers even odds
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", odds: 0.5, americanOdds: "+100", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under", odds: 0.5, americanOdds: "-120", line: "5.5" }),
          ],
        },
      ],
    });

    const request = {
      playerId: "player1",
      line: 5.5,
      side: "Over" as const,
      targetBook: "DRAFTKINGS",
      sharps: ["PINNACLE"],
      devigMethod: "multiplicative" as const,
      bankroll: 10000,
    };

    const result = calculateEVFromOffer(offer, request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.kelly).toBeDefined();
      expect(result.value.kelly?.bankroll).toBe(10000);
      expect(result.value.kelly?.full).toBeGreaterThan(0);
      expect(result.value.kelly?.quarter).toBeCloseTo(result.value.kelly!.full * 0.25, 5);
      expect(result.value.kelly?.recommendedBet).toBeCloseTo(10000 * result.value.kelly!.quarter, 5);
      expect(result.value.kelly?.expectedProfit).toBeGreaterThan(0);
    }
  });

  it("excludes Kelly output when bankroll is not provided", () => {
    const offer = createOffer({
      participants: [{ id: "player1", name: "Test Player", title: "", isHome: true, participantLogo: "", participantType: "" }],
      sides: [
        {
          outcomes: [
            createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", odds: 0.5, americanOdds: "-110", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under", odds: 0.5, americanOdds: "-110", line: "5.5" }),
          ],
        },
      ],
    });

    const request = {
      playerId: "player1",
      line: 5.5,
      side: "Over" as const,
      targetBook: "DRAFTKINGS",
      sharps: ["PINNACLE"],
      devigMethod: "multiplicative" as const,
      // No bankroll
    };

    const result = calculateEVFromOffer(offer, request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.kelly).toBeUndefined();
    }
  });

  it("returns 0 recommended bet for negative EV bets", () => {
    const offer = createOffer({
      participants: [{ id: "player1", name: "Test Player", title: "", isHome: true, participantLogo: "", participantType: "" }],
      sides: [
        {
          outcomes: [
            // Sharp shows 40% on Over (negative EV at even odds)
            createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.4, americanOdds: "+150", line: "5.5" }),
            createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.6, americanOdds: "-150", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", odds: 0.5, americanOdds: "+100", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under", odds: 0.5, americanOdds: "-120", line: "5.5" }),
          ],
        },
      ],
    });

    const request = {
      playerId: "player1",
      line: 5.5,
      side: "Over" as const,
      targetBook: "DRAFTKINGS",
      sharps: ["PINNACLE"],
      devigMethod: "multiplicative" as const,
      bankroll: 10000,
    };

    const result = calculateEVFromOffer(offer, request);
    expect(result.success).toBe(true);
    if (result.success && result.value.kelly) {
      expect(result.value.kelly.full).toBe(0);
      expect(result.value.kelly.quarter).toBe(0);
      expect(result.value.kelly.recommendedBet).toBe(0);
      // Use toBeCloseTo to handle -0 vs 0 edge case
      expect(result.value.kelly.expectedProfit).toBeCloseTo(0, 5);
    }
  });

  it("calculates expectedProfit using expectedValue", () => {
    const offer = createOffer({
      participants: [{ id: "player1", name: "Test Player", title: "", isHome: true, participantLogo: "", participantType: "" }],
      sides: [
        {
          outcomes: [
            createOutcome({ sportsbookCode: "PINNACLE", label: "Over", odds: 0.6, americanOdds: "-150", line: "5.5" }),
            createOutcome({ sportsbookCode: "PINNACLE", label: "Under", odds: 0.4, americanOdds: "+130", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", odds: 0.5, americanOdds: "+100", line: "5.5" }),
            createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under", odds: 0.5, americanOdds: "-120", line: "5.5" }),
          ],
        },
      ],
    });

    const request = {
      playerId: "player1",
      line: 5.5,
      side: "Over" as const,
      targetBook: "DRAFTKINGS",
      sharps: ["PINNACLE"],
      devigMethod: "multiplicative" as const,
      bankroll: 10000,
    };

    const result = calculateEVFromOffer(offer, request);
    expect(result.success).toBe(true);
    if (result.success && result.value.kelly) {
      // expectedProfit = recommendedBet * (expectedValue / 100)
      const expectedProfit = result.value.kelly.recommendedBet * (result.value.expectedValue / 100);
      expect(result.value.kelly.expectedProfit).toBeCloseTo(expectedProfit, 5);
    }
  });
});

// ==========================================
// findBestOddsAcrossBooks tests
// ==========================================
describe("findBestOddsAcrossBooks", () => {
  it("returns error when no outcomes match line and side", () => {
    const outcomes: Outcome[] = [];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Over");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(CalculationError);
      expect(result.error.message).toContain("No outcomes found");
    }
  });

  it("returns error when outcomes exist but none match the specified line", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "+100", line: "5.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "+110", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 6.5, "Over"); // Different line
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("No outcomes found for line 6.5 Over");
    }
  });

  it("returns error when outcomes exist but none match the specified side", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "+100", line: "5.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "+110", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Under"); // Different side
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("No outcomes found for line 5.5 Under");
    }
  });

  it("returns the single matching outcome when only one exists", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "-110", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.sportsbookCode).toBe("DRAFTKINGS");
      expect(result.value.americanOdds).toBe(-110);
    }
  });

  it("returns best odds when comparing positive odds (+150 > +100)", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "+100", line: "5.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "+150", line: "5.5" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over", americanOdds: "+120", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.sportsbookCode).toBe("FANDUEL");
      expect(result.value.americanOdds).toBe(150);
    }
  });

  it("returns best odds when comparing negative odds (-105 > -110 > -120)", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "-110", line: "5.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "-120", line: "5.5" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over", americanOdds: "-105", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.sportsbookCode).toBe("BETMGM");
      expect(result.value.americanOdds).toBe(-105);
    }
  });

  it("returns best odds when comparing mixed positive and negative (+100 > -110)", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "-110", line: "5.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "+100", line: "5.5" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over", americanOdds: "-105", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.sportsbookCode).toBe("FANDUEL");
      expect(result.value.americanOdds).toBe(100);
    }
  });

  it("filters by line correctly when multiple lines exist", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "+200", line: "6.5" }), // Different line, better odds
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "+100", line: "5.5" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over", americanOdds: "+120", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.sportsbookCode).toBe("BETMGM");
      expect(result.value.americanOdds).toBe(120);
    }
  });

  it("filters by side correctly when both sides exist", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under", americanOdds: "+200", line: "5.5" }), // Different side, better odds
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "+100", line: "5.5" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over", americanOdds: "+120", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.sportsbookCode).toBe("BETMGM");
      expect(result.value.americanOdds).toBe(120);
    }
  });

  it("filters out outcomes with invalid (non-numeric) American odds", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "invalid", line: "5.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "+100", line: "5.5" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over", americanOdds: "N/A", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.sportsbookCode).toBe("FANDUEL");
      expect(result.value.americanOdds).toBe(100);
    }
  });

  it("returns error when all outcomes have invalid odds", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "invalid", line: "5.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "N/A", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Over");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("No outcomes found");
    }
  });

  it("works correctly for Under side", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Under", americanOdds: "-115", line: "5.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Under", americanOdds: "-105", line: "5.5" }),
      createOutcome({ sportsbookCode: "PINNACLE", label: "Under", americanOdds: "-110", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Under");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.sportsbookCode).toBe("FANDUEL");
      expect(result.value.americanOdds).toBe(-105);
    }
  });

  it("handles extreme positive odds correctly", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "+500", line: "10.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "+1000", line: "10.5" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over", americanOdds: "+750", line: "10.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 10.5, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.sportsbookCode).toBe("FANDUEL");
      expect(result.value.americanOdds).toBe(1000);
    }
  });

  it("handles extreme negative odds correctly", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "-500", line: "0.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "-400", line: "0.5" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over", americanOdds: "-450", line: "0.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 0.5, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.sportsbookCode).toBe("FANDUEL");
      expect(result.value.americanOdds).toBe(-400);
    }
  });

  it("handles decimal line values correctly", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "-110", line: "22.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "+100", line: "22.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 22.5, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.sportsbookCode).toBe("FANDUEL");
      expect(result.value.americanOdds).toBe(100);
    }
  });

  it("returns first book when multiple books have identical best odds", () => {
    const outcomes = [
      createOutcome({ sportsbookCode: "DRAFTKINGS", label: "Over", americanOdds: "+100", line: "5.5" }),
      createOutcome({ sportsbookCode: "FANDUEL", label: "Over", americanOdds: "+100", line: "5.5" }),
      createOutcome({ sportsbookCode: "BETMGM", label: "Over", americanOdds: "+100", line: "5.5" }),
    ];
    const result = findBestOddsAcrossBooks(outcomes, 5.5, "Over");
    expect(result.success).toBe(true);
    if (result.success) {
      // reduce() returns first element when all are equal
      expect(result.value.americanOdds).toBe(100);
      expect(["DRAFTKINGS", "FANDUEL", "BETMGM"]).toContain(result.value.sportsbookCode);
    }
  });
});
