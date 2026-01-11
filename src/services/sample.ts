import { fetchFromAPI } from './oddsshopper.js';
import type { Offer } from '../types/index.js';

/**
 * Sample player data for building sample requests.
 */
export interface SamplePlayer {
    playerId: string;
    playerName: string;
    line: number;
    targetBook: string;
    sharpBook: string;
}

/**
 * Sample data containing offer ID and multiple players.
 */
export interface SampleData {
    offerId: string;
    players: SamplePlayer[];
}

// Known offer IDs to try (same as integration tests)
const offerIds: string[] = [
    "aa4dd9a9-6aec-44f9-8ae0-3599520b9351",
    "274fde84-066e-46ee-96bb-e76c98e1115a",
    "550b8fc7-d7e7-46ab-8fa6-faf07ea98372"
];

/**
 * Extracts sample player data from an offer if it has valid data.
 * Requires both Over and Under sides with at least 2 sportsbooks.
 */
function extractPlayerFromOffer(offer: Offer): SamplePlayer | null {
    // Need at least one participant
    if (!offer.participants || offer.participants.length === 0) {
        return null;
    }

    // Need both Over and Under sides
    const overSide = offer.sides.find(s => s.label === 'Over');
    const underSide = offer.sides.find(s => s.label === 'Under');

    if (!overSide || !underSide) {
        return null;
    }

    // Need outcomes from multiple books on both sides
    if (overSide.outcomes.length < 2 || underSide.outcomes.length < 2) {
        return null;
    }

    // Get unique sportsbooks that have both Over and Under
    const overBooks = new Set(overSide.outcomes.map(o => o.sportsbookCode));
    const underBooks = new Set(underSide.outcomes.map(o => o.sportsbookCode));
    const booksWithBothSides = [...overBooks].filter(b => underBooks.has(b));

    if (booksWithBothSides.length < 2) {
        return null;
    }

    // Try to find PINNACLE as sharp, otherwise use first book
    const sharpBook = booksWithBothSides.includes('PINNACLE')
        ? 'PINNACLE'
        : booksWithBothSides[0]!;

    // Use a different book as target
    const targetBook = booksWithBothSides.find(b => b !== sharpBook) || booksWithBothSides[1]!;

    // Get line from one of the outcomes
    const targetOutcome = overSide.outcomes.find(o => o.sportsbookCode === targetBook);
    if (!targetOutcome) {
        return null;
    }

    const line = parseFloat(targetOutcome.line);
    if (isNaN(line)) {
        return null;
    }

    return {
        playerId: offer.participants[0]!.id,
        playerName: offer.participants[0]!.name,
        line,
        targetBook,
        sharpBook,
    };
}

/**
 * Fetches sample data for a single player from live OddsShopper API.
 * Returns the first valid offer with complete data.
 */
export async function fetchSingleSample(): Promise<{ offerId: string; player: SamplePlayer } | null> {
    for (const offerId of offerIds) {
        try {
            const result = await fetchFromAPI(offerId);

            if (result.success === false || result.value.length === 0) {
                continue;
            }

            // Find first offer with complete data
            for (const offer of result.value) {
                const player = extractPlayerFromOffer(offer);
                if (player) {
                    return { offerId, player };
                }
            }
        } catch {
            continue;
        }
    }

    return null;
}

/**
 * Fetches sample data for multiple players from live OddsShopper API.
 * Returns up to maxPlayers distinct players from the same offer.
 */
export async function fetchBatchSample(maxPlayers: number = 3): Promise<SampleData | null> {
    for (const offerId of offerIds) {
        try {
            const result = await fetchFromAPI(offerId);

            if (result.success === false || result.value.length === 0) {
                continue;
            }

            // Collect multiple players from this offer
            const players: SamplePlayer[] = [];

            for (const offer of result.value) {
                const player = extractPlayerFromOffer(offer);
                if (player) {
                    players.push(player);
                    if (players.length >= maxPlayers) {
                        break;
                    }
                }
            }

            // Return if we found at least 2 players
            if (players.length >= 2) {
                return { offerId, players };
            }
        } catch {
            continue;
        }
    }

    return null;
}
