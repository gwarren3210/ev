import { test, expect } from 'bun:test';
import { redis } from 'bun';

test('cleanup bad cache entries', async () => {
    const client = redis;
    expect(client).not.toBeNull();

    console.log('Cleaning up bad cache entries...');

    // Remove the permanent entry
    await client.del('oddsshopper:offers:offer123');
    console.log('✓ Removed oddsshopper:offers:offer123');

    // Show current state
    const keys = await client.keys('*');
    console.log(`Total keys remaining: ${keys.length}`);

    if (keys.length > 0) {
        console.log('Remaining keys:', keys);
    }
});
