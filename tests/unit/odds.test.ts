import { describe, it, expect } from "bun:test";
import { americanToDecimal, americanToProbability, calculateEVPercentage, calculateKellyFraction } from "../../src/utils/odds";

describe("americanToDecimal", () => {
    it("converts positive American odds correctly", () => {
        // +100 should be 2.0
        expect(americanToDecimal(100)).toBe(2.0);
        // +200 should be 3.0
        expect(americanToDecimal(200)).toBe(3.0);
        // +150 should be 2.5
        expect(americanToDecimal(150)).toBe(2.5);
    });

    it("converts negative American odds correctly", () => {
        // -100 should be 2.0
        expect(americanToDecimal(-100)).toBe(2.0);
        // -110 should be ~1.909
        expect(americanToDecimal(-110)).toBeCloseTo(1.909, 3);
        // -200 should be 1.5
        expect(americanToDecimal(-200)).toBe(1.5);
    });

    it("handles zero as positive odds", () => {
        // Zero is treated as negative: (100 / |0|) + 1 = Infinity
        expect(americanToDecimal(0)).toBe(Infinity);
    });

    it("handles extreme positive odds", () => {
        // +10000 should be 101.0
        expect(americanToDecimal(10000)).toBe(101.0);
    });

    it("handles extreme negative odds", () => {
        // -10000 should be 1.01
        expect(americanToDecimal(-10000)).toBe(1.01);
    });

    it("handles small positive odds", () => {
        // +1 should be 1.01
        expect(americanToDecimal(1)).toBe(1.01);
    });

    it("handles small negative odds", () => {
        // -1 should be 101.0
        expect(americanToDecimal(-1)).toBe(101.0);
    });
});

describe("americanToProbability", () => {
    it("converts positive odds to probability", () => {
        // +100 -> 2.0 decimal -> 0.5 probability
        expect(americanToProbability(100)).toBe(0.5);
    });

    it("converts negative odds to probability", () => {
        // -110 -> ~1.909 decimal -> ~0.524 probability
        expect(americanToProbability(-110)).toBeCloseTo(0.5238, 4);
    });

    it("handles extreme long shot odds", () => {
        // +10000 -> 101.0 decimal -> ~0.0099 probability
        expect(americanToProbability(10000)).toBeCloseTo(0.0099, 4);
    });

    it("handles extreme favorite odds", () => {
        // -10000 -> 1.01 decimal -> ~0.9901 probability
        expect(americanToProbability(-10000)).toBeCloseTo(0.9901, 4);
    });

    it("handles zero odds", () => {
        // 0 -> Infinity decimal -> 0 probability
        expect(americanToProbability(0)).toBe(0);
    });
});

describe("calculateEVPercentage", () => {
    it("returns zero EV for fair odds", () => {
        // 50% probability at 2.0 odds: (0.5 * 2.0 - 1) * 100 = 0%
        expect(calculateEVPercentage(0.5, 2.0)).toBe(0);
    });

    it("returns positive EV when probability exceeds implied odds", () => {
        // 60% probability at 2.0 odds: (0.6 * 2.0 - 1) * 100 = 20%
        expect(calculateEVPercentage(0.6, 2.0)).toBeCloseTo(20, 10);
    });

    it("returns negative EV when probability is below implied odds", () => {
        // 40% probability at 2.0 odds: (0.4 * 2.0 - 1) * 100 = -20%
        expect(calculateEVPercentage(0.4, 2.0)).toBeCloseTo(-20, 10);
    });

    it("handles zero probability", () => {
        // 0% probability at any odds = -100%
        expect(calculateEVPercentage(0, 2.0)).toBe(-100);
    });

    it("handles 100% probability", () => {
        // 100% probability at 2.0 odds: (1.0 * 2.0 - 1) * 100 = 100%
        expect(calculateEVPercentage(1.0, 2.0)).toBe(100);
    });

    it("handles very high odds (long shot)", () => {
        // 10% probability at 15.0 odds: (0.1 * 15.0 - 1) * 100 = 50%
        expect(calculateEVPercentage(0.1, 15.0)).toBe(50);
    });

    it("handles very low odds (heavy favorite)", () => {
        // 90% probability at 1.05 odds: (0.9 * 1.05 - 1) * 100 = -5.5%
        expect(calculateEVPercentage(0.9, 1.05)).toBeCloseTo(-5.5, 10);
    });

    it("handles odds of 1.0 (break-even)", () => {
        // Any probability at 1.0 odds results in negative EV
        expect(calculateEVPercentage(0.5, 1.0)).toBe(-50);
        expect(calculateEVPercentage(1.0, 1.0)).toBe(0);
    });
});

describe("calculateKellyFraction", () => {
    it("returns 0 for negative EV bet", () => {
        // 40% probability at 2.0 odds (50% implied) - negative EV
        // b = 1, p = 0.4, q = 0.6
        // f* = (1 * 0.4 - 0.6) / 1 = -0.2 -> clamped to 0
        const result = calculateKellyFraction(0.4, 2.0);
        expect(result).toBe(0);
    });

    it("returns 0 for break-even bet", () => {
        // 50% probability at 2.0 odds - zero EV
        // b = 1, p = 0.5, q = 0.5
        // f* = (1 * 0.5 - 0.5) / 1 = 0
        const result = calculateKellyFraction(0.5, 2.0);
        expect(result).toBe(0);
    });

    it("returns positive fraction for positive EV bet", () => {
        // 60% probability at 2.0 odds
        // b = 1, p = 0.6, q = 0.4
        // f* = (1 * 0.6 - 0.4) / 1 = 0.2
        const result = calculateKellyFraction(0.6, 2.0);
        expect(result).toBeCloseTo(0.2, 5);
    });

    it("handles realistic betting scenario at -110 odds", () => {
        // 55% probability at -110 odds (1.909 decimal)
        // b = 0.909, p = 0.55, q = 0.45
        // f* = (0.909 * 0.55 - 0.45) / 0.909 = 0.055
        const decimalOdds = americanToDecimal(-110);
        const result = calculateKellyFraction(0.55, decimalOdds);
        expect(result).toBeCloseTo(0.055, 2);
    });

    it("handles long shot with value", () => {
        // 15% probability at +900 odds (10.0 decimal)
        // b = 9, p = 0.15, q = 0.85
        // f* = (9 * 0.15 - 0.85) / 9 = 0.056
        const result = calculateKellyFraction(0.15, 10.0);
        expect(result).toBeCloseTo(0.056, 2);
    });

    it("handles heavy favorite with small edge", () => {
        // 95% probability at -2000 odds (1.05 decimal)
        // b = 0.05, p = 0.95, q = 0.05
        // f* = (0.05 * 0.95 - 0.05) / 0.05 = 0
        const decimalOdds = americanToDecimal(-2000);
        const result = calculateKellyFraction(0.95, decimalOdds);
        expect(result).toBe(0);
    });

    it("suggests full bankroll for guaranteed winner", () => {
        // 100% probability at any odds
        // f* = (b * 1 - 0) / b = 1
        const result = calculateKellyFraction(1.0, 2.0);
        expect(result).toBe(1);
    });
});
