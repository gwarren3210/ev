import type {
    CalculateEVRequest,
    CalculateEVResponse,
    Offer,
    Outcome,
    Result,
    DevigMethod,
} from '../types/index.js';
import { DataSchema } from '../types/index.js';
import {
    CalculationError,
    OfferNotFoundError,
    ApiError,
    OneSidedMarketError,
    NoSharpOutcomesError,
    TargetOutcomeNotFoundError,
    TargetOutcomeNotCompleteError,
    DevigError
} from '../errors/index.js';
import { devigOdds } from './devig.js';
import { americanToDecimal, calculateEVPercentage } from '../utils/odds.js';
import { getEnvironment } from '../config/env.js';
/**
 * Orchestrates the calculation of Expected Value (EV) for a given bet.
 * 
 * Process:
 * 1. Fetches live market data for the specified offer.
 * 2. Identifies the targeted player offer.
 * 3. Identifies sharp books available for benchmarking.
 * 4. Extracts market data for the target book and side.
 * 5. Calculates true and implied probabilities.
 * 6. Calculates the final Expected Value (EV).
 * 
 * @param req - The request parameters including offerId, targetBook, and side.
 * @returns A Result containing the detailed EV analysis or a specific error.
 */
export async function calculateEV(req: CalculateEVRequest): Promise<Result<CalculateEVResponse, CalculationError>> {
    // 1. Fetch Market Data
    const dataFetchResult = await fetchOfferData(req.offerId);
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

    // 3. Identify Sharp Books for Benchmark
    const allOutcomes = offer.sides.flatMap(side => side.outcomes);
    const sharpBooksResult = findAvailableSharpBooks(allOutcomes, req.sharps);
    if (sharpBooksResult.success === false) {
        return { success: false, error: sharpBooksResult.error };
    }
    const sharpBookCodes = sharpBooksResult.value;

    // 4. Extract Target Market Data
    const targetOutcomesResult = findTargetOutcomes(allOutcomes, req.targetBook);
    if (targetOutcomesResult.success === false) {
        return { success: false, error: targetOutcomesResult.error };
    }
    const targetOutcomes = targetOutcomesResult.value;

    const targetAmericanOddsResult = extractAmericanOdds(targetOutcomes, req.side);
    if (targetAmericanOddsResult.success === false) {
        return { success: false, error: targetAmericanOddsResult.error };
    }
    if (targetAmericanOddsResult.value !== req.line) {
        return { success: false, error: new CalculationError(`Target odds ${targetAmericanOddsResult.value} does not match request line ${req.line}`, 'TARGET_ODDS_DOES_NOT_MATCH_REQUEST') };
    }
    const targetAmericanOdds = targetAmericanOddsResult.value;

    // 5. Calculate Probabilities
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

    // 6. Calculate Final EV
    const targetDecimalOdds = americanToDecimal(targetAmericanOdds);
    const expectedValue = calculateEVPercentage(trueProbability, targetDecimalOdds);

    const player = offer.participants.find(p => p.id === req.playerId)?.name || 'Unknown Player';
    // Note, fix to have this be returned by calculateAverageTrueProbability
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
 * Fetches outcomes for a specific offer ID from the OddsShopper API.
 */
async function fetchOfferData(offerId: string): Promise<Result<Offer[], ApiError | OfferNotFoundError>> {
    try {
        const env = getEnvironment();
        const startDate = new Date().toISOString();
        const params = new URLSearchParams({ startDate, sortBy: 'Time' });
        const url = `${env.ODDSSHOPPER_API_URL}/api/offers/${offerId}/outcomes/live?${params.toString()}`;

        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) return { success: false, error: new OfferNotFoundError(offerId) };
            return { success: false, error: new ApiError(`Upstream error: ${response.statusText}`, response.status) };
        }

        const offers = await response.json();
        if (!Array.isArray(offers)) return { success: false, error: new OfferNotFoundError(offerId) };
        const offersResult = DataSchema.safeParse(offers);
        if (!offersResult.success) {
            return { success: false, error: new ApiError(`Upstream error: ${offersResult.error.message}`, response.status) };
        }

        return { success: true, value: offers };
    } catch (err) {
        return {
            success: false,
            error: new ApiError(`Network or parsing failure: ${err instanceof Error ? err.message : 'Unknown'}`)
        };
    }
}

/**
 * Finds the specific offer corresponding to a player ID.
 * Note: Assumes that the one participant exists and is the player.
 */
export function findSpecificOffer(offers: Offer[], playerId: string): Result<Offer, OfferNotFoundError> {
    const offer = offers.find(o => o.participants[0]?.id === playerId);
    if (!offer) return { success: false, error: new OfferNotFoundError(playerId) };
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
 * Extracts all outcomes associated with the target sportsbook.
 * Note: currently only supports 2 outcomes per side
 */
export function findTargetOutcomes(outcomes: Outcome[], targetBook: string): Result<Outcome[], TargetOutcomeNotFoundError | TargetOutcomeNotCompleteError> {
    const targetOutcomes = outcomes.filter(o => o.sportsbookCode === targetBook);
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

