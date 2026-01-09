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

# Optional: OddsShopper API Configuration
ODDSSHOPPER_API_URL=the url of the odds shopper api
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

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/ev.test.ts

# coverage
bun test --coverage
```

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
  "devigMethod": "multiplicative" | "additive" | "power" | "shin" | "os_skewed"
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
- `os_skewed` - Over/Under specific (65% vig on Over, 35% on Under)

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
│   └── index.ts                # Vercel serverless entry point
├── src/
│   ├── config/
│   │   └── env.ts              # Environment validation
│   ├── data/
│   │   ├── data.json           # Sample data
│   │   └── jan10data.json      # Sample data
│   ├── errors/
│   │   └── index.ts            # Custom error classes
│   ├── logic/
│   │   ├── ev.ts               # EV calculation orchestration
│   │   └── devig.ts            # Devigging algorithms
│   ├── server/
│   │   └── app.ts              # Express app configuration
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── utils/
│   │   └── odds.ts             # Odds conversion utilities
│   └── local.ts                # Local development server
├── tests/
│   ├── ev.test.ts              # EV calculation tests
│   ├── devig.test.ts           # Devigging algorithm tests
│   └── dataAssumptions.test.ts # Data structure validation
├── docs/
│   ├── dataAssumptions.md      # Data structure validation docs
│   └── shinProof.md            # Mathematical proof: Shin = Additive for n=2
├── .env.example                # Environment variables template
├── openapi.yaml                # OpenAPI 3.0 specification
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

### Error Handling

Uses a `Result<T, E>` pattern for type-safe error handling:

```typescript
type Result<T, E extends Error = Error> =
  | { success: true; value: T }
  | { success: false; error: E };
```

All errors extend `CalculationError` with proper HTTP status codes.

## Testing

The project includes comprehensive test coverage:

- **Unit Tests**: Individual function testing with edge cases
- **Integration Tests**: Full calculation flow validation
- **Data Validation**: Assumptions about API data structure

Run tests before deploying:

```bash
bun test

# Run with coverage report
bun test --coverage
```

### Coverage Report

```
---------------------|---------|---------|-------------------
File                 | % Funcs | % Lines | Uncovered Line #s
---------------------|---------|---------|-------------------
All files            |   69.28 |   68.33 |
 src/config/env.ts   |    0.00 |   36.84 | 20-30
 src/errors/index.ts |  100.00 |  100.00 |
 src/logic/devig.ts  |  100.00 |  100.00 |
 src/logic/ev.ts     |   82.35 |   33.13 | 37-114,121-145,204-211
 src/types/index.ts  |  100.00 |  100.00 |
 src/utils/odds.ts   |   33.33 |   40.00 | 13-16,27-28
---------------------|---------|---------|-------------------

105 pass, 0 fail, 50259 expect() calls
```

**Coverage Highlights:**
- Core devigging algorithms: **100% coverage**
- Error handling: **100% coverage**
- Type definitions: **100% coverage**
- Overall: **69.28% function coverage**, **68.33% line coverage**

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
