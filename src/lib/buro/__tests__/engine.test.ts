import { describe, it, expect } from "vitest";
import { calificarLead, DEFAULT_ENGINE_CONFIG } from "@/lib/buro/engine";
import type {
  BuroMockResponse,
  OperacionCredito,
  SugefCategoria,
} from "@/types/buro";

// Construimos el buró a mano (sin el generador mock) para que cada caso pruebe una
// rama concreta del motor sin depender de la aleatoriedad del generador.
function makeBuro(overrides: Partial<BuroMockResponse> = {}): BuroMockResponse {
  return {
    idNumber: "test",
    score: 650,
    categoriaSugef: "A2",
    comportamientoPagoHistorico: 1,
    operaciones: [],
    montoTotalAdeudado: 0,
    entidadesConsultantesUltimos30Dias: 0,
    protestosComerciales: 0,
    historialMeses: 48,
    fechaConsulta: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeOperacion(overrides: Partial<OperacionCredito> = {}): OperacionCredito {
  return {
    tipo: "personal",
    entidad: "Banco Nacional",
    montoAdeudado: 0,
    diasAtraso: 0,
    cancelada: false,
    ...overrides,
  };
}

// Ratio bajo por default (100k / 1M = 0.1, muy por debajo de precalificado 0.45).
const INGRESO_ALTO = { income: 1_000_000, debt: 100_000 };

describe("buro/engine calificarLead", () => {
  it("categoría de riesgo (C1/C2/D/E) sin mora → Nivel 1", () => {
    for (const cat of ["C1", "C2", "D", "E"] as SugefCategoria[]) {
      const result = calificarLead(makeBuro({ categoriaSugef: cat }), INGRESO_ALTO);
      expect(result.nivel).toBe(1);
    }
  });

  it("categoría B2 sin mora activa → Nivel 1", () => {
    // Caso crítico: por decisión de negocio B2 se clasifica como Nivel 1 (alto riesgo),
    // NO Nivel 2, aunque el score/ratio serían buenos. Es un límite intencional, no un bug.
    const result = calificarLead(
      makeBuro({ categoriaSugef: "B2", score: 850 }),
      INGRESO_ALTO,
    );
    expect(result.nivel).toBe(1);
  });

  it("mora activa severa (diasAtraso > 90) sobre categoría A1 → Nivel 1 (override de mora)", () => {
    const result = calificarLead(
      makeBuro({
        categoriaSugef: "A1",
        score: 830,
        operaciones: [makeOperacion({ diasAtraso: 120 })],
      }),
      INGRESO_ALTO,
    );
    expect(result.nivel).toBe(1);
    expect(result.moraActivaSevera).toBe(true);
  });

  it("categoría buena (A1/A2/B1) + score prime + ratio bajo → Nivel 3", () => {
    for (const cat of ["A1", "A2", "B1"] as SugefCategoria[]) {
      const result = calificarLead(
        makeBuro({ categoriaSugef: cat, score: 800 }),
        INGRESO_ALTO,
      );
      expect(result.nivel).toBe(3);
    }
  });

  it("categoría buena + score prime pero ratio deuda/ingreso alto → cae a Nivel 2 y ratioAlto", () => {
    // debt/income = 600k / 1M = 0.6, por encima de la alerta (0.50).
    const result = calificarLead(
      makeBuro({ categoriaSugef: "A2", score: 800 }),
      { income: 1_000_000, debt: 600_000 },
    );
    expect(result.nivel).toBe(2);
    expect(result.nivel).not.toBe(3);
    expect(result.ratioAlto).toBe(true);
  });

  it("categoría buena pero score por debajo del umbral prime → Nivel 2", () => {
    // score 650 < 700 (default scorePrimeThreshold).
    const result = calificarLead(
      makeBuro({ categoriaSugef: "A2", score: 650 }),
      INGRESO_ALTO,
    );
    expect(result.nivel).toBe(2);
  });

  it("shoppingCredito no afecta el nivel: un Nivel 3 sigue siendo Nivel 3", () => {
    const result = calificarLead(
      makeBuro({
        categoriaSugef: "A1",
        score: 800,
        entidadesConsultantesUltimos30Dias: 7, // > shoppingCreditoConsultas30d (5)
      }),
      INGRESO_ALTO,
    );
    expect(result.shoppingCredito).toBe(true);
    expect(result.nivel).toBe(3);
  });

  it("config parcial (scorePrimeThreshold: 800) cambia el resultado según el nuevo umbral", () => {
    const buro = makeBuro({ categoriaSugef: "A2", score: 750 });

    // Con el default (700), score 750 alcanza para prime → Nivel 3.
    expect(calificarLead(buro, INGRESO_ALTO).nivel).toBe(3);

    // Con umbral 800, score 750 ya no alcanza → Nivel 2.
    expect(calificarLead(buro, INGRESO_ALTO, { scorePrimeThreshold: 800 }).nivel).toBe(2);
  });

  it("config corrupto (NaN/undefined/negativo) cae al default en vez de fallar silenciosamente", () => {
    const buro = makeBuro({ categoriaSugef: "A2", score: 750 });
    const corrupto = calificarLead(buro, INGRESO_ALTO, {
      scorePrimeThreshold: NaN,
      ratioDeudaIngresoAlerta: undefined,
      moraActivaDiasLimite: -10,
    });
    const conDefault = calificarLead(buro, INGRESO_ALTO);
    expect(corrupto.nivel).toBe(conDefault.nivel);
  });

  it("DEFAULT_ENGINE_CONFIG expone los umbrales esperados por estos tests", () => {
    expect(DEFAULT_ENGINE_CONFIG.scorePrimeThreshold).toBe(700);
    expect(DEFAULT_ENGINE_CONFIG.moraActivaDiasLimite).toBe(90);
    expect(DEFAULT_ENGINE_CONFIG.ratioDeudaIngresoAlerta).toBe(0.5);
  });
});
