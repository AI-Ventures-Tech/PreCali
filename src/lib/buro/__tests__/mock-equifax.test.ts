import { describe, it, expect } from "vitest";
import { generateMockBuroResponse } from "@/lib/buro/mock-equifax";
import type { SugefCategory } from "@/types/buro";

const DATE = "2026-01-01T00:00:00.000Z";

describe("buro/mock-equifax", () => {
  it("is deterministic — same cédula + same date yields the same result", () => {
    const a = generateMockBuroResponse("1-2345-6789", DATE);
    const b = generateMockBuroResponse("1-2345-6789", DATE);
    expect(a).toEqual(b);
  });

  it("produces variety — at least 3 distinct SUGEF categories across 200 cédulas", () => {
    const categories = new Set<SugefCategory>();
    for (let i = 0; i < 200; i++) {
      categories.add(generateMockBuroResponse(`cedula-${i}`, DATE).sugefCategory);
    }
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });

  it("totalAmountOwed equals the sum of operation.amountOwed", () => {
    for (let i = 0; i < 100; i++) {
      const buro = generateMockBuroResponse(`cedula-${i}`, DATE);
      const sum = buro.operations.reduce((acc, op) => acc + op.amountOwed, 0);
      expect(buro.totalAmountOwed).toBe(sum);
    }
  });

  it("historyMonths is always 48", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateMockBuroResponse(`cedula-${i}`, DATE).historyMonths).toBe(48);
    }
  });

  it("status is always 'completed' in mock", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateMockBuroResponse(`cedula-${i}`, DATE).status).toBe("completed");
    }
  });

  it("hitCode is always { code: '1' } in mock", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateMockBuroResponse(`cedula-${i}`, DATE).hitCode).toEqual({ code: "1" });
    }
  });

  it("links is always empty array in mock", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateMockBuroResponse(`cedula-${i}`, DATE).links).toEqual([]);
    }
  });
});
