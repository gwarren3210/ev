# Integration Tests

These tests require real external services and validate end-to-end functionality.

## Prerequisites

### Redis Server
Integration tests require a Redis server running locally:
- **Host:** `localhost:6379`
- **Environment Variable:** `REDIS_URL=redis://localhost:6379`

### Installation
```bash
# macOS (using Homebrew)
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis

# Verify Redis is running
redis-cli ping  # Should return "PONG"
```

## Running Tests

```bash
# Run only integration tests
bun run test:integration

# Run all tests (unit + integration)
bun run test:all

# Run specific integration test file
bun test tests/integration/redis-connection.test.ts
```

## Test Files

- **redis-connection.test.ts** - Tests Redis connectivity and basic operations
- **redis-inspect.test.ts** - Inspects Redis cache state and key patterns
- **redis-ttl.test.ts** - Verifies TTL (time-to-live) settings on cached data
- **redis-cleanup.test.ts** - Tests cache cleanup and key deletion
- **e2e.test.ts** - End-to-end tests with external API (currently skipped)

## CI/CD Considerations

Integration tests should run:
- **After** unit tests pass
- **With** Redis available in the CI environment
- **Optional** for local development (unit tests run by default)

Example GitHub Actions setup:
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379
```
