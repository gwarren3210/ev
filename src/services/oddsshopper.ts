import type { Offer, Result } from '../types/index.js';
import { DataSchema } from '../types/index.js';
import { ApiError, OfferNotFoundError, OfferNotFoundForPlayerError } from '../errors/index.js';
import { getEnvironment } from '../config/env.js';
import { getCachedOfferData, setCachedOfferDataBatch } from '../cache/index.js';

/**
 * Options for fetching offer data.
 */
export interface FetchOptions {
    skipCache?: boolean;
}

/**
 * Fetches offer data for a specific player from OddsShopper API with caching support.
 * Checks cache first for the specific player, then fetches from API if needed.
 *
 * @param offerId - The offer ID to fetch data for
 * @param playerId - The player ID to fetch offer for
 * @param options - Fetch options including cache bypass
 * @returns Result containing single Offer or an error
 */
export async function fetchOddsShopperDataForPlayer(
    offerId: string,
    playerId: string,
    options: FetchOptions = {}
): Promise<Result<Offer, ApiError | OfferNotFoundError | OfferNotFoundForPlayerError>> {
    // Check cache first for this specific player (unless bypassed)
    if (!options.skipCache) {
        const cached = await getCachedOfferData(offerId, playerId);
        if (cached) {
            return { success: true, value: cached };
        }
    }

    // Fetch all offers from API
    const result = await fetchFromAPI(offerId);

    // Cache all offers individually if successful
    if (result.success) {
        await setCachedOfferDataBatch(offerId, result.value);

        // Find and return the specific player's offer
        const playerOffer = result.value.find(o => o.participants[0]?.id === playerId);
        if (!playerOffer) {
            return { success: false, error: new OfferNotFoundForPlayerError(playerId) };
        }
        return { success: true, value: playerOffer };
    }

    return result;
}

/**
 * Fetches all offers for an offerId from OddsShopper API.
 * Used by batch processing - always fetches from API and caches all results.
 *
 * @param offerId - The offer ID to fetch data for
 * @param options - Fetch options including cache bypass
 * @returns Result containing array of Offers or an error
 */
export async function fetchOddsShopperData(
    offerId: string,
    options: FetchOptions = {}
): Promise<Result<Offer[], ApiError | OfferNotFoundError>> {
    // Fetch from API
    const result = await fetchFromAPI(offerId);

    // Store each offer in cache if successful
    if (result.success && !options.skipCache) {
        await setCachedOfferDataBatch(offerId, result.value);
    }

    return result;
}

/**
 * Fetches outcomes for a specific offer ID from the OddsShopper API.
 * This is the raw API call without caching.
 */
export async function fetchFromAPI(offerId: string): Promise<Result<Offer[], ApiError | OfferNotFoundError>> {
    try {
        const env = getEnvironment();
        const startDate = new Date().toISOString();
        const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const params = new URLSearchParams({ startDate, endDate, sortBy: 'Time' });
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
