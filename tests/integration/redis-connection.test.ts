import { test, expect, describe } from 'bun:test';
import { redis } from 'bun';

describe('Redis Connection Diagnostics', () => {
    test('should connect to Redis and list all keys', async () => {
        console.log('Testing Redis connection...');
        console.log('REDIS_URL:', process.env.REDIS_URL);

        // Use Bun's redis client directly to bypass any mocks
        const client = redis;
        expect(client).not.toBeNull();

        console.log('✓ Redis client obtained');

        // Test basic operations
        console.log('\nTesting basic operations...');

        // Set a test value
        await client.set('test:key', 'test-value');
        console.log('✓ SET test:key');

        // Get the value
        const value = await client.get('test:key');
        console.log('✓ GET test:key =', value);
        expect(value).toBe('test-value');

        // Check all keys
        console.log('\nListing all keys...');
        const keys = await client.keys('*');
        console.log('Total keys in Redis:', keys.length);

        if (keys.length > 0) {
            console.log('Keys:', keys.slice(0, 20)); // Show first 20 keys
            if (keys.length > 20) {
                console.log(`... and ${keys.length - 20} more`);
            }

            // Show cache-specific keys
            const apiCacheKeys = keys.filter(k => k.startsWith('oddsshopper:offers:'));
            const apiHashKeys = keys.filter(k => k.startsWith('oddsshopper:hash:'));
            const evCacheKeys = keys.filter(k => k.startsWith('ev:calc:'));

            console.log('\nCache breakdown:');
            console.log(`  API Cache (oddsshopper:offers:*): ${apiCacheKeys.length} keys`);
            console.log(`  API Hash (oddsshopper:hash:*): ${apiHashKeys.length} keys`);
            console.log(`  EV Cache (ev:calc:*): ${evCacheKeys.length} keys`);
        }

        // Clean up
        await client.del('test:key');
        console.log('\n✓ Cleanup complete');
    });
});
