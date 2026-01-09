import app from './server.ts';
import { validateEnvironment } from './config/env.ts';

/**
 * Starts the local development server with environment validation and logging
 */
function startServer() {
    try {
        const env = validateEnvironment();

        console.log('='.repeat(50));
        console.log('Starting Sports Betting EV Calculator API');
        console.log('='.repeat(50));
        console.log(`Environment:     ${env.NODE_ENV}`);
        console.log(`Port:            ${env.PORT}`);
        console.log(`API URL:         ${env.ODDSSHOPPER_API_URL}`);
        console.log(`Timestamp:       ${new Date().toISOString()}`);
        console.log('='.repeat(50));

        app.listen(env.PORT, () => {
            console.log(`✓ Server is running on http://localhost:${env.PORT}`);
            console.log('✓ Health check: GET /test');
            console.log('✓ Calculate EV: POST /calculate-ev');
            console.log('\nPress Ctrl+C to stop the server\n');
        });
    } catch (error) {
        console.error('Failed to start server:');
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error('Unknown error:', error);
        }
        process.exit(1);
    }
}

startServer();
