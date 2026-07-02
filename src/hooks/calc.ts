import type { Banco, CondicionPrestamo, TipoPrestamo } from "@/types/precali";
import { CONFIG_TIPOS } from "@/data/config";

/**
 * Núcleo puro de cálculo de crédito. Puerto fiel (verbatim) de `evaluarBanco`
 * y del orquestador `calcular` de app.js. Sin dependencias de React ni del DOM,
 * para poder probarlo numericamente con vitest.
 */

export type Moneda = "crc" | "usd";
export type Orden = "cuota" | "tasa" | "monto" | "total";

export interface Falla {
  tipo: "ingreso" | "deuda" | "sinPrima" | "montoMin";
  requerido?: number;
  actual?: number;
  ratioMax?: number;
  ingreso?: number;
  deudas?: number;
  financia?: number;
  calculado?: number;
}

export interface ResultadoBanco {
  banco: Banco;
  params: CondicionPrestamo;
  tasa: number;
  plazoEfectivo: number;
  plazoSolicitado: number;
  ratio: number;
  capacidad: number;
  monto: number;
  cuota: number;
  total: number;
  intereses: number;
  valorBien: number | null;
  ingresoMinConvertido: number;
  montoMinConvertido: number;
  fallas: Falla[];
  califica: boolean;
}

export interface EvaluarBancoInput {
  ingreso: number;
  deudas: number;
  plazo: number;
  prima: number;
  moneda: Moneda;
  tipo: TipoPrestamo;
  cambio: number;
}

/**
 * Puerto verbatim de `evaluarBanco` (app.js:425-492).
 * Los thresholds del banco (ingresoMin, montoMin) están definidos en colones;
 * se convierten a la moneda visible para que las comparaciones tengan sentido.
 */
export function evaluarBanco(
  banco: Banco,
  input: EvaluarBancoInput,
): ResultadoBanco {
  const { ingreso, deudas, plazo, prima, moneda, tipo, cambio } = input;
  const params = banco[tipo];
  const requierePrima = CONFIG_TIPOS[tipo].prima;

  const tasa =
    moneda === "usd"
      ? (params.tasaUSD ?? params.tasaCRC)
      : (params.tasaCRC ?? params.tasaUSD);
  const plazoEfectivo = Math.min(plazo, params.plazoMax);
  const i = tasa / 100 / 12;
  const n = plazoEfectivo * 12;

  // Los thresholds del banco (ingresoMin, montoMin) están definidos en colones.
  // Los convertimos a la moneda visible para que las comparaciones tengan sentido.
  const bancoMonedaBase = "crc" as "crc" | "usd";
  const monedaVisibleBase = (moneda === "usd" ? "usd" : "local") as "usd" | "local";
  const bancoBase = (bancoMonedaBase === "usd" ? "usd" : "local") as "usd" | "local";
  const factorConversion =
    bancoBase === monedaVisibleBase
      ? 1
      : bancoBase === "usd"
        ? cambio
        : 1 / cambio;
  const ingresoMinConvertido = (params.ingresoMin ?? 0) * factorConversion;
  const montoMinConvertido = (params.montoMin ?? 0) * factorConversion;

  const fallas: Falla[] = [];

  if (ingreso < ingresoMinConvertido) {
    fallas.push({ tipo: "ingreso", requerido: ingresoMinConvertido, actual: ingreso });
  }

  const capacidadBanco = ingreso * params.ratioMax - deudas;
  if (capacidadBanco <= 0) {
    fallas.push({ tipo: "deuda", ratioMax: params.ratioMax, ingreso, deudas });
  }

  let monto = 0;
  let valorBien: number | null = null;

  if (capacidadBanco > 0) {
    monto =
      i > 0
        ? (capacidadBanco * (1 - Math.pow(1 + i, -n))) / i
        : capacidadBanco * n;

    if (requierePrima) {
      if (prima <= 0) {
        fallas.push({ tipo: "sinPrima", financia: params.financia });
      } else {
        const financia = params.financia ?? 1;
        const maxFinanciado = (prima * financia) / (1 - financia);
        monto = Math.min(monto, maxFinanciado);
      }
    }

    if (monto < montoMinConvertido) {
      fallas.push({
        tipo: "montoMin",
        requerido: montoMinConvertido,
        calculado: monto,
      });
    }
  }

  if (requierePrima && monto > 0) {
    valorBien = monto + prima;
  }

  const cuota =
    i > 0 && monto > 0
      ? (monto * i) / (1 - Math.pow(1 + i, -n))
      : monto > 0
        ? monto / n
        : 0;
  const total = cuota * n;
  const intereses = total - monto;

  return {
    banco,
    params,
    tasa,
    plazoEfectivo,
    plazoSolicitado: plazo,
    ratio: params.ratioMax,
    capacidad: Math.max(0, capacidadBanco),
    monto: Math.max(0, monto),
    cuota,
    total,
    intereses,
    valorBien,
    ingresoMinConvertido,
    montoMinConvertido,
    fallas,
    califica: fallas.length === 0,
  };
}

export interface CalcInput {
  ingreso: number;
  deudas: number;
  plazo: number;
  prima: number;
  moneda: Moneda;
  tipo: TipoPrestamo;
  cambio: number;
  bancos: Banco[];
  seleccion: string[];
}

/**
 * Evalúa cada banco seleccionado (verbatim del `.map(b => evaluarBanco(...))`
 * en app.js:1037-1039). Devuelve TODOS los bancos seleccionados con su flag
 * `califica`; el filtrado + orden se hace en `ordenarResultados`.
 */
export function calcularCredito(input: CalcInput): ResultadoBanco[] {
  const { ingreso, deudas, plazo, prima, moneda, tipo, cambio, bancos, seleccion } = input;
  const set = new Set(seleccion);
  return bancos
    .filter((b) => set.has(b.id))
    .map((b) => evaluarBanco(b, { ingreso, deudas, plazo, prima, moneda, tipo, cambio }));
}

const SORTERS: Record<Orden, (a: ResultadoBanco, b: ResultadoBanco) => number> = {
  cuota: (a, b) => a.cuota - b.cuota,
  tasa: (a, b) => a.tasa - b.tasa,
  monto: (a, b) => b.monto - a.monto,
  total: (a, b) => a.total - b.total,
};

/**
 * Replica `calificantes.sort(sorters[orden])` (app.js:1041-1050) y separa
 * los no calificantes para el bloque "donde todavía no calificás".
 */
export function ordenarResultados(
  resultados: ResultadoBanco[],
  orden: Orden,
): { calificantes: ResultadoBanco[]; noCalifican: ResultadoBanco[] } {
  const calificantes = resultados.filter((r) => r.califica);
  const noCalifican = resultados.filter((r) => !r.califica);
  calificantes.sort(SORTERS[orden]);
  return { calificantes, noCalifican };
}
