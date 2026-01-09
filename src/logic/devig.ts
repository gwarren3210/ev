import type { Outcome, DevigMethod, Result } from '../types/index.ts';
import { DevigError } from '../errors/index.ts';

/**
 * Removes the bookmaker's "vig" (overround) from market odds to estimate the true probability.
 * 
 * @param outcomes - Array of outcomes for a 2-sided market.
 * @param label - The specific outcome label to calculate the true probability for.
 * @param method - The devigging method to employ (default: 'multiplicative').
 * @returns A Result containing the true probability or a DevigError.
 */
export function devigOdds(
    outcomes: Outcome[],
    label: 'Over' | 'Under',
    method: DevigMethod = 'multiplicative'
): Result<number, DevigError> {
    const targetOutcome = outcomes.find(o => o.label === label);
    const oppositeOutcome = outcomes.find(o => o.label !== label);

    if (!targetOutcome || !oppositeOutcome) {
        return {
            success: false,
            error: new DevigError(`Incomplete market: Missing outcome for ${label} or its opposite.`)
        };
    }

    // p1 = implied probability of the target side
    // p2 = implied probability of the opposite side
    const p1 = targetOutcome.odds;
    const p2 = oppositeOutcome.odds;

    if (p1 === 0 || p2 === 0) {
        return { success: false, error: new DevigError('Market data error: Implied probability cannot be zero.') };
    }

    let deviggedProb: number;
    switch (method) {
        case 'additive':
            deviggedProb = devigAdditive(p1, p2);
            break;
        case 'power':
            deviggedProb = devigPower(p1, p2);
            break;
        case 'os_skewed':
            deviggedProb = devigOsSkewed(p1, p2, label);
            break;
        case 'shin':
            deviggedProb = devigShin(p1, p2);
            break;
        case 'multiplicative':
            deviggedProb = devigMultiplicative(p1, p2);
            break;
        default:
            return { success: false, error: new DevigError(`Unsupported devigging method: ${method}`) };
    }

    return { success: true, value: deviggedProb };
}

/**
 * Shin Method
 * 
 * Concept: Assumes some traders are "insiders" with perfect knowledge.
 * For n=2, it simplifies to the Additive method.
 */
function devigShin(p1: number, p2: number): number {
    return devigAdditive(p1, p2);
}

/**
 * Multiplicative Method (Margin Proportional to Odds)
 * 
 * Formula: p_true = p_implied / Σ(p_implied)
 */
function devigMultiplicative(p1: number, p2: number): number {
    const total = p1 + p2;
    return p1 / total;
}

/**
 * Additive Method (Equal Distribution)
 * 
 * Formula: p_true = p_implied - (Overround / n)
 */
function devigAdditive(p1: number, p2: number): number {
    const overround = p1 + p2 - 1;
    return p1 - (overround / 2);
}

/**
 * Power Method (Logarithmic Distribution)
 * 
 * Solve for k such that: Σ(p_implied^k) = 1
 * Uses binary search to find k.
 */
function devigPower(p1: number, p2: number): number {
    let min = 1;
    let max = 10;
    let k = 1;
    const MAX_ITERATIONS = 20;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        k = (min + max) / 2;
        const val = Math.pow(p1, k) + Math.pow(p2, k);
        if (Math.abs(val - 1) < 0.00001) break;
        if (val > 1) {
            min = k;
        } else {
            max = k;
        }
    }

    return Math.pow(p1, k);
}

/**
 * Over/Under Skewed Method
 * 
 * Specifically designed for O/U markets where the vig is typically skewed.
 * Applies 65% of the vig to the 'Over' and 35% to the 'Under'.
 */
function devigOsSkewed(p1: number, p2: number, label: 'Over' | 'Under'): number {
    const total = p1 + p2;
    const overround = total - 1;
    const weight = label === 'Over' ? 0.65 : 0.35;
    return p1 - (weight * overround);
}

