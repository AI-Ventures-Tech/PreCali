import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/whatsapp/agent";

const BASE_CONTEXT = { country: "cr", step: "post_resultado", profile: { income: 800000 } };

describe("whatsapp/agent buildSystemPrompt — tone by risk level", () => {
  it("without riskLevel (null/undefined) adds no level instruction", () => {
    const prompt = buildSystemPrompt(BASE_CONTEXT);
    expect(prompt).not.toContain("Nivel de riesgo");
  });

  it("level 1 instructs not to sell bank products and guide a 6-month rehabilitation plan", () => {
    const prompt = buildSystemPrompt({ ...BASE_CONTEXT, riskLevel: 1 });
    expect(prompt).toContain("Nivel de riesgo: 1");
    expect(prompt).toContain("No vendas productos bancarios");
    expect(prompt).toContain("6 meses");
  });

  it("level 2 instructs adjusted prima/amount and prioritizes cooperatives", () => {
    const prompt = buildSystemPrompt({ ...BASE_CONTEXT, riskLevel: 2 });
    expect(prompt).toContain("Nivel de riesgo: 2");
    expect(prompt).toContain("prima");
    expect(prompt).toContain("cooperativas");
  });

  it("level 3 instructs fast conversion and best rates", () => {
    const prompt = buildSystemPrompt({ ...BASE_CONTEXT, riskLevel: 3 });
    expect(prompt).toContain("Nivel de riesgo: 3");
    expect(prompt).toContain("conversion rapida");
  });

  it("never leaks raw bureau fields (score, sugefCategory, operations, protests)", () => {
    // ResolverDudaContext only carries riskLevel (a number), so structurally there
    // is no way for a raw bureau field to reach here. This test documents and
    // pins that invariant.
    for (const level of [1, 2, 3] as const) {
      const prompt = buildSystemPrompt({ ...BASE_CONTEXT, riskLevel: level });
      expect(prompt).not.toMatch(/sugefCategory|commercialProtests|totalAmountOwed|inquiriesLast30Days/i);
    }
  });
});
