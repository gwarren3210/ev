import app from '../src/server.js';
import { validateEnvironment } from '../src/config/env.js';

// Validate environment variables on startup
validateEnvironment();

export default app;
