import { describe, it, expect } from "vitest";
import { scoreLead, DEFAULT_ENGINE_CONFIG } from "@/lib/buro/engine";
import type {
  BuroMockResponse,
  CreditOperation,
  SugefCategory,
} from "@/types/buro";

// The bureau is built by hand (not via the mock generator) so each case exercises
// a concrete engine branch without depending on the generator's randomness.
function makeBuro(overrides: Partial<BuroMockResponse> = {}): BuroMockResponse {
  return {
    idNumber: "test",
    score: 650,
    sugefCategory: "A2",
    historicalPaymentBehavior: 1,
    operations: [],
    totalAmountOwed: 0,
    inquiriesLast30Days: 0,
    commercialProtests: 0,
    historyMonths: 48,
    inquiryDate: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeOperation(overrides: Partial<CreditOperation> = {}): CreditOperation {
  return {
    type: "personal",
    institution: "Banco Nacional",
    amountOwed: 0,
    daysPastDue: 0,
    closed: false,
    ...overrides,
  };
}

// Low ratio by default (100k / 1M = 0.1, well below the prequalified threshold 0.45).
const HIGH_INCOME = { income: 1_000_000, debt: 100_000 };

describe("buro/engine scoreLead", () => {
  it("risk category (C1/C2/D/E) without active default → Level 1", () => {
    for (const cat of ["C1", "C2", "D", "E"] as SugefCategory[]) {
      const result = scoreLead(makeBuro({ sugefCategory: cat }), HIGH_INCOME);
      expect(result.level).toBe(1);
    }
  });

  it("category B2 without active default → Level 1", () => {
    // Critical case: by business decision B2 is classified as Level 1 (high risk),
    // NOT Level 2, even when score/ratio would be good. This is intentional, not a bug.
    const result = scoreLead(
      makeBuro({ sugefCategory: "B2", score: 850 }),
      HIGH_INCOME,
    );
    expect(result.level).toBe(1);
  });

  it("severe active default (daysPastDue > 90) over an A1 category → Level 1 (default override)", () => {
    const result = scoreLead(
      makeBuro({
        sugefCategory: "A1",
        score: 830,
        operations: [makeOperation({ daysPastDue: 120 })],
      }),
      HIGH_INCOME,
    );
    expect(result.level).toBe(1);
    expect(result.hasSevereActiveDefault).toBe(true);
  });

  it("good category (A1/A2/B1) + prime score + low ratio → Level 3", () => {
    for (const cat of ["A1", "A2", "B1"] as SugefCategory[]) {
      const result = scoreLead(
        makeBuro({ sugefCategory: cat, score: 800 }),
        HIGH_INCOME,
      );
      expect(result.level).toBe(3);
    }
  });

  it("good category + prime score but high debt-to-income ratio → drops to Level 2 with hasHighDebtRatio", () => {
    // debt/income = 600k / 1M = 0.6, above the alert threshold (0.50).
    const result = scoreLead(
      makeBuro({ sugefCategory: "A2", score: 800 }),
      { income: 1_000_000, debt: 600_000 },
    );
    expect(result.level).toBe(2);
    expect(result.level).not.toBe(3);
    expect(result.hasHighDebtRatio).toBe(true);
  });

  it("good category but score below prime threshold → Level 2", () => {
    // score 650 < 700 (default scorePrimeThreshold).
    const result = scoreLead(
      makeBuro({ sugefCategory: "A2", score: 650 }),
      HIGH_INCOME,
    );
    expect(result.level).toBe(2);
  });

  it("isCreditShopping does not change the level — a Level 3 stays Level 3", () => {
    const result = scoreLead(
      makeBuro({
        sugefCategory: "A1",
        score: 800,
        inquiriesLast30Days: 7, // > shoppingInquiriesThreshold (5)
      }),
      HIGH_INCOME,
    );
    expect(result.isCreditShopping).toBe(true);
    expect(result.level).toBe(3);
  });

  it("partial config (scorePrimeThreshold: 800) changes the result per the new threshold", () => {
    const buro = makeBuro({ sugefCategory: "A2", score: 750 });

    // With default (700), score 750 reaches prime → Level 3.
    expect(scoreLead(buro, HIGH_INCOME).level).toBe(3);

    // With threshold 800, score 750 no longer reaches → Level 2.
    expect(scoreLead(buro, HIGH_INCOME, { scorePrimeThreshold: 800 }).level).toBe(2);
  });

  it("corrupt config (NaN/undefined/negative) falls back to defaults instead of failing silently", () => {
    const buro = makeBuro({ sugefCategory: "A2", score: 750 });
    const corrupt = scoreLead(buro, HIGH_INCOME, {
      scorePrimeThreshold: NaN,
      debtToIncomeAlertThreshold: undefined,
      activeDefaultDaysLimit: -10,
    });
    const withDefault = scoreLead(buro, HIGH_INCOME);
    expect(corrupt.level).toBe(withDefault.level);
  });

  it("DEFAULT_ENGINE_CONFIG exposes the thresholds expected by these tests", () => {
    expect(DEFAULT_ENGINE_CONFIG.scorePrimeThreshold).toBe(700);
    expect(DEFAULT_ENGINE_CONFIG.activeDefaultDaysLimit).toBe(90);
    expect(DEFAULT_ENGINE_CONFIG.debtToIncomeAlertThreshold).toBe(0.5);
  });
});
