
export class CalculationError extends Error {
    constructor(message: string, public code: string, public httpStatus: number = 500) {
        super(message);
        this.name = 'CalculationError';
    }
}

export class OfferNotFoundError extends CalculationError {
    constructor(offerId: string) {
        super(`Offer not found for ID: ${offerId}`, 'OFFER_NOT_FOUND', 404);
        this.name = 'OfferNotFoundError';
    }
}

export class ApiError extends CalculationError {
    constructor(message: string, public statusCode?: number) {
        super(message, 'API_ERROR', statusCode || 502);
        this.name = 'ApiError';
    }
}

export class OneSidedMarketError extends CalculationError {
    constructor(market: string) {
        super(`One-sided market found for: ${market}`, 'ONE_SIDED_MARKET', 409);
        this.name = 'OneSidedMarketError';
    }
}

export class NoSharpOutcomesError extends CalculationError {
    constructor(sharps: string[]) {
        super(`No sharp outcomes found for sharps: ${sharps.join(', ')}`, 'NO_SHARP_OUTCOMES', 422);
        this.name = 'NoSharpOutcomesError';
    }
}

export class TargetOutcomeNotFoundError extends CalculationError {
    constructor(targetBook: string) {
        super(`Target outcome not found for book: ${targetBook}`, 'TARGET_OUTCOME_NOT_FOUND', 404);
        this.name = 'TargetOutcomeNotFoundError';
    }
}

export class TargetOutcomeNotCompleteError extends OneSidedMarketError {
    constructor(targetBook: string) {
        super(`Target outcome not complete for book: ${targetBook}`);
        this.name = 'TargetOutcomeNotCompleteError';
    }
}

export class DevigError extends CalculationError {
    constructor(message: string) {
        super(message, 'DEVIG_ERROR', 422);
        this.name = 'DevigError';
    }
}
