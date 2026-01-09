import { describe, it, expect } from "bun:test";
import {
  hasCompleteMarket,
  findSpecificOffer,
  findAvailableSharpBooks,
  findTargetOutcomes,
  calculateAverageTrueProbability,
} from "../src/logic/ev";
import { devigOdds } from "../src/logic/devig";
import {
  CalculationError,
  OfferNotFoundError,
  ApiError,
  NoSharpOutcomesError,
  TargetOutcomeNotFoundError,
  TargetOutcomeNotCompleteError,
  DevigError,
  OneSidedMarketError,
} from "../src/errors";
import { calculateEVPercentage as calculateEV } from "../src/utils/odds";

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
describe("calculateEV", () => {
  it("returns -100% when probability is zero", () => {
    const result = calculateEV(0, 2.0);
    expect(result).toBe(-100);
  });

  it("returns correct EV for 100% probability", () => {
    // EV = (1.0 * 2.0 - 1) * 100 = 100%
    const result = calculateEV(1.0, 2.0);
    expect(result).toBe(100);
  });

  it("returns correct EV for typical odds", () => {
    // 50% probability at 2.0 odds: (0.5 * 2.0 - 1) * 100 = 0%
    const result = calculateEV(0.5, 2.0);
    expect(result).toBe(0);
  });

  it("returns positive EV when probability exceeds implied odds", () => {
    // 60% probability at 2.0 odds: (0.6 * 2.0 - 1) * 100 = 20%
    const result = calculateEV(0.6, 2.0);
    expect(result).toBeCloseTo(20);
  });

  it("returns negative EV when probability is below implied odds", () => {
    // 40% probability at 2.0 odds: (0.4 * 2.0 - 1) * 100 = -20%
    const result = calculateEV(0.4, 2.0);
    expect(result).toBeCloseTo(-20);
  });

  it("handles probability > 1 (invalid but should compute)", () => {
    // 1.5 * 2.0 - 1 = 2 => 200%
    const result = calculateEV(1.5, 2.0);
    expect(result).toBe(200);
  });

  it("handles negative probability (invalid but should compute)", () => {
    // -0.5 * 2.0 - 1 = -2 => -200%
    const result = calculateEV(-0.5, 2.0);
    expect(result).toBe(-200);
  });

  it("handles odds = 1 (break-even odds)", () => {
    // 0.5 * 1.0 - 1 = -0.5 => -50%
    const result = calculateEV(0.5, 1.0);
    expect(result).toBe(-50);
  });

  it("handles very high odds (long shot)", () => {
    // 10% probability at 15.0 odds: (0.1 * 15.0 - 1) * 100 = 50%
    const result = calculateEV(0.1, 15.0);
    expect(result).toBeCloseTo(50);
  });

  it("handles very low odds (heavy favorite)", () => {
    // 90% probability at 1.05 odds: (0.9 * 1.05 - 1) * 100 = -5.5%
    const result = calculateEV(0.9, 1.05);
    expect(result).toBeCloseTo(-5.5);
  });

  it("handles extreme long shot odds", () => {
    // 1% probability at 150.0 odds: (0.01 * 150.0 - 1) * 100 = 50%
    const result = calculateEV(0.01, 150.0);
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
  it("returns OfferNotFoundError for empty offers array", () => {
    const result = findSpecificOffer([], "player1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OfferNotFoundError);
    }
  });

  it("returns OfferNotFoundError when playerId not found", () => {
    const offers = [createOffer({ participants: [{ id: "player1", name: "Test", title: "", isHome: true, participantLogo: "", participantType: "" }] })];
    const result = findSpecificOffer(offers, "player999");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OfferNotFoundError);
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
      expect(result.error).toBeInstanceOf(OfferNotFoundError);
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
