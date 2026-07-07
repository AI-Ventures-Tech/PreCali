import { describe, it, expect } from "vitest";
import { generateMockBuroResponse } from "@/lib/buro/mock-equifax";
import type { SugefCategoria } from "@/types/buro";

const FECHA = "2026-01-01T00:00:00.000Z";

describe("buro/mock-equifax", () => {
  it("es determinístico: misma cédula + misma fecha produce el mismo resultado", () => {
    const a = generateMockBuroResponse("1-2345-6789", FECHA);
    const b = generateMockBuroResponse("1-2345-6789", FECHA);
    expect(a).toEqual(b);
  });

  it("produce variedad: al menos 3 categorías SUGEF distintas en 200 cédulas", () => {
    const categorias = new Set<SugefCategoria>();
    for (let i = 0; i < 200; i++) {
      categorias.add(generateMockBuroResponse(`cedula-${i}`, FECHA).categoriaSugef);
    }
    expect(categorias.size).toBeGreaterThanOrEqual(3);
  });

  it("montoTotalAdeudado es la suma de montoAdeudado de las operaciones", () => {
    for (let i = 0; i < 100; i++) {
      const buro = generateMockBuroResponse(`cedula-${i}`, FECHA);
      const suma = buro.operaciones.reduce((acc, op) => acc + op.montoAdeudado, 0);
      expect(buro.montoTotalAdeudado).toBe(suma);
    }
  });

  it("historialMeses siempre es 48", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateMockBuroResponse(`cedula-${i}`, FECHA).historialMeses).toBe(48);
    }
  });
});
