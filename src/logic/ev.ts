import type {
    CalculateEVRequest,
    CalculateEVResponse,
    Offer,
    Outcome,
    Result,
    DevigMethod,
} from '../types/index.js';
import {
    CalculationError,
    OfferNotFoundForPlayerError,
    NoSharpOutcomesError,
    TargetOutcomeNotFoundError,
    TargetOutcomeNotCompleteError,
    DevigError
} from '../errors/index.js';
import { devigOdds } from './devig.js';
import { americanToDecimal, calculateEVPercentage } from '../utils/odds.js';
import { fetchOddsShopperData, type FetchOptions } from '../services/oddsshopper.js';
import { getCachedEVResult, setCachedEVResult } from '../cache/index.js';

// Re-export FetchOptions for consumers
export type { FetchOptions } from '../services/oddsshopper.js';
/**
 * Orchestrates the calculation of Expected Value (EV) for a given bet.
 *
 * Process:
 * 1. Checks EV cache for existing result
 * 2. Fetches live market data for the specified offer (with caching)
 * 3. Identifies the targeted player offer
 * 4. Calculates EV using calculateEVFromOffer
 * 5. Caches the result
 *
 * @param req - The request parameters including offerId, targetBook, and side.
 * @param options - Fetch options including cache bypass.
 * @returns A Result containing the detailed EV analysis or a specific error.
 */
export async function calculateEV(
    req: CalculateEVRequest,
    options: FetchOptions = {}
): Promise<Result<CalculateEVResponse, CalculationError>> {
    // Check EV cache first
    if (!options.skipCache) {
        const cached = await getCachedEVResult(req);
        if (cached) {
            return { success: true, value: cached };
        }
    }

    // 1. Fetch Market Data (with caching)
    const dataFetchResult = await fetchOddsShopperData(req.offerId, options);
    if (dataFetchResult.success === false) {
        return { success: false, error: dataFetchResult.error };
    }
    const allOffers = dataFetchResult.value;

    // 2. Identify Targeted Offer
    const offerResult = findSpecificOffer(allOffers, req.playerId);
    if (offerResult.success === false) {
        return { success: false, error: offerResult.error };
    }
    const offer = offerResult.value;

    // 3. Calculate EV from offer
    const result = calculateEVFromOffer(offer, req);

    // Cache successful result
    if (result.success) {
        await setCachedEVResult(req, result.value);
    }

    return result;
}

/**
 * Calculates EV from a pre-fetched Offer object.
 * Used by batch processing to avoid redundant API calls.
 *
 * Process:
 * 1. Identifies sharp books available for benchmarking
 * 2. Extracts market data for the target book and side
 * 3. Calculates true and implied probabilities
 * 4. Calculates the final Expected Value (EV)
 *
 * @param offer - The pre-fetched Offer object for the player
 * @param req - The request parameters (without offerId since offer is provided)
 * @returns A Result containing the detailed EV analysis or a specific error
 */
export function calculateEVFromOffer(
    offer: Offer,
    req: Omit<CalculateEVRequest, 'offerId'> & { playerId: string }
): Result<CalculateEVResponse, CalculationError> {
    // 1. Identify Sharp Books for Benchmark
    const allOutcomes = offer.sides.flatMap(side => side.outcomes);
    const sharpBooksResult = findAvailableSharpBooks(allOutcomes, req.sharps);
    if (sharpBooksResult.success === false) {
        return { success: false, error: sharpBooksResult.error };
    }
    const sharpBookCodes = sharpBooksResult.value;

    // 2. Extract Target Market Data (filtered by line)
    const targetOutcomesResult = findTargetOutcomes(allOutcomes, req.targetBook, req.line);
    if (targetOutcomesResult.success === false) {
        return { success: false, error: targetOutcomesResult.error };
    }
    const targetOutcomes = targetOutcomesResult.value;

    const targetAmericanOddsResult = extractAmericanOdds(targetOutcomes, req.side);
    if (targetAmericanOddsResult.success === false) {
        return { success: false, error: targetAmericanOddsResult.error };
    }
    const targetAmericanOdds = targetAmericanOddsResult.value;

    // 3. Calculate Probabilities
    const devigMethod = req.devigMethod;

    // Calculate True Probability by aggregating devigged odds from sharp books
    const sharpOutcomesPool = allOutcomes.filter(o => sharpBookCodes.includes(o.sportsbookCode));
    const trueProbResult = calculateAverageTrueProbability(sharpOutcomesPool, sharpBookCodes, req.side, devigMethod);
    if (trueProbResult.success === false) {
        return { success: false, error: trueProbResult.error };
    }
    const trueProbability = trueProbResult.value;

    // Calculate Implied Probability (normalized vigged probability) of the target market
    const impliedProbResult = devigOdds(targetOutcomes, req.side, devigMethod);
    if (impliedProbResult.success === false) {
        return { success: false, error: impliedProbResult.error };
    }
    const impliedProbability = impliedProbResult.value;

    // 4. Calculate Final EV
    const targetDecimalOdds = americanToDecimal(targetAmericanOdds);
    const expectedValue = calculateEVPercentage(trueProbability, targetDecimalOdds);

    const player = offer.participants.find(p => p.id === req.playerId)?.name || 'Unknown Player';
    const sharpsUsed = sharpBookCodes;

    return {
        success: true,
        value: {
            player,
            market: offer.offerName,
            line: req.line,
            side: req.side,
            targetBook: req.targetBook,
            targetOdds: targetAmericanOdds,
            trueProbability,
            impliedProbability,
            expectedValue,
            sharpsUsed,
        },
    };
}

/**
 * Finds the specific offer corresponding to a player ID.
 * Note: Assumes that the one participant exists and is the player.
 */
export function findSpecificOffer(offers: Offer[], playerId: string): Result<Offer, OfferNotFoundForPlayerError> {
    const offer = offers.find(o => o.participants[0]?.id === playerId);
    if (!offer) return { success: false, error: new OfferNotFoundForPlayerError(playerId) };
    return { success: true, value: offer };
}

/**
 * Checks if a sportsbook has both 'Over' and 'Under' outcomes for a specific label.
 */
export function hasCompleteMarket(outcomes: Outcome[], sportsbookCode: string): boolean {
    const relevantOutcomes = outcomes.filter(o => o.sportsbookCode === sportsbookCode);
    const hasOver = relevantOutcomes.some(o => o.label === 'Over');
    const hasUnder = relevantOutcomes.some(o => o.label === 'Under');

    return hasOver && hasUnder;
}

/**
 * Filters the list of sharps to only those available on this offer with a complete market.
 */
export function findAvailableSharpBooks(allOutcomes: Outcome[], sharps: string[]): Result<string[], NoSharpOutcomesError> {
    const availableSharps = allOutcomes
        .filter(o => sharps.includes(o.sportsbookCode))
        .filter(o => hasCompleteMarket(allOutcomes, o.sportsbookCode))
        .map(o => o.sportsbookCode);
    const uniqueAvailableSharps = Array.from(new Set(availableSharps));
    if (uniqueAvailableSharps.length === 0) {
        return { success: false, error: new NoSharpOutcomesError(sharps) };
    }
    return { success: true, value: uniqueAvailableSharps };
}

/**
 * Extracts all outcomes associated with the target sportsbook at the specified line.
 * Note: currently only supports 2 outcomes per side
 */
export function findTargetOutcomes(outcomes: Outcome[], targetBook: string, line?: number): Result<Outcome[], TargetOutcomeNotFoundError | TargetOutcomeNotCompleteError> {
    let targetOutcomes = outcomes.filter(o => o.sportsbookCode === targetBook);

    // If line is specified, filter to only outcomes at that line
    if (line !== undefined) {
        targetOutcomes = targetOutcomes.filter(o => parseFloat(o.line) === line);
    }

    if (targetOutcomes.length === 0) {
        return { success: false, error: new TargetOutcomeNotFoundError(targetBook) };
    }
    if (!hasCompleteMarket(targetOutcomes, targetBook) || targetOutcomes.length !== 2) {
        return { success: false, error: new TargetOutcomeNotCompleteError(targetBook) };
    }
    return { success: true, value: targetOutcomes };
}

/**
 * Extracts American odds for the specific side from target outcomes.
 */
export function extractAmericanOdds(outcomes: Outcome[], side: 'Over' | 'Under'): Result<number, CalculationError> {
    const outcome = outcomes.find(o => o.label === side);
    if (!outcome) return { success: false, error: new CalculationError('Target Book side missing', 'TARGET_BOOK_SIDE_MISSING') };

    const odds = parseInt(outcome.americanOdds);
    if (isNaN(odds)) {
        return { success: false, error: new CalculationError(`Invalid American odds: ${outcome.americanOdds}`, 'INVALID_ODDS') };
    }
    return { success: true, value: odds };
}

/**
 * Calculates the average true probability by devigging multiple "sharp" books.
 */
export function calculateAverageTrueProbability(
    sharpOutcomesPool: Outcome[],
    sharpBookCodes: string[],
    label: 'Over' | 'Under',
    method: DevigMethod
): Result<number, DevigError> {
    let sumProbability = 0;
    let successfulBooks = 0;

    for (const code of sharpBookCodes) {
        const bookOutcomes = sharpOutcomesPool.filter(o => o.sportsbookCode === code);
        const devigResult = devigOdds(bookOutcomes, label, method);

        if (devigResult.success) {
            sumProbability += devigResult.value;
            successfulBooks++;
        }
    }

    if (successfulBooks === 0) {
        return { success: false, error: new DevigError('No sharp books provided valid two-sided probability data.') };
    }

    return { success: true, value: sumProbability / successfulBooks };
}

