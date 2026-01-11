import { describe, it, expect } from "bun:test";
import { devigOdds } from "../../src/logic/devig";
import type { Outcome } from "../../src/types";

function createOutcome(overrides: Partial<Outcome> = {}): Outcome {
    return {
        id: "1",
        label: "Over",
        odds: 0.5,
        ...overrides,
    } as Outcome;
}

describe("devigOdds Strategies", () => {
    const outcomes = [
        createOutcome({ label: "Over", odds: 0.55 }), // Implied 55%
        createOutcome({ label: "Under", odds: 0.55 }) // Implied 55%, Total 1.10
    ];

    it("calculates Multiplicative correctly", () => {
        // 0.55 / 1.10 = 0.5
        const result = devigOdds(outcomes, "Over", "multiplicative");
        expect(result.success).toBe(true);
        if (result.success) expect(result.value).toBeCloseTo(0.5);
    });

    it("calculates Additive correctly", () => {
        // Vig = 0.10. N=2. Additive: 0.55 - (0.10/2) = 0.55 - 0.05 = 0.5
        const result = devigOdds(outcomes, "Over", "additive");
        expect(result.success).toBe(true);
        if (result.success) expect(result.value).toBeCloseTo(0.5);
    });

    it("calculates Power correctly", () => {
        // (0.55)^k + (0.55)^k = 1 => 2 * (0.55)^k = 1 => (0.55)^k = 0.5 => k = log(0.5)/log(0.55) approx 1.159
        // True prob = (0.55)^k = 0.5
        const result = devigOdds(outcomes, "Over", "power");
        expect(result.success).toBe(true);
        if (result.success) expect(result.value).toBeCloseTo(0.5);
    });

    it("calculates OS Skewed correctly", () => {
        // Vig = 0.10.
        // Over: 0.55 - (0.65 * 0.10) = 0.55 - 0.065 = 0.485
        const result = devigOdds(outcomes, "Over", "osskewed");
        expect(result.success).toBe(true);
        if (result.success) expect(result.value).toBeCloseTo(0.485);

        // Under: 0.55 - (0.35 * 0.10) = 0.55 - 0.035 = 0.515
        const resultUnder = devigOdds(outcomes, "Under", "osskewed");
        expect(resultUnder.success).toBe(true);
        if (resultUnder.success) expect(resultUnder.value).toBeCloseTo(0.515);
    });

    it("calculates Shin correctly", () => {
        // 0.55, 0.55 -> Shin should resolve to 0.5 as well due to symmetry
        const result = devigOdds(outcomes, "Over", "shin");
        expect(result.success).toBe(true);
        if (result.success) expect(result.value).toBeCloseTo(0.5);
    });

    it("calculates OsSkewed with different input", () => {
        const skewedOutcomes = [
            createOutcome({ label: "Over", odds: 0.6 }),
            createOutcome({ label: "Under", odds: 0.5 })
            // Total 1.1. Vig 0.1.
            // Over: 0.6 - 0.065 = 0.535
            // Under: 0.5 - 0.035 = 0.465
        ];
        const result = devigOdds(skewedOutcomes, "Over", "osskewed");
        if (result.success) expect(result.value).toBeCloseTo(0.535);
    });
});
