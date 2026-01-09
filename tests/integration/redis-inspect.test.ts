import { test, expect, describe } from 'bun:test';
import { redis } from 'bun';

describe('Redis Cache Inspection', () => {
    test('should inspect existing cache entries and TTLs', async () => {
        const client = redis;
        expect(client).not.toBeNull();

        console.log('\n=== REDIS CACHE INSPECTION ===\n');

        // Get all keys
        const keys = await client.keys('*');
        console.log(`Total keys found: ${keys.length}\n`);

        // Inspect each key
        for (const key of keys) {
            console.log(`Key: ${key}`);

            // Get TTL
            const ttl = await client.ttl(key);
            if (ttl === -1) {
                console.log('  TTL: No expiration (permanent)');
            } else if (ttl === -2) {
                console.log('  TTL: Key does not exist');
            } else {
                console.log(`  TTL: ${ttl} seconds (${Math.floor(ttl / 60)} minutes)`);
            }

            // Get value (truncated if large)
            const value = await client.get(key);
            if (value) {
                const displayValue = value.length > 200 ? value.substring(0, 200) + '...' : value;
                console.log(`  Value: ${displayValue}`);
            }

            console.log('');
        }

        // Show cache breakdown
        const apiCacheKeys = keys.filter(k => k.startsWith('oddsshopper:offers:'));
        const apiHashKeys = keys.filter(k => k.startsWith('oddsshopper:hash:'));
        const evCacheKeys = keys.filter(k => k.startsWith('ev:calc:'));

        console.log('=== CACHE BREAKDOWN ===');
        console.log(`API Cache (oddsshopper:offers:*): ${apiCacheKeys.length} keys`);
        console.log(`API Hash (oddsshopper:hash:*): ${apiHashKeys.length} keys`);
        console.log(`EV Cache (ev:calc:*): ${evCacheKeys.length} keys`);
    });
});
