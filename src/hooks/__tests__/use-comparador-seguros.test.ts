import { describe, it, expect } from "vitest";
import { PAISES } from "@/data/paises";
import { ASEGURADORAS } from "@/data/aseguradoras";
import { calcularSeguro, ordenarSeguros } from "@/hooks/use-comparador-seguros";
import { INPUTS_INICIALES } from "@/hooks/use-comparador-seguros";

/**
 * Guardia de regresión numérica contra el legacy seguros.js.
 *
 * Caso verificado a mano (ver REQ del ticket):
 *   auto, CR, valor 12.000.000 CRC, cobertura amplio, INS factor 1,
 *   con los defaults del formulario: año 2022, uso particular,
 *   zona capital, edad 35.
 *
 * Cálculo manual (replica calcAuto, seguros.js:205-222) con YEAR = 2026:
 *   valor  = clamp(12.000.000, 1000, 999999999)   = 12.000.000
 *   anio   = clamp(2022, 1990, 2027)              = 2022
 *   edad   = clamp(35, 18, 85)                    = 35
 *   tasas  = TASAS_AUTO.cr.amplio                 = [2, 4]   (% anual)
 *   factorAntiguedad(2022) → edadVehiculo 4       = 1   (rama default)
 *   factorEdad(35)                                = 1
 *   factorUso('particular')                       = 1
 *   factorZona('capital')                         = 1.12
 *   INS productos.auto.factor                     = 1
 *   factor = 1 * 1 * 1 * 1.12 * 1                 = 1.12
 *
 *   min (anual)    = 12.000.000 * (2/100)  * 1.12 = 268.800
 *   max (anual)    = 12.000.000 * (4/100)  * 1.12 = 537.600
 *   frecuencia 'anual' → monthlyMin = min/12      = 22.400
 *                         monthlyMax = max/12     = 44.800
 */
describe("calcularSeguro — núcleo numérico (auto CR, INS)", () => {
  const YEAR = 2026;
  const CASO = {
    pais: PAISES.find((p) => p.id === "cr")!,
    paisId: "cr" as const,
    tipo: "auto" as const,
    inputs: INPUTS_INICIALES,
    aseguradoras: ASEGURADORAS,
    year: YEAR,
  };

  it("INS: min/max/mensuales coinciden con el hand-computed (268800/537600/22400/44800)", () => {
    const res = calcularSeguro(CASO);
    const ins = res.find((r) => r.aseguradora.id === "ins_cr")!;

    // Hand-computed (ver arriba).
    expect(ins.min).toBe(268_800);
    expect(ins.max).toBe(537_600);
    expect(ins.monthlyMin).toBe(22_400);
    expect(ins.monthlyMax).toBe(44_800);
  });

  it("INS usa frecuencia anual y meta amplio · 2022 · Particular", () => {
    const ins = calcularSeguro(CASO).find((r) => r.aseguradora.id === "ins_cr")!;
    expect(ins.meta.frecuencia).toBe("anual");
    expect(ins.meta.productoLabel).toBe("Seguro de vehículo");
    expect(ins.meta.resumenCorto).toBe("Todo riesgo");
    expect(ins.meta.detalle).toBe("Todo riesgo · 2022 · Particular");
    expect(ins.meta.precision).toBe("Alta");
  });

  it("el cotizador y la nota de INS son los del producto auto", () => {
    const ins = calcularSeguro(CASO).find((r) => r.aseguradora.id === "ins_cr")!;
    const producto = ASEGURADORAS.find((a) => a.id === "ins_cr")!.productos.auto!;
    expect(ins.cotizador).toBe(producto.cotizador);
    expect(ins.nota).toBe(producto.nota);
  });

  it("el factor propio de cada aseguradora escala el rango linealmente", () => {
    const res = calcularSeguro(CASO);
    const ins = res.find((r) => r.aseguradora.id === "ins_cr")!.min;
    // SURA (factor 1.08) y Quálitas (factor 0.92) reflejan su factor sobre INS.
    const sura = res.find((r) => r.aseguradora.id === "sura_cr")!.min;
    const qualitas = res.find((r) => r.aseguradora.id === "qualitas_cr")!.min;
    expect(sura).toBeCloseTo(ins * 1.08, 0);
    expect(qualitas).toBeCloseTo(ins * 0.92, 0);
  });

  it("ordenarSeguros('precio') deja la menor prima mensual primero", () => {
    const res = ordenarSeguros(calcularSeguro(CASO), "precio");
    for (let i = 1; i < res.length; i++) {
      expect(res[i].monthlyMin).toBeGreaterThanOrEqual(res[i - 1].monthlyMin);
    }
  });
});
