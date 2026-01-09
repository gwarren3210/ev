import { z } from 'zod';

export interface Participant {
    id: string;
    name: string;
    title: string;
    isHome: boolean;
    participantLogo: string;
    participantType: string;
}

const ParticipantSchema = z.object({
    id: z.string(),
    name: z.string(),
    title: z.string(),
    isHome: z.boolean(),
    participantLogo: z.string(),
    participantType: z.string(),
});

export interface Outcome {
    id: string;
    displayLabel: string;
    americanOdds: string;
    bestHoldOutcome: boolean;
    odds: number;
    line: string;
    label: 'Over' | 'Under';
    sportsbookCode: string;
    sportsbookLogo: string;
    participantLogo: string;
    participantType: string;
    deepLinkUrl?: string;
    title: string;
    trueWinProbability?: number;
    ev?: number;
    hashCodeBetSideWithLine: string;
    hashCode: string;
    sportsbookOutcomeId?: string;
}

const OutcomeSchema = z.object({
    id: z.string(),
    displayLabel: z.string(),
    americanOdds: z.string(),
    bestHoldOutcome: z.boolean(),
    odds: z.number(),
    line: z.string(),
    label: z.enum(['Over', 'Under']),
    sportsbookCode: z.string(),
    sportsbookLogo: z.string(),
    participantLogo: z.string(),
    participantType: z.string(),
    deepLinkUrl: z.string().optional(),
    title: z.string(),
    trueWinProbability: z.number().optional(),
    ev: z.number().optional(),
    hashCodeBetSideWithLine: z.string(),
    hashCode: z.string(),
    sportsbookOutcomeId: z.string().optional(),
});


export interface SharpMetrics {
    outlier: number;
    averageOdds: number;
    counts?: number;
}

const SharpMetricsSchema = z.object({
    outlier: z.number(),
    averageOdds: z.number(),
    counts: z.number().optional(),
});

export interface Side {
    label: string;
    bestOutcome?: Outcome;
    outcomes: Outcome[];
    sharpMetrics?: SharpMetrics;
}

const SideSchema = z.object({
    label: z.string(),
    bestOutcome: OutcomeSchema.optional(),
    outcomes: z.array(OutcomeSchema),
    sharpMetrics: SharpMetricsSchema.optional(),
});

export interface GraphDetail {
    hashCodeBetSideWithLine: string;
    line: string;
    label: string;
}

const GraphDetailSchema = z.object({
    hashCodeBetSideWithLine: z.string(),
    line: z.string(),
    label: z.string(),
});

export interface Offer {
    eventName: string;
    tournamentName: string;
    offerName: string;
    startDate: string;
    dateString: string;
    hold: number;
    sportsbooks: string[];
    participants: Participant[];
    sides: Side[];
    graphDetails?: GraphDetail[];
}

const OfferSchema = z.object({
    eventName: z.string(),
    tournamentName: z.string(),
    offerName: z.string(),
    startDate: z.string(),
    dateString: z.string(),
    hold: z.number(),
    sportsbooks: z.array(z.string()),
    participants: z.array(ParticipantSchema),
    sides: z.array(SideSchema),
    graphDetails: z.array(GraphDetailSchema).optional(),
});

export type Data = Offer[];

export const DataSchema = z.array(OfferSchema);

// Request body type
export type DevigMethod = 'multiplicative' | 'additive' | 'power' | 'shin' | 'os_skewed';

export interface CalculateEVRequest {
    offerId: string;
    sharps: string[];
    targetBook: string;
    playerId: string;
    line: number;
    side: 'Over' | 'Under';
    devigMethod: DevigMethod;
}

// Response type
export interface CalculateEVResponse {
    player: string;
    market: string;
    line: number;
    side: 'Over' | 'Under';
    targetBook: string;
    targetOdds: number;
    trueProbability: number;
    impliedProbability: number;
    expectedValue: number;
    sharpsUsed: string[];
}

// Result type for error handling
export type Result<T, E extends Error = Error> =
    | { success: true; value: T }
    | { success: false; error: E };

// ============================================
// Batch Processing Types
// ============================================

/**
 * A single item in a batch EV calculation request.
 * Note: offerId is shared across all items in the batch.
 */
export interface BatchEVItem {
    playerId: string;
    line: number;
    side: 'Over' | 'Under';
    targetBook: string;
    sharps: string[];
    devigMethod: DevigMethod;
}

/**
 * Request body for batch EV calculation.
 * All items must share the same offerId.
 */
export interface BatchCalculateEVRequest {
    offerId: string;
    items: BatchEVItem[];
}

/**
 * Result for a single item in a batch response.
 */
export type BatchItemResult =
    | { index: number; success: true; result: CalculateEVResponse }
    | { index: number; success: false; error: { code: string; message: string } };

/**
 * Response body for batch EV calculation.
 */
export interface BatchCalculateEVResponse {
    offerId: string;
    totalItems: number;
    successCount: number;
    errorCount: number;
    results: BatchItemResult[];
}
