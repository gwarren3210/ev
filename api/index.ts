import app from '../src/server.ts';
import { validateEnvironment } from '../src/config/env.ts';

// Validate environment variables on startup
validateEnvironment();

export default app;
