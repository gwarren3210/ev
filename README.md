# Sports Betting EV Calculator API

An API for calculating Expected Value (EV) on sports betting markets using multiple devigging methods and sharp book aggregation.

## Overview

This service fetches live odds from the OddsShopper API, removes bookmaker vigorish using various devigging algorithms, and calculates the true expected value of a bet by comparing a target book's odds against aggregated sharp book probabilities.

## Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Testing](#testing)
- [Deployment](#deployment)

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
cd ev

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
  "devigMethod": "multiplicative" | "additive" | "power" | "shin" | "osskewed"
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
- `osskewed` - Over/Under specific (65% vig on Over, 35% on Under)

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

| Status | Code | Description |
|--------|------|-------------|
| 400 | - | Invalid request body (validation error) |
| 404 | `OFFER_NOT_FOUND` | Offer ID not found |
| 404 | `OFFER_NOT_FOUND_FOR_PLAYER` | Player not in offer |
| 409 | `ONE_SIDED_MARKET` | Target book missing one side |
| 422 | `NO_SHARP_OUTCOMES` | No sharp book data available |
| 502 | `API_ERROR` | Upstream API error |

### Example Request

```bash
curl -X POST https://stokastic.vercel.app/calculate-ev \
  -H "Content-Type: application/json" \
  -d '{
    "offerId":"aa4dd9a9-6aec-44f9-8ae0-3599520b9351",
    "sharps":["Kalshi","NoVig", "BetMGM"],
    "targetBook":"BetRivers",
    "playerId":"1a1f9906-2493-4446-a4bd-c013bc30e7e2",
    "line":18.5,"side":"Over",
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
src/
├── cache/          # Redis caching layer
├── config/         # Environment validation
├── errors/         # Custom error classes
├── logic/          # EV calculation, devigging, batch processing
├── services/       # OddsShopper API client
├── types/          # TypeScript interfaces
├── utils/          # Odds conversion utilities
└── server.ts       # Express app

tests/
├── unit/           # Fast, isolated tests
├── integration/    # Redis-dependent tests
└── fixtures/       # Data structure validation
    └── data/       # Test data files

api/                # Vercel serverless entry point
docs/               # Mathematical proofs and data docs
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

```bash
bun test                     # Unit tests (fast, isolated)
bun run test:integration     # Integration tests (requires Redis)
bun run test:fixtures        # Data validation tests
bun run test:all             # All tests
bun run test:watch           # Watch mode
bun test --coverage          # Coverage report
```

| Category | Tests | Description |
|----------|-------|-------------|
| Unit | 161 | Fast, isolated with mocks |
| Integration | 83 | Requires Redis on localhost:6379 |
| Fixtures | 36 | Data structure validation |

**Coverage**: 89.61% functions, 89.68% lines. Core algorithms at 100%.

See [tests/integration/README.md](tests/integration/README.md) for integration test setup.

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
