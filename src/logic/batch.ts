import type {
    BatchCalculateEVRequest,
    BatchCalculateEVResponse,
    BatchItemResult,
    CalculateEVRequest,
    Offer,
    Result,
} from '../types/index.js';
import { fetchOddsShopperData, type FetchOptions } from '../services/oddsshopper.js';
import { findSpecificOffer, calculateEVFromOffer } from './ev.js';
import { getCachedEVResult, setCachedEVResult } from '../cache/index.js';
import { OfferNotFoundError, ApiError } from '../errors/index.js';

/**
 * Creates a batch response where all items have the same error.
 * Used when a shared dependency (like offer fetch) fails.
 */
function createAllErrorsBatchResponse(
    offerId: string,
    itemCount: number,
    error: { code: string; message: string }
): BatchCalculateEVResponse {
    const results: BatchItemResult[] = Array.from({ length: itemCount }, (_, i) => ({
        index: i,
        success: false as const,
        error,
    }));

    return {
        offerId,
        totalItems: itemCount,
        successCount: 0,
        errorCount: itemCount,
        results,
    };
}

/**
 * Processes a batch of EV calculations.
 * All items share the same offerId, so only one API call is made.
 *
 * @param req - The batch request containing offerId and items
 * @param options - Fetch options including cache bypass
 * @returns Batch response with results for each item
 */
export async function calculateEVBatch(
    req: BatchCalculateEVRequest,
    options: FetchOptions = {}
): Promise<BatchCalculateEVResponse> {
    const results: BatchItemResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Step 1: Fetch offer data ONCE for all items (with caching)
    const offerResult: Result<Offer[], ApiError | OfferNotFoundError> = await fetchOddsShopperData(req.offerId, options);

    if (offerResult.success === false) {
        return createAllErrorsBatchResponse(
            req.offerId,
            req.items.length,
            { code: offerResult.error.code, message: offerResult.error.message }
        );
    }

    if (offerResult.value.length === 0) {
        return createAllErrorsBatchResponse(
            req.offerId,
            req.items.length,
            { code: 'NOT_FOUND', message: 'Offer not found' }
        );
    }

    const allOffers = offerResult.value;

    // Step 2: Process each item
    for (let i = 0; i < req.items.length; i++) {
        const item = req.items[i]!;

        // Construct full request for caching
        const fullReq: CalculateEVRequest = {
            offerId: req.offerId,
            playerId: item.playerId,
            line: item.line,
            side: item.side,
            targetBook: item.targetBook,
            sharps: item.sharps,
            devigMethod: item.devigMethod,
            bankroll: item.bankroll,
        };

        // Check EV cache first
        if (!options.skipCache) {
            const cached = await getCachedEVResult(fullReq);
            if (cached) {
                results.push({
                    index: i,
                    success: true,
                    result: cached,
                });
                successCount++;
                continue;
            }
        }

        // Find player's offer from pre-fetched data
        const playerOfferResult = findSpecificOffer(allOffers, item.playerId);
        if (playerOfferResult.success === false) {
            results.push({
                index: i,
                success: false,
                error: {
                    code: playerOfferResult.error.code,
                    message: playerOfferResult.error.message,
                },
            });
            errorCount++;
            continue;
        }

        // Calculate EV from the offer
        const evResult = calculateEVFromOffer(playerOfferResult.value, item);

        if (evResult.success) {
            // Cache the successful result
            await setCachedEVResult(fullReq, evResult.value);

            results.push({
                index: i,
                success: true,
                result: evResult.value,
            });
            successCount++;
        } else {
            results.push({
                index: i,
                success: false,
                error: {
                    code: evResult.error.code,
                    message: evResult.error.message,
                },
            });
            errorCount++;
        }
    }

    return {
        offerId: req.offerId,
        totalItems: req.items.length,
        successCount,
        errorCount,
        results,
    };
}
