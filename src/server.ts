import express, { type Request, type Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { calculateEV } from './logic/ev.js';
import { calculateEVBatch } from './logic/batch.js';
import * as openApiSpec from '../openapi.yaml';
import { fetchSingleSample, fetchBatchSample } from './services/sample.js';
import { CalculateEVRequestSchema, BatchCalculateEVRequestSchema } from './types/index.js';

const app = express();

app.use(cors());
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

/**
 * Wraps async route handlers to catch errors and return 500 responses.
 */
type AsyncHandler = (req: Request, res: Response) => Promise<Response | void>;

function asyncHandler(fn: AsyncHandler) {
    return (req: Request, res: Response) => {
        fn(req, res).catch((error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ error: errorMessage });
        });
    };
}

app.post('/calculate-ev', asyncHandler(async (req: Request, res: Response) => {
    const validationResult = CalculateEVRequestSchema.safeParse(req.body);
    if (validationResult.success === false) {
        return res.status(400).json({
            error: 'Invalid request body',
            details: validationResult.error.message
        });
    }

    const cacheOptions = { skipCache: shouldSkipCache(req) };
    const result = await calculateEV(validationResult.data, cacheOptions);

    if (result.success === false) {
        return res.status(result.error.httpStatus).json({
            error: result.error.message,
            code: result.error.code
        });
    }

    return res.status(200).json(result.value);
}));

app.get('/calculate-ev/sample', asyncHandler(async (req: Request, res: Response) => {
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
}));

app.post('/calculate-ev/batch', asyncHandler(async (req: Request, res: Response) => {
    const validationResult = BatchCalculateEVRequestSchema.safeParse(req.body);
    if (validationResult.success === false) {
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
}));

app.get('/calculate-ev/batch/sample', asyncHandler(async (req: Request, res: Response) => {
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
}));

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
