import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { calculateEV } from './logic/ev.js';
import { calculateEVBatch } from './logic/batch.js';

const app = express();

app.use(express.json());

/**
 * Checks if the cache should be bypassed based on request headers/query params.
 * Supports: Cache-Control: no-cache header OR ?fresh=true query param
 */
function shouldSkipCache(req: Request): boolean {
    const cacheControl = req.headers['cache-control'];
    const freshParam = req.query.fresh === 'true';
    return cacheControl === 'no-cache' || freshParam;
}

const calculateEVRequestSchema = z.object({
    offerId: z.string(),
    sharps: z.array(z.string()),
    targetBook: z.string(),
    playerId: z.string(),
    line: z.number(),
    side: z.enum(['Over', 'Under']),
    devigMethod: z.enum(['multiplicative', 'additive', 'power', 'shin', 'os_skewed']),
});

app.post('/calculate-ev', async (req: Request, res: Response) => {
    try {
        const validationResult = calculateEVRequestSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Invalid request body',
                details: validationResult.error.message
            });
        }

        const cacheOptions = { skipCache: shouldSkipCache(req) };
        const result = await calculateEV(validationResult.data, cacheOptions);

        // !result.success gives tsx error
        if (result.success === false) {
            return res.status(result.error.httpStatus).json({
                error: result.error.message,
                code: result.error.code
            });
        }

        return res.status(200).json(result.value);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return res.status(500).json({ error: errorMessage });
    }
});

// Batch request validation schema
const batchItemSchema = z.object({
    playerId: z.string(),
    line: z.number(),
    side: z.enum(['Over', 'Under']),
    targetBook: z.string(),
    sharps: z.array(z.string()).min(1),
    devigMethod: z.enum(['multiplicative', 'additive', 'power', 'shin', 'os_skewed']),
});

const batchCalculateEVRequestSchema = z.object({
    offerId: z.string(),
    items: z.array(batchItemSchema).min(1).max(10, 'Maximum batch size is 10 items'),
});

app.post('/calculate-ev/batch', async (req: Request, res: Response) => {
    try {
        const validationResult = batchCalculateEVRequestSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Invalid request body',
                details: validationResult.error.message
            });
        }

        const cacheOptions = { skipCache: shouldSkipCache(req) };
        const result = await calculateEVBatch(validationResult.data, cacheOptions);

        // Always return 200 for batch - partial success is still success
        // Individual errors are in the results array
        return res.status(200).json(result);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return res.status(500).json({ error: errorMessage });
    }
});

app.get("/test", (req: Request, res: Response) => {
    res.send("test");
});

export default app;
