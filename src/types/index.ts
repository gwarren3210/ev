import { z } from 'zod';

export const ParticipantSchema = z.object({
    id: z.string(),
    name: z.string(),
    title: z.string(),
    isHome: z.boolean(),
    participantLogo: z.string(),
    participantType: z.string(),
});

export type Participant = z.infer<typeof ParticipantSchema>;

export const OutcomeSchema = z.object({
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

export type Outcome = z.infer<typeof OutcomeSchema>;


export const SharpMetricsSchema = z.object({
    outlier: z.number(),
    averageOdds: z.number(),
    counts: z.number().optional(),
});

export type SharpMetrics = z.infer<typeof SharpMetricsSchema>;

export const SideSchema = z.object({
    label: z.string(),
    bestOutcome: OutcomeSchema.optional(),
    outcomes: z.array(OutcomeSchema),
    sharpMetrics: SharpMetricsSchema.optional(),
});

export type Side = z.infer<typeof SideSchema>;

export const GraphDetailSchema = z.object({
    hashCodeBetSideWithLine: z.string(),
    line: z.string(),
    label: z.string(),
});

export type GraphDetail = z.infer<typeof GraphDetailSchema>;

export const OfferSchema = z.object({
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

export type Offer = z.infer<typeof OfferSchema>;

export type Data = Offer[];

export const DataSchema = z.array(OfferSchema);

// Request/Response Schemas and Types
export const DevigMethodSchema = z.enum(['multiplicative', 'additive', 'power', 'shin', 'osskewed']);
export type DevigMethod = z.infer<typeof DevigMethodSchema>;

export const CalculateEVRequestSchema = z.object({
    offerId: z.string(),
    sharps: z.array(z.string()),
    targetBook: z.string(),
    playerId: z.string(),
    line: z.number(),
    side: z.enum(['Over', 'Under']),
    devigMethod: DevigMethodSchema,
    bankroll: z.number().positive().optional(),
});

export type CalculateEVRequest = z.infer<typeof CalculateEVRequestSchema>;

/**
 * Kelly Criterion bet sizing output.
 * Only included in response when bankroll is provided.
 */
export const KellyBetSizingSchema = z.object({
    /** Full Kelly fraction (what percentage of bankroll to bet) */
    full: z.number(),
    /** Quarter Kelly fraction (conservative 0.25x Kelly) */
    quarter: z.number(),
    /** Recommended bet amount in the same units as bankroll */
    recommendedBet: z.number(),
    /** Expected profit based on EV and recommended bet */
    expectedProfit: z.number(),
    /** The bankroll value used for calculation */
    bankroll: z.number(),
});

export type KellyBetSizing = z.infer<typeof KellyBetSizingSchema>;

// Response type
export const CalculateEVResponseSchema = z.object({
    player: z.string(),
    market: z.string(),
    line: z.number(),
    side: z.enum(['Over', 'Under']),
    targetBook: z.string(),
    targetOdds: z.number(),
    trueProbability: z.number(),
    impliedProbability: z.number(),
    expectedValue: z.number(),
    sharpsUsed: z.array(z.string()),
    bestAvailableOdds: z.object({
        sportsbookCode: z.string(),
        americanOdds: z.number(),
    }),
    kelly: KellyBetSizingSchema.optional(),
});

export type CalculateEVResponse = z.infer<typeof CalculateEVResponseSchema>;

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
export const BatchEVItemSchema = z.object({
    playerId: z.string(),
    line: z.number(),
    side: z.enum(['Over', 'Under']),
    targetBook: z.string(),
    sharps: z.array(z.string()).min(1),
    devigMethod: DevigMethodSchema,
    bankroll: z.number().positive().optional(),
});

export type BatchEVItem = z.infer<typeof BatchEVItemSchema>;

/**
 * Request body for batch EV calculation.
 * All items must share the same offerId.
 */
export const BatchCalculateEVRequestSchema = z.object({
    offerId: z.string(),
    items: z.array(BatchEVItemSchema).min(1).max(10, 'Maximum batch size is 10 items'),
});

export type BatchCalculateEVRequest = z.infer<typeof BatchCalculateEVRequestSchema>;

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
