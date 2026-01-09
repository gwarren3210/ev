// Auto-generated from openapi.yaml - DO NOT EDIT DIRECTLY
// To update, modify openapi.yaml and regenerate this file

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Sports Betting EV Calculator API",
    description: `A production-ready API for calculating Expected Value (EV) on sports betting markets
using multiple devigging methods and sharp book aggregation.

This service fetches live odds from the OddsShopper API, removes bookmaker vigorish
using various devigging algorithms, and calculates the true expected value of a bet
by comparing a target book's odds against aggregated sharp book probabilities.`,
    version: "1.0.0",
    contact: {
      name: "API Support"
    }
  },
  servers: [
    {
      url: "http://localhost:8080",
      description: "Local development server"
    },
    {
      url: "https://stokastic.vercel.app",
      description: "Production server"
    }
  ],
  paths: {
    "/calculate-ev": {
      post: {
        summary: "Calculate Expected Value",
        description: `Calculates the Expected Value (EV) for a specific bet by comparing target book odds
against aggregated sharp book probabilities.

**Process:**
1. Fetches live market data from OddsShopper API
2. Identifies the targeted player offer
3. Filters sharp books with complete two-sided markets
4. Calculates true probability by aggregating devigged sharp book odds
5. Calculates implied probability from target book odds
6. Computes final EV percentage`,
        operationId: "calculateEV",
        tags: ["EV Calculation"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CalculateEVRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "EV calculated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CalculateEVResponse" }
              }
            }
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationError" }
              }
            }
          },
          "404": {
            description: "Offer or outcome not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiError" }
              }
            }
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericError" }
              }
            }
          }
        }
      }
    },
    "/calculate-ev/sample": {
      get: {
        summary: "Get Sample Request",
        description: `Returns a live sample request body for the /calculate-ev endpoint.
Fetches real data from OddsShopper API to generate a valid request that can be used immediately.

The response includes:
- A description of the sample
- The request body to send to POST /calculate-ev
- A ready-to-use curl command`,
        operationId: "getSample",
        tags: ["Samples"],
        responses: {
          "200": {
            description: "Sample request generated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SampleResponse" }
              }
            }
          },
          "503": {
            description: "No live sample data available",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericError" }
              }
            }
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericError" }
              }
            }
          }
        }
      }
    },
    "/calculate-ev/batch": {
      post: {
        summary: "Batch Calculate Expected Value",
        description: `Calculates Expected Value (EV) for multiple bets in a single request.
All items must share the same offerId, which allows for a single API call
to fetch market data, improving efficiency.

**Benefits:**
- Single API call for market data (offerId is shared)
- Individual item caching
- Partial success handling (some items can fail while others succeed)

**Limits:**
- Maximum 10 items per batch request`,
        operationId: "calculateEVBatch",
        tags: ["EV Calculation"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BatchCalculateEVRequest" }
            }
          }
        },
        responses: {
          "200": {
            description: "Batch processed (may contain partial failures)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BatchCalculateEVResponse" }
              }
            }
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationError" }
              }
            }
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericError" }
              }
            }
          }
        }
      }
    },
    "/calculate-ev/batch/sample": {
      get: {
        summary: "Get Sample Batch Request",
        description: `Returns a live sample request body for the /calculate-ev/batch endpoint.
Fetches real data from OddsShopper API to generate a valid batch request with multiple players.

The response includes:
- A description of the sample
- Player names included in the batch
- The request body to send to POST /calculate-ev/batch
- A ready-to-use curl command`,
        operationId: "getBatchSample",
        tags: ["Samples"],
        responses: {
          "200": {
            description: "Sample batch request generated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BatchSampleResponse" }
              }
            }
          },
          "503": {
            description: "No live sample data available",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericError" }
              }
            }
          },
          "500": {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenericError" }
              }
            }
          }
        }
      }
    },
    "/test": {
      get: {
        summary: "Health check",
        description: "Simple health check endpoint to verify the service is running",
        operationId: "healthCheck",
        tags: ["Health"],
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "text/plain": {
                schema: {
                  type: "string",
                  example: "test"
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      CalculateEVRequest: {
        type: "object",
        required: ["offerId", "playerId", "sharps", "targetBook", "line", "side", "devigMethod"],
        properties: {
          offerId: { type: "string", description: "The unique offer identifier from OddsShopper API" },
          playerId: { type: "string", description: "The unique player identifier" },
          sharps: { type: "array", items: { type: "string" }, description: "Array of sharp sportsbook codes" },
          targetBook: { type: "string", description: "The target sportsbook code to evaluate for EV" },
          line: { type: "number", description: "The betting line" },
          side: { type: "string", enum: ["Over", "Under"], description: "The side of the bet" },
          devigMethod: {
            type: "string",
            enum: ["multiplicative", "additive", "power", "shin", "os_skewed"],
            description: "The devigging method to use"
          },
          bankroll: { type: "number", description: "Optional bankroll for Kelly Criterion" }
        }
      },
      CalculateEVResponse: {
        type: "object",
        properties: {
          player: { type: "string" },
          market: { type: "string" },
          line: { type: "number" },
          side: { type: "string" },
          targetBook: { type: "string" },
          targetOdds: { type: "number" },
          trueProbability: { type: "number" },
          impliedProbability: { type: "number" },
          expectedValue: { type: "number" },
          sharpsUsed: { type: "array", items: { type: "string" } },
          bestAvailableOdds: {
            type: "object",
            properties: {
              sportsbookCode: { type: "string" },
              americanOdds: { type: "number" }
            }
          },
          kelly: { $ref: "#/components/schemas/KellyBetSizing" }
        }
      },
      BatchCalculateEVRequest: {
        type: "object",
        required: ["offerId", "items"],
        properties: {
          offerId: { type: "string" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/BatchEVItem" },
            maxItems: 10
          }
        }
      },
      BatchEVItem: {
        type: "object",
        required: ["playerId", "line", "side", "targetBook", "sharps", "devigMethod"],
        properties: {
          playerId: { type: "string" },
          line: { type: "number" },
          side: { type: "string", enum: ["Over", "Under"] },
          targetBook: { type: "string" },
          sharps: { type: "array", items: { type: "string" } },
          devigMethod: { type: "string", enum: ["multiplicative", "additive", "power", "shin", "os_skewed"] },
          bankroll: { type: "number" }
        }
      },
      BatchCalculateEVResponse: {
        type: "object",
        properties: {
          offerId: { type: "string" },
          totalItems: { type: "integer" },
          successCount: { type: "integer" },
          errorCount: { type: "integer" },
          results: { type: "array", items: { type: "object" } }
        }
      },
      KellyBetSizing: {
        type: "object",
        properties: {
          full: { type: "number" },
          quarter: { type: "number" },
          recommendedBet: { type: "number" },
          expectedProfit: { type: "number" },
          bankroll: { type: "number" }
        }
      },
      ApiError: {
        type: "object",
        properties: {
          error: { type: "string" },
          code: { type: "string" }
        }
      },
      ValidationError: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "string" }
        }
      },
      GenericError: {
        type: "object",
        properties: {
          error: { type: "string" }
        }
      },
      SampleResponse: {
        type: "object",
        properties: {
          description: { type: "string", description: "Description of the sample data" },
          request: { $ref: "#/components/schemas/CalculateEVRequest" },
          curl: { type: "string", description: "Ready-to-use curl command" }
        }
      },
      BatchSampleResponse: {
        type: "object",
        properties: {
          description: { type: "string", description: "Description of the sample data" },
          playerNames: { type: "array", items: { type: "string" }, description: "Names of players in the batch" },
          request: { $ref: "#/components/schemas/BatchCalculateEVRequest" },
          curl: { type: "string", description: "Ready-to-use curl command" }
        }
      }
    }
  },
  tags: [
    { name: "EV Calculation", description: "Calculate expected value for sports bets" },
    { name: "Samples", description: "Get sample requests with live data" },
    { name: "Health", description: "Health check endpoints" }
  ]
} as const;
