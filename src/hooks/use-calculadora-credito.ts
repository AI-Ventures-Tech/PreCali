"use client";

import { useCallback, useMemo, useState } from "react";
import type { Banco, Pais, PaisId, TipoPrestamo } from "@/types/precali";
import { PAISES } from "@/data/paises";
import { BANCOS } from "@/data/bancos";
import { CONFIG_TIPOS, TIPO_CAMBIO_USD } from "@/data/config";
import {
  calcularCredito,
  ordenarResultados,
  type Moneda,
  type Orden,
  type ResultadoBanco,
} from "@/hooks/calc";

/**
 * Rangos de los sliders según moneda. Puerto verbatim de `RANGOS_SLIDERS`
 * (app.js:142-153). En CRC son valores cerrados; en USD ya están definidos.
 * Los demás países se derivan del tipo de cambio como en `rangosParaMoneda`.
 */
const RANGOS_SLIDERS: Record<
  "crc" | "usd",
  {
    ingreso: { min: number; max: number; step: number; def: number };
    deudas: { min: number; max: number; step: number; def: number };
    prima: { min: number; max: number; step: number; def: number };
  }
> = {
  crc: {
    ingreso: { min: 200000, max: 10000000, step: 100000, def: 1200000 },
    deudas: { min: 0, max: 10000000, step: 50000, def: 150000 },
    prima: { min: 0, max: 50000000, step: 500000, def: 5000000 },
  },
  usd: {
    ingreso: { min: 400, max: 20000, step: 200, def: 2400 },
    deudas: { min: 0, max: 20000, step: 100, def: 300 },
    prima: { min: 0, max: 100000, step: 1000, def: 10000 },
  },
};

const SELECCION_INICIAL_CR = ["bn", "bcr", "bac", "pop", "dav"];

export interface CalculadoraInputs {
  ingreso: number;
  deudas: number;
  plazo: number;
  prima: number;
  moneda: Moneda;
  orden: Orden;
}

function getPais(id: PaisId): Pais {
  return PAISES.find((p) => p.id === id) ?? PAISES[0];
}

function bancosDePais(id: PaisId): Banco[] {
  return BANCOS.filter((b) => ((b as Banco & { pais?: PaisId }).pais ?? "cr") === id);
}

/** Puerto de `rangosParaMoneda(moneda)` (app.js:155-182). */
function rangosParaMoneda(
  moneda: Moneda,
  pais: Pais,
): (typeof RANGOS_SLIDERS)["crc"] {
  if (moneda === "usd") return RANGOS_SLIDERS.usd;
  if (pais.id === "cr") return RANGOS_SLIDERS.crc;
  const cambio = pais.cambioUSD || TIPO_CAMBIO_USD;
  const redondear = (valor: number, step: number) =>
    Math.max(step, Math.round(valor / step) * step);
  const stepIngreso = cambio >= 20 ? 1000 : 500;
  const stepPrima = cambio >= 20 ? 10000 : 5000;
  return {
    ingreso: {
      min: redondear(RANGOS_SLIDERS.usd.ingreso.min * cambio, stepIngreso),
      max: redondear(RANGOS_SLIDERS.usd.ingreso.max * cambio, stepIngreso),
      step: stepIngreso,
      def: redondear(RANGOS_SLIDERS.usd.ingreso.def * cambio, stepIngreso),
    },
    deudas: {
      min: 0,
      max: redondear(RANGOS_SLIDERS.usd.deudas.max * cambio, stepIngreso),
      step: stepIngreso,
      def: redondear(RANGOS_SLIDERS.usd.deudas.def * cambio, stepIngreso),
    },
    prima: {
      min: 0,
      max: redondear(RANGOS_SLIDERS.usd.prima.max * cambio, stepPrima),
      step: stepPrima,
      def: redondear(RANGOS_SLIDERS.usd.prima.def * cambio, stepPrima),
    },
  };
}

/**
 * Puerto del orquestador `calcular()` de app.js como hook de React.
 * Mantiene estado (pais, seleccion, tipo, inputs) y deriva `resultados`
 * con `useMemo`, replicando la conversión de moneda y el orden del legacy.
 */
export function useCalculadoraCredito(): {
  pais: Pais;
  cambiarPais: (id: PaisId) => void;
  seleccion: Set<string>;
  toggleBanco: (id: string) => void;
  selectAll: (todo: boolean) => void;
  tipoActual: TipoPrestamo;
  setTipo: (t: TipoPrestamo) => void;
  inputs: CalculadoraInputs;
  setInputs: (p: Partial<CalculadoraInputs>) => void;
  rangos: ReturnType<typeof rangosParaMoneda>;
  plazoMax: number;
  resultados: ResultadoBanco[];
  noCalifican: ResultadoBanco[];
} {
  const [paisId, setPaisId] = useState<PaisId>("cr");
  const pais = getPais(paisId);

  const [tipoActual, setTipoState] = useState<TipoPrestamo>("personal");
  const [seleccion, setSeleccion] = useState<Set<string>>(
    () => new Set(SELECCION_INICIAL_CR),
  );

  const [inputs, setInputsState] = useState<CalculadoraInputs>({
    ingreso: RANGOS_SLIDERS.crc.ingreso.def,
    deudas: RANGOS_SLIDERS.crc.deudas.def,
    plazo: CONFIG_TIPOS.personal.plazoDef,
    prima: RANGOS_SLIDERS.crc.prima.def,
    moneda: "crc",
    orden: "cuota",
  });

  const bancos = useMemo(() => bancosDePais(paisId), [paisId]);
  const cambio = pais.cambioUSD || TIPO_CAMBIO_USD;
  const rangos = useMemo(
    () => rangosParaMoneda(inputs.moneda, pais),
    [inputs.moneda, pais],
  );

  const cambiarPais = useCallback(
    (id: PaisId) => {
      const existe = PAISES.some((p) => p.id === id);
      const nuevoId = existe ? id : "cr";
      const nuevosBancos = bancosDePais(nuevoId);
      setPaisId(nuevoId);
      setSeleccion(
        nuevoId === "cr"
          ? new Set(SELECCION_INICIAL_CR)
          : new Set(nuevosBancos.map((b) => b.id)),
      );
      // Al cambiar de país, la moneda local reinicia los rangos a los defaults.
      const nuevoPais = getPais(nuevoId);
      const esDolarizado = nuevoPais.moneda === "USD" || nuevoPais.moneda === "USD/PAB";
      const nuevaMoneda: Moneda = esDolarizado ? "usd" : "crc";
      const r = rangosParaMoneda(nuevaMoneda, nuevoPais);
      setInputsState((prev) => ({
        ...prev,
        moneda: nuevaMoneda,
        ingreso: r.ingreso.def,
        deudas: r.deudas.def,
        prima: r.prima.def,
      }));
    },
    [],
  );

  const toggleBanco = useCallback((id: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(
    (todo: boolean) => {
      setSeleccion(todo ? new Set(bancos.map((b) => b.id)) : new Set());
    },
    [bancos],
  );

  const setTipo = useCallback((t: TipoPrestamo) => {
    setTipoState(t);
    const cfg = CONFIG_TIPOS[t];
    setInputsState((prev) => {
      const next: CalculadoraInputs = {
        ...prev,
        plazo: cfg.plazoDef,
      };
      if (cfg.prima) {
        const r = rangosParaMoneda(prev.moneda, getPais(paisId));
        next.prima = r.prima.def;
      }
      return next;
    });
  }, [paisId]);

  /**
   * `setInputs` parchea los inputs. Si cambia la moneda, replica
   * `aplicarRangosMoneda(convertirValores=true)` (app.js:931-953):
   * convierte ingreso/deudas/prima por el tipo de cambio y redondea al step.
   */
  const setInputs = useCallback(
    (p: Partial<CalculadoraInputs>) => {
      setInputsState((prev) => {
        if (p.moneda && p.moneda !== prev.moneda) {
          const tasa = cambio;
          const r = rangosParaMoneda(p.moneda, pais);
          const convertir = (valor: number) => {
            let v = Number(valor) || 0;
            v = p.moneda === "usd" ? v / tasa : v * tasa;
            return Math.round(v / r.ingreso.step) * r.ingreso.step;
          };
          return {
            ...prev,
            moneda: p.moneda,
            ingreso: clamp(convertir(prev.ingreso), r.ingreso),
            deudas: clamp(convertir(prev.deudas), r.deudas),
            prima: clamp(convertir(prev.prima), r.prima),
            ...sinMoneda(p),
          };
        }
        return { ...prev, ...p };
      });
    },
    [cambio, pais],
  );

  // Plazo máximo entre los bancos seleccionados (`plazoMaxSeleccionado`).
  const plazoMax = useMemo(() => {
    const sel = bancos.filter((b) => seleccion.has(b.id));
    if (sel.length === 0) return CONFIG_TIPOS[tipoActual].plazoDef;
    return Math.max(...sel.map((b) => b[tipoActual].plazoMax));
  }, [bancos, seleccion, tipoActual]);

  const resultadosTodos = useMemo(
    () =>
      calcularCredito({
        ingreso: inputs.ingreso,
        deudas: inputs.deudas,
        plazo: inputs.plazo,
        prima: inputs.prima,
        moneda: inputs.moneda,
        tipo: tipoActual,
        cambio,
        bancos,
        seleccion: [...seleccion],
      }),
    [
      inputs.ingreso,
      inputs.deudas,
      inputs.plazo,
      inputs.prima,
      inputs.moneda,
      tipoActual,
      cambio,
      bancos,
      seleccion,
    ],
  );

  const { calificantes, noCalifican } = useMemo(
    () => ordenarResultados(resultadosTodos, inputs.orden),
    [resultadosTodos, inputs.orden],
  );

  return {
    pais,
    cambiarPais,
    seleccion,
    toggleBanco,
    selectAll,
    tipoActual,
    setTipo,
    inputs,
    setInputs,
    rangos,
    plazoMax,
    resultados: calificantes,
    noCalifican,
  };
}

type Rango = { min: number; max: number; step: number; def: number };

function clamp(v: number, r: Rango): number {
  return Math.max(r.min, Math.min(r.max, Math.round(v)));
}

/** Quita `moneda` de un partial para el spread (ya se maneja aparte). */
function sinMoneda(p: Partial<CalculadoraInputs>): Partial<CalculadoraInputs> {
  const { moneda: _moneda, ...rest } = p;
  return rest;
}

