import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';
import { calculateEV } from './logic/ev.js';
import { calculateEVBatch } from './logic/batch.js';
import { openApiSpec } from './openapi.js';
import { fetchSingleSample, fetchBatchSample } from './services/sample.js';

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
    devigMethod: z.enum(['multiplicative', 'additive', 'power', 'shin', 'osskeweded']),
    bankroll: z.number().positive().optional(),
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

app.get('/calculate-ev/sample', async (req: Request, res: Response) => {
    try {
        const sample = await fetchSingleSample();
        if (!sample) {
            return res.status(503).json({ error: 'No live sample data available' });
        }

        const sampleRequest = {
            offerId: sample.offerId,
            playerId: sample.player.playerId,
            line: sample.player.line,
            side: "Over",
            targetBook: sample.player.targetBook,
            sharps: [sample.player.sharpBook],
            devigMethod: "multiplicative",
        };

        return res.json({
            description: `Sample request for ${sample.player.playerName}`,
            request: sampleRequest,
            curl: `curl -X POST 'https://stokastic.vercel.app/calculate-ev' -H 'Content-Type: application/json' -d '${JSON.stringify(sampleRequest)}'`
        });
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
    devigMethod: z.enum(['multiplicative', 'additive', 'power', 'shin', 'osskeweded']),
    bankroll: z.number().positive().optional(),
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

app.get('/calculate-ev/batch/sample', async (req: Request, res: Response) => {
    try {
        const sample = await fetchBatchSample();
        if (!sample) {
            return res.status(503).json({ error: 'No live sample data available' });
        }

        const sampleRequest = {
            offerId: sample.offerId,
            items: sample.players.map(player => ({
                playerId: player.playerId,
                line: player.line,
                side: "Over" as const,
                targetBook: player.targetBook,
                sharps: [player.sharpBook],
                devigMethod: "multiplicative" as const,
            }))
        };

        return res.json({
            description: `Batch sample with ${sample.players.length} players`,
            playerNames: sample.players.map(p => p.playerName),
            request: sampleRequest,
            curl: `curl -X POST 'https://stokastic.vercel.app/calculate-ev/batch' -H 'Content-Type: application/json' -d '${JSON.stringify(sampleRequest)}'`
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return res.status(500).json({ error: errorMessage });
    }
});

app.get("/test", (req: Request, res: Response) => {
    res.send("test");
});

// Simple landing page
app.get('/', (req: Request, res: Response) => {
    res.send(`
        <html>
        <head>
            <title>EV Calculator API</title>
            <style>
                body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                h1 { color: #333; }
                a { color: #0066cc; }
                code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>EV Calculator API</h1>
            <p>Sports betting expected value calculator.</p>
            <ul>
                <li><a href="/docs">API Documentation</a></li>
                <li><code>POST /calculate-ev</code> - Calculate EV for a single bet</li>
                <li><code>GET /calculate-ev/sample</code> - <a href="/calculate-ev/sample">Get sample request</a></li>
                <li><code>POST /calculate-ev/batch</code> - Calculate EV for multiple bets</li>
                <li><code>GET /calculate-ev/batch/sample</code> - <a href="/calculate-ev/batch/sample">Get sample batch request</a></li>
            </ul>
        </body>
        </html>
    `);
});

// Swagger UI documentation - using CDN for serverless compatibility
const swaggerOptions = {
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js'
    ]
};
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerOptions));

export default app;
