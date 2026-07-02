import { describe, it, expect } from "vitest";
import { BANCOS } from "@/data/bancos";
import { TIPO_CAMBIO_USD } from "@/data/config";
import { calcularCredito, evaluarBanco } from "@/hooks/calc";

/**
 * Guardia de regresión numérica contra el legacy app.js.
 *
 * Caso verificado a mano (ver REQ del ticket):
 *   ingreso 1.000.000 CRC, deudas 0, plazo 5 años, tipo personal, moneda crc.
 * Banco Nacional (id "bn") tiene tasaCRC = 16.5%, ratioMax = 0.4, plazoMax = 8.
 *
 * Sistema francés:
 *   i = 0.165 / 12 = 0.01375
 *   n = 5 * 12     = 60
 *   capacidad = ingreso * ratioMax − deudas = 1.000.000 * 0.4 − 0 = 400.000
 *   monto  = capacidad * (1 − (1+i)^−n) / i
 *   cuota  = monto * i / (1 − (1+i)^−n)
 *
 * Como el monto se deriva de la propia capacidad (sin tope de prima ni montoMin),
 * se cumple la identidad cuota = capacidad = 400.000 exacto. El monto calculado
 * a mano con la fórmula (node) es 16.270.400,323553.
 */
describe("calcularCredito — núcleo numérico", () => {
  const CASO = {
    ingreso: 1_000_000,
    deudas: 0,
    plazo: 5,
    prima: 0,
    moneda: "crc" as const,
    tipo: "personal" as const,
    cambio: TIPO_CAMBIO_USD,
    bancos: BANCOS,
    seleccion: ["bn", "bcr", "bac", "pop", "dav", "pro", "sci", "lf"],
  };

  it("cuota de Banco Nacional == 400.000 (identidad sistema francés, hand-computed)", () => {
    const res = calcularCredito(CASO);
    const bn = res.find((r) => r.banco.id === "bn")!;

    // Hand-computed: capacidad = 1.000.000 * 0.4 − 0 = 400.000.
    expect(bn.capacidad).toBe(400_000);
    // La cuota reproduce exactamente la capacidad (no hay tope de prima/monto).
    expect(bn.cuota).toBeCloseTo(400_000, 5);
  });

  it("monto de Banco Nacional coincide con la fórmula manual (16.270.400,32)", () => {
    const bn = calcularCredito(CASO).find((r) => r.banco.id === "bn")!;

    // Hand-computed con la fórmula: 400.000 * (1 − 1.01375^−60) / 0.01375.
    expect(bn.monto).toBeCloseTo(16_270_400.32, 0);
    // Total e intereses derivados.
    expect(bn.total).toBeCloseTo(400_000 * 60, 0); // 24.000.000
    expect(bn.intereses).toBeCloseTo(bn.total - bn.monto, 2);
  });

  it("Banco Nacional califica y usa plazoEfectivo 5 (plazoMax 8)", () => {
    const bn = calcularCredito(CASO).find((r) => r.banco.id === "bn")!;
    expect(bn.califica).toBe(true);
    expect(bn.plazoEfectivo).toBe(5);
    expect(bn.plazoSolicitado).toBe(5);
    expect(bn.fallas).toHaveLength(0);
  });

  it("la tasa seleccionada es tasaCRC (16.5) en moneda crc", () => {
    const bn = calcularCredito(CASO).find((r) => r.banco.id === "bn")!;
    expect(bn.tasa).toBe(16.5);
  });

  it("en moneda usd la tasa pasa a tasaUSD (12) y los umbrales se convierten", () => {
    const bn = evaluarBanco(
      BANCOS.find((b) => b.id === "bn")!,
      {
        ingreso: 1_000_000 / TIPO_CAMBIO_USD, // ~1960.78 USD
        deudas: 0,
        plazo: 5,
        prima: 0,
        moneda: "usd",
        tipo: "personal",
        cambio: TIPO_CAMBIO_USD,
      },
    );
    expect(bn.tasa).toBe(12); // tasaUSD de BN personal
    // ingresoMin de BN personal = 350.000 CRC → en USD ≈ 350.000 / 510.
    expect(bn.ingresoMinConvertido).toBeCloseTo(350_000 / TIPO_CAMBIO_USD, 6);
  });

  it("deudas altas (>ratioMax del ingreso) marcan falla de deuda", () => {
    const bn = calcularCredito({ ...CASO, deudas: 500_000 }).find(
      (r) => r.banco.id === "bn",
    )!;
    // capacidad = 1.000.000 * 0.4 − 500.000 = −100.000 ≤ 0 → no califica por deuda.
    expect(bn.califica).toBe(false);
    expect(bn.fallas.some((f) => f.tipo === "deuda")).toBe(true);
    expect(bn.monto).toBe(0);
  });

  it("ordenarResultados ordena calificantes por cuota ascendente", async () => {
    const { ordenarResultados } = await import("@/hooks/calc");
    const todos = calcularCredito(CASO);
    const { calificantes, noCalifican } = ordenarResultados(todos, "cuota");
    for (let i = 1; i < calificantes.length; i++) {
      expect(calificantes[i].cuota).toBeGreaterThanOrEqual(
        calificantes[i - 1].cuota,
      );
    }
    expect(noCalifican.length + calificantes.length).toBe(todos.length);
  });
});
