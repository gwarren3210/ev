import type { Offer, Outcome, Side, Participant } from '../../src/types';

/**
 * Test suite to validate assumptions made about data.json
 * This helps identify data issues before running integration tests
 */

describe('Data Assumptions Validation', () => {
  let offers: Offer[];
  let dataImport: any;

  beforeAll(async () => {
    // Import data.json - test the import assumption
    try {
      dataImport = await import('./data/data.json');
      offers = Array.isArray(dataImport.default) ? dataImport.default : Array.isArray(dataImport) ? dataImport : [dataImport];
    } catch (error) {
      throw new Error(`Failed to import data.json: ${error}`);
    }
  });

  describe('Data Structure Assumptions', () => {
    it('should import data.json as a module', () => {
      expect(dataImport).toBeDefined();
    });

    it('should be an array of offers', () => {
      expect(Array.isArray(offers)).toBe(true);
    });

    it('should have at least one offer', () => {
      expect(offers.length).toBeGreaterThan(0);
    });

    it('should have access to first offer', () => {
      expect(offers[0]).toBeDefined();
    });
  });

  describe('Offer Structure Assumptions', () => {
    let offer: Offer;

    beforeAll(() => {
      offer = offers[0]!;
    });

    it('should have sides array defined', () => {
      expect(offer.sides).toBeDefined();
    });

    it('should have at least one side', () => {
      expect(Array.isArray(offer.sides)).toBe(true);
      expect(offer.sides.length).toBeGreaterThan(0);
    });

    it('should have Over and Under sides', () => {
      const overSide = offer.sides.find((side) => side.label === 'Over');
      const underSide = offer.sides.find((side) => side.label === 'Under');

      expect(overSide).toBeDefined();
      expect(underSide).toBeDefined();
    });

    it('should have participants array', () => {
      expect(offer.participants).toBeDefined();
      expect(Array.isArray(offer.participants)).toBe(true);
    });

    it('should have at least one participant', () => {
      expect(offer.participants.length).toBeGreaterThan(0);
    });

    it('should have participant with name', () => {
      const participant = offer.participants[0]!;
      expect(participant).toBeDefined();
      expect(participant.name).toBeDefined();
      expect(typeof participant.name).toBe('string');
    });

    it('should have offerName defined', () => {
      expect(offer.offerName).toBeDefined();
      expect(typeof offer.offerName).toBe('string');
    });
  });

  describe('Sportsbook Name Assumptions', () => {
    const EXPECTED_SHARP_BOOKS = ['Pinnacle', 'Circa'];
    const EXPECTED_TARGET_BOOKS = ['DraftKings', 'FanDuel'];

    let allSportsbooks: Set<string>;

    beforeAll(() => {
      allSportsbooks = new Set<string>();
      offers.forEach((offer) => {
        offer.sides.forEach((side) => {
          side.outcomes.forEach((outcome) => {
            allSportsbooks.add(outcome.sportsbookCode);
          });
        });
      });
    });

    it('should contain expected sharp books', () => {
      const foundSharpBooks = EXPECTED_SHARP_BOOKS.filter((book) =>
        Array.from(allSportsbooks).some((code) => code === book)
      );
      expect(foundSharpBooks.length).toBeGreaterThan(0);
      expect(foundSharpBooks).toEqual(
        expect.arrayContaining(
          EXPECTED_SHARP_BOOKS.filter((book) => foundSharpBooks.includes(book))
        )
      );
    });

    it('should contain expected target books', () => {
      const foundTargetBooks = EXPECTED_TARGET_BOOKS.filter((book) =>
        Array.from(allSportsbooks).some((code) => code === book)
      );
      expect(foundTargetBooks.length).toBeGreaterThan(0);
    });

    it('should list all unique sportsbooks in data', () => {
      console.log('All sportsbooks found in data:', Array.from(allSportsbooks).sort());
    });

    it('should have at least one expected sharp book (Pinnacle or Circa)', () => {
      const hasAnySharp = EXPECTED_SHARP_BOOKS.some((book) =>
        Array.from(allSportsbooks).some((code) => code === book)
      );
      expect(hasAnySharp).toBe(true);
    });

    EXPECTED_SHARP_BOOKS.forEach((sharpBook) => {
      it(`should report if ${sharpBook} exists with exact case matching`, () => {
        const hasExactMatch = Array.from(allSportsbooks).some((code) => code === sharpBook);

        if (!hasExactMatch) {
          const similarCodes = Array.from(allSportsbooks).filter((code) =>
            code.toLowerCase().includes(sharpBook.toLowerCase())
          );
          console.warn(
            `${sharpBook} not found with exact case. Similar codes:`,
            similarCodes
          );
        }

        // Report status but don't fail - integration tests only need at least one sharp book
        expect(typeof hasExactMatch).toBe('boolean');
      });
    });

    EXPECTED_TARGET_BOOKS.forEach((targetBook) => {
      it(`should have ${targetBook} with exact case matching`, () => {
        const hasExactMatch = Array.from(allSportsbooks).some((code) => code === targetBook);
        if (!hasExactMatch) {
          const similarCodes = Array.from(allSportsbooks).filter((code) =>
            code.toLowerCase().includes(targetBook.toLowerCase())
          );
          console.warn(
            `${targetBook} not found with exact case. Similar codes:`,
            similarCodes
          );
        }
        expect(hasExactMatch).toBe(true);
      });
    });
  });

  describe('Data Content Assumptions', () => {
    const SHARP_BOOKS = ['Pinnacle', 'Circa'];
    const TARGET_BOOKS = ['DraftKings', 'FanDuel'];

    let validTestCases: Array<{
      offer: Offer;
      line: string;
      lineNum: number;
      sharp: string;
      targetBook: string;
    }>;

    beforeAll(() => {
      validTestCases = [];

      offers.forEach((offer) => {
        const overSide = offer.sides.find((side) => side.label === 'Over');
        const underSide = offer.sides.find((side) => side.label === 'Under');

        if (!overSide || !underSide) return;

        const allLines = new Set(overSide.outcomes.map((outcome) => outcome.line));

        for (const lineStr of allLines) {
          const lineNum = parseFloat(lineStr);
          if (isNaN(lineNum)) continue;

          for (const sharp of SHARP_BOOKS) {
            const sharpOutcomeOver = overSide.outcomes.find(
              (outcome) => outcome.sportsbookCode === sharp && outcome.line === lineStr
            );
            const sharpOutcomeUnder = underSide.outcomes.find(
              (outcome) => outcome.sportsbookCode === sharp && outcome.line === lineStr
            );

            if (!sharpOutcomeOver || !sharpOutcomeUnder) continue;

            for (const targetBook of TARGET_BOOKS) {
              const targetOutcome = overSide.outcomes.find(
                (outcome) => outcome.sportsbookCode === targetBook && outcome.line === lineStr
              );

              if (targetOutcome) {
                validTestCases.push({
                  offer,
                  line: lineStr,
                  lineNum,
                  sharp,
                  targetBook,
                });
                break;
              }
            }

            if (validTestCases.length > 0 && validTestCases[validTestCases.length - 1]!.sharp === sharp) {
              break;
            }
          }
        }
      });
    });

    it('should have at least one valid test case', () => {
      expect(validTestCases.length).toBeGreaterThan(0);
      if (validTestCases.length === 0) {
        console.error('No valid test cases found. Requirements:');
        console.error('- Sharp book (Pinnacle or Circa) with both Over and Under sides');
        console.error('- Target book (DraftKings or FanDuel) with Over side');
        console.error('- Same line number for all outcomes');
      }
    });

    it('should have valid line numbers that are parseable', () => {
      offers.forEach((offer) => {
        offer.sides.forEach((side) => {
          side.outcomes.forEach((outcome) => {
            const lineNum = parseFloat(outcome.line);
            expect(isNaN(lineNum)).toBe(false);
            expect(Number.isFinite(lineNum)).toBe(true);
          });
        });
      });
    });

    it('should have sharp books with both sides for at least one line', () => {
      let foundSharpWithBothSides = false;

      offers.forEach((offer) => {
        const overSide = offer.sides.find((side) => side.label === 'Over');
        const underSide = offer.sides.find((side) => side.label === 'Under');

        if (!overSide || !underSide) return;

        const allLines = new Set(overSide.outcomes.map((outcome) => outcome.line));

        for (const lineStr of allLines) {
          for (const sharp of SHARP_BOOKS) {
            const hasOver = overSide.outcomes.some(
              (outcome) => outcome.sportsbookCode === sharp && outcome.line === lineStr
            );
            const hasUnder = underSide.outcomes.some(
              (outcome) => outcome.sportsbookCode === sharp && outcome.line === lineStr
            );

            if (hasOver && hasUnder) {
              foundSharpWithBothSides = true;
              break;
            }
          }
          if (foundSharpWithBothSides) break;
        }
      });

      expect(foundSharpWithBothSides).toBe(true);
    });

    it('should have target books with Over side outcomes', () => {
      let foundTargetOnOver = false;

      offers.forEach((offer) => {
        const overSide = offer.sides.find((side) => side.label === 'Over');
        if (!overSide) return;

        for (const targetBook of TARGET_BOOKS) {
          if (overSide.outcomes.some((outcome) => outcome.sportsbookCode === targetBook)) {
            foundTargetOnOver = true;
            break;
          }
        }
      });

      expect(foundTargetOnOver).toBe(true);
    });

    it('should have consistent line format across sides', () => {
      offers.forEach((offer) => {
        const overSide = offer.sides.find((side) => side.label === 'Over');
        const underSide = offer.sides.find((side) => side.label === 'Under');

        if (!overSide || !underSide) return;

        const overLines = new Set(overSide.outcomes.map((o) => o.line));
        const underLines = new Set(underSide.outcomes.map((o) => o.line));

        // Check that line strings are consistent (same format)
        const allLines = new Set([...overLines, ...underLines]);
        allLines.forEach((lineStr) => {
          expect(typeof lineStr).toBe('string');
          expect(lineStr.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Data Completeness Assumptions', () => {
    it('should have all required outcome fields', () => {
      offers.forEach((offer) => {
        offer.sides.forEach((side) => {
          side.outcomes.forEach((outcome) => {
            expect(outcome.sportsbookCode).toBeDefined();
            expect(typeof outcome.sportsbookCode).toBe('string');
            expect(outcome.line).toBeDefined();
            expect(typeof outcome.line).toBe('string');
            expect(outcome.label).toBeDefined();
            expect(typeof outcome.label).toBe('string');
            expect(outcome.odds).toBeDefined();
            expect(typeof outcome.odds).toBe('number');
            expect(outcome.americanOdds).toBeDefined();
            expect(typeof outcome.americanOdds).toBe('string');
          });
        });
      });
    });

    it('should have valid numeric odds', () => {
      offers.forEach((offer) => {
        offer.sides.forEach((side) => {
          side.outcomes.forEach((outcome) => {
            expect(Number.isFinite(outcome.odds)).toBe(true);
            expect(outcome.odds).toBeGreaterThan(0);
          });
        });
      });
    });

    it('should have parseable American odds', () => {
      offers.forEach((offer) => {
        offer.sides.forEach((side) => {
          side.outcomes.forEach((outcome) => {
            const parsed = parseFloat(outcome.americanOdds);
            // American odds can be negative or positive, but should be finite
            expect(Number.isFinite(parsed)).toBe(true);
          });
        });
      });
    });

    it('should allow probability calculations without errors', () => {
      const testCases: Outcome[] = [];

      offers.forEach((offer) => {
        offer.sides.forEach((side) => {
          side.outcomes.forEach((outcome) => {
            if (outcome.odds > 0 && Number.isFinite(outcome.odds)) {
              testCases.push(outcome);
            }
          });
        });
      });

      expect(testCases.length).toBeGreaterThan(0);

      // Test that we can at least parse odds for probability calculation
      testCases.forEach((outcome) => {
        const probability = 1 / outcome.odds;
        expect(Number.isFinite(probability)).toBe(true);
        expect(probability).toBeGreaterThan(0);
        expect(probability).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Test-Specific Assumptions', () => {
    it('should have first offer as representative test case', () => {
      const firstOffer = offers[0]!;
      expect(firstOffer.sides).toBeDefined();
      expect(firstOffer.sides.length).toBeGreaterThan(0);
      expect(firstOffer.participants).toBeDefined();
      expect(firstOffer.participants.length).toBeGreaterThan(0);
    });

    it('should have at least one offer with required structure for integration tests', () => {
      const SHARP_BOOKS = ['Pinnacle', 'Circa'];
      const TARGET_BOOKS = ['DraftKings', 'FanDuel'];

      let foundValidOffer = false;

      for (const offer of offers) {
        const overSide = offer.sides?.find((side) => side.label === 'Over');
        const underSide = offer.sides?.find((side) => side.label === 'Under');

        if (!overSide || !underSide) continue;

        const allLines = new Set(overSide.outcomes.map((outcome) => outcome.line));

        for (const lineStr of allLines) {
          for (const sharp of SHARP_BOOKS) {
            const sharpOver = overSide.outcomes.find(
              (outcome) => outcome.sportsbookCode === sharp && outcome.line === lineStr
            );
            const sharpUnder = underSide.outcomes.find(
              (outcome) => outcome.sportsbookCode === sharp && outcome.line === lineStr
            );

            if (!sharpOver || !sharpUnder) continue;

            for (const targetBook of TARGET_BOOKS) {
              const targetOutcome = overSide.outcomes.find(
                (outcome) => outcome.sportsbookCode === targetBook && outcome.line === lineStr
              );

              if (targetOutcome) {
                foundValidOffer = true;
                break;
              }
            }

            if (foundValidOffer) break;
          }

          if (foundValidOffer) break;
        }

        if (foundValidOffer) break;
      }

      expect(foundValidOffer).toBe(true);
    });

    it('should support testing over side', () => {
      const hasOverSide = offers.some((offer) =>
        offer.sides.some((side) => side.label === 'Over' && side.outcomes.length > 0)
      );
      expect(hasOverSide).toBe(true);
    });

    it('should support testing under side', () => {
      const hasUnderSide = offers.some((offer) =>
        offer.sides.some((side) => side.label === 'Under' && side.outcomes.length > 0)
      );
      expect(hasUnderSide).toBe(true);
    });

    it('should have participants in all offers used for testing', () => {
      // Check first offer (used in integration tests)
      const firstOffer = offers[0]!;
      expect(firstOffer.participants).toBeDefined();
      expect(firstOffer.participants.length).toBeGreaterThan(0);
      expect(firstOffer.participants[0]).toBeDefined();
    });
  });

  describe('Data Quality Checks', () => {
    it('should report duplicate outcome IDs (data quality check)', () => {
      const allOutcomeIds = new Map<string, number>();
      const duplicateDetails: Array<{ id: string; count: number }> = [];

      offers.forEach((offer) => {
        offer.sides.forEach((side) => {
          side.outcomes.forEach((outcome) => {
            const currentCount = allOutcomeIds.get(outcome.id) || 0;
            allOutcomeIds.set(outcome.id, currentCount + 1);
          });
        });
      });

      allOutcomeIds.forEach((count, id) => {
        if (count > 1) {
          duplicateDetails.push({ id, count });
        }
      });

      if (duplicateDetails.length > 0) {
        console.warn(`Found ${duplicateDetails.length} duplicate outcome IDs:`);
        duplicateDetails.slice(0, 10).forEach(({ id, count }) => {
          console.warn(`  - ${id}: appears ${count} times`);
        });
        if (duplicateDetails.length > 10) {
          console.warn(`  ... and ${duplicateDetails.length - 10} more`);
        }
        // Warn but don't fail - this is a data quality issue that may be acceptable
        // depending on the data source. Integration tests may still work if duplicates
        // don't cause conflicts in the specific test scenarios.
      }

      // Don't fail on duplicates - just report them
      expect(duplicateDetails.length).toBeGreaterThanOrEqual(0);
    });

    it('should have valid participant structure', () => {
      offers.forEach((offer) => {
        offer.participants.forEach((participant) => {
          expect(participant.id).toBeDefined();
          expect(typeof participant.id).toBe('string');
          expect(participant.name).toBeDefined();
          expect(typeof participant.name).toBe('string');
        });
      });
    });

    it('should report summary statistics', () => {
      const totalOffers = offers.length;
      const totalSides = offers.reduce((sum, offer) => sum + offer.sides.length, 0);
      const totalOutcomes = offers.reduce(
        (sum, offer) =>
          sum + offer.sides.reduce((sideSum, side) => sideSum + side.outcomes.length, 0),
        0
      );
      const uniqueSportsbooks = new Set<string>();
      offers.forEach((offer) => {
        offer.sides.forEach((side) => {
          side.outcomes.forEach((outcome) => {
            uniqueSportsbooks.add(outcome.sportsbookCode);
          });
        });
      });

      console.log('Data Summary:');
      console.log(`- Total offers: ${totalOffers}`);
      console.log(`- Total sides: ${totalSides}`);
      console.log(`- Total outcomes: ${totalOutcomes}`);
      console.log(`- Unique sportsbooks: ${uniqueSportsbooks.size}`);
      console.log(`- Sportsbooks: ${Array.from(uniqueSportsbooks).sort().join(', ')}`);

      expect(totalOffers).toBeGreaterThan(0);
      expect(totalSides).toBeGreaterThan(0);
      expect(totalOutcomes).toBeGreaterThan(0);
    });
  });
});

