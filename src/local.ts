import app from './server.js';
import { validateEnvironment } from './config/env.js';

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

        // Use Bun.serve to wrap your express app
        // This ensures the process stays alive correctly in Bun
        app.listen(env.PORT, () => {
            console.log(`✓ Server is running on http://localhost:${env.PORT}`);
            console.log('✓ Health check: GET /test');
            console.log('✓ Calculate EV: POST /calculate-ev');
            console.log('\nPress Ctrl+C to stop the server\n');
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();