# Data Assumptions Documentation

This document outlines all assumptions made about `data.json` by the implementation and tests. These assumptions are validated in `main.test.ts`.

## Overview

The implementation in `main.ts` and tests in `main.test.ts` rely on specific data structures and content. This document catalogs these assumptions to help understand requirements and diagnose failures.

---

## Data Structure Assumptions

### Import Format
- **Assumption**: `data.json` can be imported as an ES module
- **Validation**: Import succeeds without errors
- **Required For**: `getData()` function

### Array Structure
- **Assumption**: The imported data is an array of `Offer` objects (or has a `default` property that is an array)
- **Validation**: `Array.isArray(offers)` returns `true`
- **Required For**: Data iteration in `findOffer()`

### Non-Empty Data
- **Assumption**: The data array contains at least one offer
- **Validation**: `offers.length > 0`
- **Required For**: Finding offers by player ID

---

## Offer Structure Assumptions

### Sides Array
- **Assumption**: Every offer has a `sides` array
- **Validation**: `offer.sides` is defined and is an array
- **Required For**: `findSharpBooks()`, `hasBothSides()`

### Over and Under Side Labels
- **Assumption**: Sides use exact labels `'Over'` and `'Under'` (capitalized)
- **Validation**: `side.label === 'Over'` or `side.label === 'Under'`
- **Required For**: `hasBothSides()` function (lines 241, 244, 246)
- **Note**: Non-Over/Under sides are ignored

### Participants Array
- **Assumption**: Every offer has a `participants` array
- **Validation**: `offer.participants` is defined and is an array
- **Required For**: `findOffer()` function

### One Participant Per Offer
- **Assumption**: Each offer has exactly one participant
- **Validation**: `findOffer()` only checks `participants[0]?.id === playerId` (line 222)
- **Note**: Code comment explicitly states "assume there is only one participant per offer"
- **Required For**: Player ID matching (uses strict equality `===`)

### Offer Name
- **Assumption**: Every offer has an `offerName` property
- **Validation**: `offer.offerName` is defined and is a string
- **Required For**: Response `market` field

---

## Outcome Structure Assumptions

### Required Outcome Fields
- **Assumption**: All outcomes have the following required fields:
  - `sportsbookCode`: string
  - `line`: string
  - `label`: `'Over'` | `'Under'` (capitalized, matching side labels)
  - `odds`: number (decimal, used for devigging)
  - `americanOdds`: string (parsed as integer for response)
- **Required For**: All outcome processing

### One Over and One Under Per Book Per Line
- **Assumption**: Each sportsbook has exactly 1 Over outcome and 1 Under outcome per line
- **Validation**: `findTargetOutcomes()` requires exactly 2 outcomes (line 305)
- **Required For**: Devigging calculations require a pair
- **Note**: Side labels and outcome labels both use capitalized 'Over'/'Under'

### Sportsbook Code Case Sensitivity
- **Assumption**: Sportsbook codes use exact case matching (case-sensitive)
- **Validation**: `outcome.sportsbookCode === sportsbookCode` (line 243)
- **Required For**: `hasBothSides()`, `findSharpBooks()`, inline filtering in `main()`
- **Tested In**: `main.test.ts` - sportsbook mismatch tests

### Line Format Consistency
- **Assumption**: Line values are strings that match exactly across Over/Under sides
- **Validation**: `outcome.line === line` (string comparison)
- **Example**: If Over side has `line: "25.5"`, Under side must also use `"25.5"` (not `"25.50"`)
- **Required For**: `hasBothSides()` function

---

## Sharp Book Assumptions

### Both Sides Required
- **Assumption**: Sharp books must have outcomes on BOTH Over and Under sides for the same line
- **Validation**: `hasBothSides()` returns `true`
- **Required For**: `findSharpBooks()` to include a sharp book
- **Tested In**: Multiple tests in `main.test.ts` - "excludes sharp book with only one side"

### Sharp Books Array
- **Assumption**: `req.sharps` is an array of sportsbook code strings
- **Validation**: `sharps.includes(outcome.sportsbookCode)`
- **Required For**: `findSharpBooks()` function

---

## Target Book Assumptions

### Exactly Two Outcomes Required
- **Assumption**: `findTargetOutcomes()` requires EXACTLY 2 outcomes from target book
- **Validation**: `targetOutcomes.length !== 2` returns error (line 306)
- **Required For**: Devigging requires both Over and Under outcomes
- **Error**: Returns `TargetOutcomeNotFoundError` if count != 2
- **Tested In**: `main.test.ts` - "returns error when only 1 outcome", "returns error when more than 2 outcomes"

### Target Book in All Outcomes
- **Assumption**: Target book outcomes are found within all offer outcomes
- **Flow**: `main()` gets `allOutcomes` from all sides, then passes to `findTargetOutcomes()`
- **Note**: Target book does NOT need to be in the sharps list
- **Location**: Lines 106, 110 in `main.ts`

---

## Numeric Assumptions

### Valid Decimal Odds
- **Assumption**: All `outcome.odds` values are finite, positive numbers
- **Validation**: Used directly in division `labelOutcome.odds / totalOdds`
- **Required For**: `devigOdds()` probability calculations
- **Edge Case**: Total odds = 0 returns `DevigError`
- **Tested In**: `main.test.ts` - "returns DevigError when total odds is zero"

### Parseable American Odds
- **Assumption**: All `outcome.americanOdds` strings can be parsed as integers
- **Validation**: `parseInt(americanOddsStr)` with NaN check (lines 120-126)
- **Error**: Returns `CalculationError` with code `'INVALID_AMERICAN_ODDS'` if NaN
- **Required For**: Response `targetOdds` field

### Probability Bounds (Not Enforced)
- **Assumption**: `calculateEV()` accepts any probability value
- **Validation**: No bounds checking; values > 1 or < 0 compute without error
- **Tested In**: `main.test.ts` - "handles probability > 1", "handles negative probability"

---

## Critical Path for main() to Succeed

For `main()` to return a successful result:

1. **getData()** returns offers array
2. **findOffer()** finds offer where `participants[0].id === playerId`
3. **findSharpBooks()** finds at least one sharp with both Over/Under sides
4. **Inline filter** (line 108) finds outcomes matching sharp books
5. **findTargetOutcomes()** finds EXACTLY 2 outcomes from target book
6. **parseInt(americanOdds)** returns valid number (not NaN)
7. **calculateTrueProbability()** has at least one successful devig
8. **calculateImpliedProbability()** successfully devigs target outcomes
9. **calculateEV()** computes (always succeeds if inputs are numbers)

---

## Failure Modes

| Failure | Cause | Error Type |
|---------|-------|------------|
| Offer not found | No offer with matching player ID | `OfferNotFoundError` |
| No sharp outcomes | No sharps have both sides for any line | `NoSharpOutcomesError` |
| Target not found | Target book doesn't have exactly 2 outcomes in sharp outcomes | `TargetOutcomeNotFoundError` |
| Invalid American odds | `americanOdds` can't be parsed as integer | `CalculationError` (INVALID_AMERICAN_ODDS) |
| Devig failed | No label/opposite outcome found, or total odds = 0 | `DevigError` |
| No successful devigs | All sharp book devigs failed | `DevigError` |

---

## Test Coverage

Tests in `main.test.ts` validate:

- **69 tests** covering edge cases
- **All helper functions** tested independently
- **Error classes** tested for instantiation and inheritance
- **Edge cases**: empty arrays, missing data, boundary conditions, high/low odds

---

## Related Files

- `main.test.ts`: Unit tests validating these assumptions (Bun test runner)
- `main.ts`: Implementation code
- `baseEndpointTypes.ts`: Type definitions for Offer, Outcome, Side, Participant
- `oldMain.test.ts`: Legacy tests (different function signatures, Jest-style)
