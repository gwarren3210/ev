# Sports Betting EV Calculator API

An API for calculating Expected Value (EV) on sports betting markets using multiple devigging methods and sharp book aggregation.

## Overview

This service fetches live odds from the OddsShopper API, removes bookmaker vigorish using various devigging algorithms, and calculates the true expected value of a bet by comparing a target book's odds against aggregated sharp book probabilities.

## Features

- **5 Devigging Methods**: Multiplicative, Additive, Power, Shin, and OS Skewed
- **Sharp Book Aggregation**: Averages devigged probabilities from multiple sharp books

## Tech Stack

- **Runtime**: Bun
- **Framework**: Express.js with TypeScript
- **Validation**: Zod
- **Testing**: Bun test
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0 or higher
- Node.js 18+ (for compatibility)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd stokastic-interview2

# Install dependencies
bun install
```

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Server Configuration
PORT=8080
NODE_ENV=development

# API Configuration
ODDSSHOPPER_API_URL=the url of the odds shopper api

# Redis Configuration (optional - for caching)
REDIS_URL=redis://localhost:6379
REDIS_API_CACHE_TTL=60        # API response cache TTL in seconds
REDIS_EV_CACHE_TTL=300        # EV result cache TTL in seconds
```

### Running Locally

```bash
# Development mode with hot reload
bun run dev

# Production mode
bun run start
```

The server will start on `http://localhost:8080` (or your configured PORT).

### Running Tests

The test suite is organized into unit tests (fast, isolated), integration tests (requires Redis), and fixture tests:

```bash
# Run unit tests (default - fast feedback)
bun test
# or
bun run test:unit

# Run integration tests (requires Redis)
bun run test:integration

# Run fixture/data validation tests
bun run test:fixtures

# Run all tests
bun run test:all

# Watch mode for unit tests
bun run test:watch

# Run with coverage
bun test --coverage
```

**Prerequisites for integration tests:**
- Redis server running on `localhost:6379`
- Set `REDIS_URL` environment variable

See [tests/integration/README.md](tests/integration/README.md) for more details.

## API Documentation

### Calculate EV

**Endpoint**: `POST /calculate-ev`

Calculates the Expected Value (EV) for a specific bet by comparing target book odds against aggregated sharp book probabilities.

#### Request Body

```json
{
  "offerId": "string",
  "playerId": "string",
  "sharps": ["string"],
  "targetBook": "string",
  "line": "number",
  "side": "Over" | "Under",
  "devigMethod": "multiplicative" | "additive" | "power" | "shin" | "osskeweded"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `offerId` | string | Yes | The unique offer identifier from OddsShopper |
| `playerId` | string | Yes | The unique player identifier |
| `sharps` | string[] | Yes | Array of sharp sportsbook codes (e.g., ["Pinnacle", "BookMaker"]) |
| `targetBook` | string | Yes | The target sportsbook code to evaluate |
| `line` | number | Yes | The betting line (e.g., 5.5 for points) |
| `side` | string | Yes | Either "Over" or "Under" |
| `devigMethod` | string | Yes | The devigging method to use |

**Devigging Methods:**

- `multiplicative` - Margin proportional to odds (most common)
- `additive` - Equal vig distribution across outcomes
- `power` - Logarithmic distribution via binary search
- `shin` - Assumes insider trading (equivalent to additive for n=2)
- `osskeweded` - Over/Under specific (65% vig on Over, 35% on Under)

#### Response

**Success (200 OK):**

```json
{
  "player": "LeBron James",
  "market": "Points",
  "line": 25.5,
  "side": "Over",
  "targetBook": "DraftKings",
  "targetOdds": -110,
  "trueProbability": 0.48,
  "impliedProbability": 0.52,
  "expectedValue": -7.69,
  "sharpsUsed": ["Pinnacle", "BookMaker"]
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `player` | string | Player name |
| `market` | string | Market type (e.g., "Points", "Rebounds") |
| `line` | number | The betting line |
| `side` | string | "Over" or "Under" |
| `targetBook` | string | Target sportsbook evaluated |
| `targetOdds` | number | American odds from target book |
| `trueProbability` | number | Calculated devigged & estimated true probability (0-1) |
| `impliedProbability` | number | Target book's implied probability (0-1) |
| `expectedValue` | number | EV as a percentage (e.g., 5.2 for 5.2%) |
| `sharpsUsed` | string[] | Sharp books successfully used in calculation |

#### Error Responses

**400 Bad Request** - Invalid request body:
```json
{
  "error": "Invalid request body",
  "details": "validation error message"
}
```

**404 Not Found** - Offer or outcome not found:
```json
{
  "error": "Offer not found for ID: abc123",
  "code": "OFFER_NOT_FOUND"
}
```

Or when player not found in offer:
```json
{
  "error": "Offer not found for player ID: player-123",
  "code": "OFFER_NOT_FOUND_FOR_PLAYER"
}
```

**409 Conflict** - One-sided market:
```json
{
  "error": "Target outcome not complete for book: DraftKings",
  "code": "ONE_SIDED_MARKET"
}
```

**422 Unprocessable Entity** - Calculation errors:
```json
{
  "error": "No sharp outcomes found for sharps: Pinnacle, BookMaker",
  "code": "NO_SHARP_OUTCOMES"
}
```

**502 Bad Gateway** - Upstream API error:
```json
{
  "error": "Upstream error: Service Unavailable",
  "code": "API_ERROR"
}
```

### Example Request

```bash
curl -X POST http://localhost:8080/calculate-ev \
  -H "Content-Type: application/json" \
  -d '{
    "offerId": "nba-player-points",
    "playerId": "player-123",
    "sharps": ["Pinnacle", "BookMaker"],
    "targetBook": "DraftKings",
    "line": 25.5,
    "side": "Over",
    "devigMethod": "multiplicative"
  }'
```

### Health Check

**Endpoint**: `GET /test`

Simple health check endpoint.

**Response (200 OK):**
```
test
```

## Project Structure

```
stokastic-interview2/
├── api/
│   └── index.ts                      # Vercel serverless entry point
├── src/
│   ├── cache/
│   │   ├── index.ts                  # Caching logic (Redis)
│   │   └── redis.ts                  # Redis client setup
│   ├── config/
│   │   └── env.ts                    # Environment validation
│   ├── data/
│   │   ├── data.json                 # Sample data
│   │   └── jan10data.json            # Sample data
│   ├── errors/
│   │   └── index.ts                  # Custom error classes
│   ├── logic/
│   │   ├── batch.ts                  # Batch EV calculation
│   │   ├── ev.ts                     # EV calculation orchestration
│   │   └── devig.ts                  # Devigging algorithms
│   ├── server/
│   │   └── app.ts                    # Express app configuration
│   ├── services/
│   │   └── oddsshopper.ts            # OddsShopper API client
│   ├── types/
│   │   └── index.ts                  # TypeScript interfaces
│   ├── utils/
│   │   └── odds.ts                   # Odds conversion utilities
│   └── local.ts                      # Local development server
├── tests/
│   ├── unit/                         # Unit tests (fast, isolated)
│   │   ├── cache.test.ts             # Cache logic tests
│   │   ├── env.test.ts               # Environment validation tests
│   │   ├── ev.test.ts                # EV calculation tests
│   │   ├── devig.test.ts             # Devigging algorithm tests
│   │   ├── odds.test.ts              # Odds utility tests
│   │   └── oddsshopper.test.ts       # API client tests
│   ├── integration/                  # Integration tests (requires Redis)
│   │   ├── redis-connection.test.ts  # Redis connectivity tests
│   │   ├── redis-inspect.test.ts     # Redis inspection tests
│   │   ├── redis-ttl.test.ts         # TTL verification tests
│   │   ├── redis-cleanup.test.ts     # Cache cleanup tests
│   │   ├── e2e.test.ts               # End-to-end tests
│   │   └── README.md                 # Integration test documentation
│   └── fixtures/                     # Data validation tests
│       └── dataAssumptions.test.ts   # Data structure validation
├── docs/
│   ├── dataAssumptions.md            # Data structure validation docs
│   └── shinProof.md                  # Mathematical proof: Shin = Additive for n=2
├── .env.example                      # Environment variables template
├── bunfig.toml                       # Bun test configuration
├── openapi.yaml                      # OpenAPI 3.0 specification
├── package.json
├── tsconfig.json
└── vercel.json
```

## Architecture

### Calculation Flow

1. **Fetch Market Data** - Retrieves live odds from OddsShopper API
2. **Identify Target Offer** - Finds the specific player/market
3. **Filter Sharp Books** - Validates sharp books have complete two-sided markets
4. **Extract Target Odds** - Gets American odds from target sportsbook
5. **Calculate True Probability** - Aggregates devigged probabilities from sharp books
6. **Calculate Implied Probability** - Deviggs target book odds
7. **Compute EV** - `EV% = (trueProbability × decimalOdds - 1) × 100`

### Caching Strategy

The application uses **Redis** for two-layer caching to optimize performance:

**Layer 1: API Response Cache**
- **Key Format**: `oddsshopper:offers:{offerId}:{playerId}`
- **TTL**: 60 seconds (configurable via `REDIS_API_CACHE_TTL`)
- **Purpose**: Cache raw offer data from OddsShopper API
- **Invalidation**: Hash-based change detection

**Layer 2: EV Result Cache**
- **Key Format**: `ev:calc:{offerId}:{playerId}:{line}:{side}:{targetBook}:{sharps}:{method}`
- **TTL**: 300 seconds (configurable via `REDIS_EV_CACHE_TTL`)
- **Purpose**: Cache computed EV calculations
- **Invalidation**: Automatic when source offer data changes

**Smart Invalidation:**
- When offer data is updated, a hash comparison triggers selective cache invalidation
- Only affected EV calculations are cleared, not the entire cache
- Ensures data consistency while maximizing cache hit rates

**Cache Bypass:**
- Query parameter: `?fresh=true`
- HTTP header: `Cache-Control: no-cache`

### Error Handling

Uses a `Result<T, E>` pattern for type-safe error handling:

```typescript
type Result<T, E extends Error = Error> =
  | { success: true; value: T }
  | { success: false; error: E };
```

All errors extend `CalculationError` with proper HTTP status codes.

## Testing

The project includes comprehensive test coverage organized into three categories:

### Test Structure

```
tests/
├── unit/          # 161 tests - Fast, isolated with mocks
│   └── Tests for cache, env, ev, devig, odds, and oddsshopper
│
├── integration/   # 83 tests - Real Redis connections
│   └── Tests for batch processing, server endpoints, cache operations
│
└── fixtures/      # 36 tests - Data validation
    └── Tests for data structure assumptions
```

### Running Tests

```bash
# Quick feedback - unit tests only (default)
bun test                     # 161 tests

# Test categories
bun run test:unit           # Unit tests (fast, isolated)
bun run test:integration    # Integration tests (requires Redis)
bun run test:fixtures       # Data validation tests

# All tests
bun run test:all            # 280 tests across 15 files

# Development
bun run test:watch          # Watch mode for unit tests
bun test --coverage         # Coverage report
```

### Test Organization

**Unit Tests** (`tests/unit/`)
- **Fast execution** (<50ms) with mocked dependencies
- **No external services** required
- **Isolated testing** of business logic
- Mock Redis and API clients for predictable behavior

**Integration Tests** (`tests/integration/`)
- **Real Redis** connection required
- **Batch processing** tests with mocked API data
- **Server endpoint** tests for HTTP request/response
- **Cache operations** tests with real Redis
- **TTL verification** and cache invalidation tests
- See [tests/integration/README.md](tests/integration/README.md) for setup

**Fixture Tests** (`tests/fixtures/`)
- **Data structure validation**
- Ensures API response format assumptions are correct

### Test Results

```
280 pass
14 skip
0 fail
50653 expect() calls
Ran 294 tests across 15 files. [3.16s]
```

### Coverage Report

```
-----------------------------|---------|---------|-------------------
File                         | % Funcs | % Lines | Uncovered Line #s
-----------------------------|---------|---------|-------------------
All files                    |   89.61 |   89.68 |
 src/cache/index.ts          |  100.00 |  100.00 |
 src/cache/redis.ts          |    0.00 |   17.24 | 11-31,38,45-46
 src/config/env.ts           |  100.00 |  100.00 |
 src/errors/index.ts         |  100.00 |  100.00 |
 src/logic/batch.ts          |  100.00 |   82.73 | 90-99,130-138
 src/logic/devig.ts          |  100.00 |  100.00 |
 src/logic/ev.ts             |  100.00 |   96.57 | 46,90,103,110,121
 src/server.ts               |   85.71 |   91.67 | 60-62,98-100
 src/services/oddsshopper.ts |  100.00 |   98.28 |
 src/types/index.ts          |  100.00 |  100.00 |
 src/utils/odds.ts           |  100.00 |  100.00 |
-----------------------------|---------|---------|-------------------
```

### Coverage Highlights

- **Overall**: 89.61% functions, 89.68% lines
- Core devigging algorithms: **100% coverage**
- EV calculation logic: **100% function coverage**
- Cache operations: **100% coverage**
- Error handling: **100% coverage**
- Type definitions: **100% coverage**

## Deployment

### Vercel

The project is configured for Vercel serverless deployment:

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy
vercel

# Production deployment
vercel --prod
```

Configuration in `vercel.json` routes all requests to `/api/index`.

## Additional Resources

- [Shin Method Proof](docs/shinProof.md)
- [Data Assumptions](docs/dataAssumptions.md)
- [Bun Documentation](https://bun.sh/docs)
