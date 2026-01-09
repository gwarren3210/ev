import { describe, it, expect } from "bun:test";
import { americanToDecimal, americanToProbability, calculateEVPercentage } from "../src/utils/odds";

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
