// Note, no error checking is done for invalid odds

/**
 * Converts American odds to Decimal odds.
 * 
 * Formulas:
 * - If American Odds (A) > 0: Decimal Odds (D) = (A / 100) + 1
 * - If American Odds (A) < 0: Decimal Odds (D) = (100 / |A|) + 1
 * 
 * @param american - The American odds value (e.g., -110, 250).
 * @returns The converted decimal odds.
 */
export function americanToDecimal(american: number): number {
    if (american > 0) {
        return (american / 100) + 1;
    } else {
        return (100 / Math.abs(american)) + 1;
    }
}

/**
 * Converts American odds to Implied Probability.
 * 
 * @param american - The American odds value.
 * @returns The implied probability (between 0 and 1).
 */
export function americanToProbability(american: number): number {
    const decimal = americanToDecimal(american);
    return 1 / decimal;
}

/**
 * Calculates Expected Value (EV) percentage.
 * 
 * Formula: EV = (True Probability * Decimal Odds) - 1
 * 
 * @param trueProb - The estimated true probability of the outcome.
 * @param decimalOdds - The decimal odds offered by the bookmaker.
 * @returns The EV as a percentage (e.g., 5.2 for 5.2%).
 */
export function calculateEVPercentage(trueProb: number, decimalOdds: number): number {
    return (trueProb * decimalOdds - 1) * 100;
}

/**
 * Calculates the Kelly Criterion fraction for optimal bet sizing.
 *
 * Formula: f* = (bp - q) / b
 * Where:
 *   b = decimal odds - 1 (net profit per unit)
 *   p = true probability of winning
 *   q = 1 - p (probability of losing)
 *
 * @param trueProbability - The estimated true probability of the outcome (0-1).
 * @param decimalOdds - The decimal odds offered by the bookmaker.
 * @returns The Kelly fraction (0-1), clamped to 0 for negative EV bets.
 */
export function calculateKellyFraction(trueProbability: number, decimalOdds: number): number {
    const b = decimalOdds - 1; // net profit per unit
    const p = trueProbability;
    const q = 1 - p;

    // Kelly formula: f* = (bp - q) / b
    const kellyFraction = (b * p - q) / b;

    // Clamp to 0 for negative EV (never bet negative amounts)
    return Math.max(0, kellyFraction);
}
