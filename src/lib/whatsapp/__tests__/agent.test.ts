import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/whatsapp/agent";

const BASE_CONTEXT = { country: "cr", step: "post_resultado", profile: { income: 800000 } };

describe("whatsapp/agent buildSystemPrompt — tono por nivel de riesgo", () => {
  it("sin nivelRiesgo (null/undefined) no agrega ninguna instruccion de nivel", () => {
    const prompt = buildSystemPrompt(BASE_CONTEXT);
    expect(prompt).not.toContain("Nivel de riesgo");
  });

  it("nivel 1 instruye no vender banco y guiar saneamiento a 6 meses", () => {
    const prompt = buildSystemPrompt({ ...BASE_CONTEXT, nivelRiesgo: 1 });
    expect(prompt).toContain("Nivel de riesgo: 1");
    expect(prompt).toContain("No vendas productos bancarios");
    expect(prompt).toContain("6 meses");
  });

  it("nivel 2 instruye prima/monto ajustado y priorizar cooperativas", () => {
    const prompt = buildSystemPrompt({ ...BASE_CONTEXT, nivelRiesgo: 2 });
    expect(prompt).toContain("Nivel de riesgo: 2");
    expect(prompt).toContain("prima");
    expect(prompt).toContain("cooperativas");
  });

  it("nivel 3 instruye conversion rapida y mejores tasas", () => {
    const prompt = buildSystemPrompt({ ...BASE_CONTEXT, nivelRiesgo: 3 });
    expect(prompt).toContain("Nivel de riesgo: 3");
    expect(prompt).toContain("conversion rapida");
  });

  it("nunca filtra campos crudos del buro (score, categoriaSugef, operaciones, protestos)", () => {
    // ResolverDudaContext solo tiene nivelRiesgo (numero), asi que estructuralmente no hay forma
    // de que un campo crudo del buro llegue aca. Este test documenta y fija ese invariante.
    for (const nivel of [1, 2, 3] as const) {
      const prompt = buildSystemPrompt({ ...BASE_CONTEXT, nivelRiesgo: nivel });
      expect(prompt).not.toMatch(/categoriaSugef|protestosComerciales|montoTotalAdeudado|entidadesConsultantes/i);
    }
  });
});
