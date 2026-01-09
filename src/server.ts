import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { calculateEV } from './logic/ev.js';

const app = express();

app.use(express.json());

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

        const result = await calculateEV(validationResult.data);

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

app.get("/test", (req: Request, res: Response) => {
    res.send("test");
});

export default app;
