"use client";

import { useCallback, useMemo, useState } from "react";
import type { Aseguradora, AvisoLegal, Pais, PaisId } from "@/types/precali";
import { ASEGURADORAS } from "@/data/aseguradoras";
import { PAISES } from "@/data/paises";
import { AVISOS_LEGALES } from "@/data/avisos";
import {
  COBERTURA_LABEL,
  DEDUCIBLE_OPTIONS,
  DEFAULT_AUTO_VALOR,
  MODALIDAD_OPTIONS,
  PLAN_SALUD_OPTIONS,
  RED_OPTIONS,
  SALUD_USD_MENSUAL_35,
  TASAS_AUTO,
  USO_OPTIONS,
  ZONA_OPTIONS,
  labelDe,
  type CoberturaAuto,
  type DeducibleSalud,
  type ModalidadSalud,
  type OrdenSeguro,
  type PlanSalud,
  type RedSalud,
  type TipoSeguro,
  type UsoAuto,
  type ZonaAuto,
} from "@/data/tasas";

/**
 * Puerto fiel (verbatim) del orquestador `segurosRuntime` (seguros.js).
 *
 * El núcleo numérico (`calcularSeguro` + helpers) está aislado y sin
 * dependencias de React para poder verificarlo con vitest contra valores
 * calculados a mano. El hook `useComparadorSeguros` mantiene el estado
 * (país, tipo, inputs) y deriva `resultados` con `useMemo`, replicando
 * la conversión de moneda y el orden del legacy.
 */

export type {
  CoberturaAuto,
  DeducibleSalud,
  ModalidadSalud,
  OrdenSeguro,
  PlanSalud,
  RedSalud,
  TipoSeguro,
  UsoAuto,
  ZonaAuto,
};

export interface InputsAuto {
  valor: number;
  anio: number;
  cobertura: CoberturaAuto;
  uso: UsoAuto;
  zona: ZonaAuto;
  edad: number;
}
export interface InputsVida {
  edad: number;
  suma: number;
  fumador: "si" | "no";
  plazo: number;
}
export interface InputsSalud {
  edad: number;
  plan: PlanSalud;
  deducible: DeducibleSalud;
  modalidad: ModalidadSalud;
  red: RedSalud;
}
export interface InputsSeguro {
  auto: InputsAuto;
  vida: InputsVida;
  salud: InputsSalud;
}

export interface MetaSeguro {
  frecuencia: "mensual" | "anual";
  productoLabel: string;
  resumenCorto: string;
  detalle: string;
  variables: string[];
  precision: string;
}

export interface ResultadoSeguro {
  aseguradora: Aseguradora;
  min: number;
  max: number;
  monthlyMin: number;
  monthlyMax: number;
  cotizador: string;
  nota: string;
  meta: MetaSeguro;
}

/* ───────── helpers de moneda y formato (puerto de seguros.js:87-123) ───────── */

/** Puerto de `moneda()` (seguros.js:87-94). */
export function monedaSeguro(pais: Pais): {
  codigo: string;
  simbolo: string;
  cambioUSD: number;
} {
  return {
    codigo: pais.moneda === "USD/PAB" ? "USD" : pais.moneda,
    simbolo: pais.simbolo || "$",
    cambioUSD: pais.cambioUSD || 1,
  };
}

/** Puerto de `toLocal(usd)` (seguros.js:120-123). */
function toLocal(usd: number, pais: Pais): number {
  const m = monedaSeguro(pais);
  return m.codigo === "USD" ? usd : usd * m.cambioUSD;
}

/** Puerto de `fmt(v, m)` (seguros.js:110-114) — `Intl.NumberFormat('es-CR')`. */
export function fmtSeguro(v: number, pais: Pais): string {
  const m = monedaSeguro(pais);
  const value = Math.max(0, Math.round(Number(v) || 0));
  const formatted = new Intl.NumberFormat("es-CR", {
    maximumFractionDigits: 0,
  }).format(value);
  return `${m.simbolo}${formatted}`;
}

/** Puerto de `usdFmt(v)` (seguros.js:116-118). */
export function usdFmt(v: number): string {
  return `$${new Intl.NumberFormat("es-CR", { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.round(Number(v) || 0)),
  )}`;
}

/** Puerto de `rangeLabel(r, m)` (seguros.js:278-281). */
export function rangeLabelSeguro(r: ResultadoSeguro, pais: Pais): string {
  const sufijo = r.meta.frecuencia === "mensual" ? "/ mes" : "/ año";
  return `${fmtSeguro(r.min, pais)} - ${fmtSeguro(r.max, pais)} ${sufijo}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(n) || 0));
}

/* ───────── factores del legacy (seguros.js:152-188) ───────── */

function factorAntiguedad(anio: number, year: number): number {
  const edadVehiculo = Math.max(0, year - anio);
  if (edadVehiculo > 15) return 0.78;
  if (edadVehiculo > 10) return 0.85;
  if (edadVehiculo > 5) return 0.92;
  if (edadVehiculo <= 1) return 1.04;
  return 1;
}

function factorEdad(edad: number): number {
  if (edad < 25) return 1.22;
  if (edad > 70) return 1.12;
  if (edad > 60) return 1.06;
  return 1;
}

function factorUso(uso: UsoAuto): number {
  if (uso === "plataforma") return 1.6;
  if (uso === "comercial") return 1.35;
  return 1;
}

function factorZona(zona: ZonaAuto): number {
  if (zona === "alto_riesgo") return 1.28;
  if (zona === "capital") return 1.12;
  return 0.96;
}

function precisionAuto(input: InputsAuto): string {
  if (input.uso !== "particular" || input.zona === "alto_riesgo" || input.edad < 25)
    return "Media-alta";
  return "Alta";
}

/* ───────── constructores por producto (seguros.js:190-268) ───────── */

const NOTA_DEFAULT = "Precio final sujeto a evaluación oficial.";

/** Puerto de `build(a, min, max, meta)` (seguros.js:190-203). */
function build(
  a: Aseguradora,
  min: number,
  max: number,
  meta: MetaSeguro,
  tipo: TipoSeguro,
): ResultadoSeguro {
  const producto = a.productos[tipo]!;
  const monthlyMin = meta.frecuencia === "mensual" ? min : min / 12;
  const monthlyMax = meta.frecuencia === "mensual" ? max : max / 12;
  return {
    aseguradora: a,
    min: Math.round(min),
    max: Math.round(max),
    monthlyMin: Math.round(monthlyMin),
    monthlyMax: Math.round(monthlyMax),
    cotizador: producto.cotizador || a.web,
    nota: producto.nota || NOTA_DEFAULT,
    meta,
  };
}

/** Puerto de `calcAuto(a)` (seguros.js:205-222). */
function calcAuto(
  a: Aseguradora,
  paisId: PaisId,
  input: InputsAuto,
  year: number,
): ResultadoSeguro {
  const valor = clamp(input.valor, 1000, 999_999_999);
  const anio = clamp(input.anio, 1990, year + 1);
  const edad = clamp(input.edad, 18, 85);
  const cobertura = input.cobertura;
  const tasas =
    (TASAS_AUTO[paisId] || TASAS_AUTO.cr)[cobertura] || TASAS_AUTO.cr.amplio;
  const factor =
    factorAntiguedad(anio, year) *
    factorEdad(edad) *
    factorUso(input.uso) *
    factorZona(input.zona) *
    (a.productos.auto?.factor || 1);
  const coberturaTexto = COBERTURA_LABEL[cobertura] || cobertura;

  return build(
    a,
    valor * (tasas[0] / 100) * factor,
    valor * (tasas[1] / 100) * factor,
    {
      frecuencia: "anual",
      productoLabel: "Seguro de vehículo",
      resumenCorto: coberturaTexto,
      detalle: `${coberturaTexto} · ${anio} · ${labelDe(USO_OPTIONS, input.uso)}`,
      variables: [
        "valor del vehículo",
        "año",
        "cobertura",
        "zona",
        "edad del conductor",
        "uso",
      ],
      precision: precisionAuto(input),
    },
    "auto",
  );
}

/** Puerto de `tarifaVida(edad)` (seguros.js:224-229). */
function tarifaVida(edad: number): [number, number] {
  if (edad <= 30) return [15, 25];
  if (edad <= 40) return [25, 45];
  if (edad <= 50) return [60, 110];
  return [140, 250];
}

/** Puerto de `calcVida(a)` (seguros.js:231-248). */
function calcVida(a: Aseguradora, pais: Pais, input: InputsVida): ResultadoSeguro {
  const edad = clamp(input.edad, 18, 75);
  const suma = clamp(input.suma, 5000, 2_000_000);
  const base = tarifaVida(edad);
  const fumadorFactor = input.fumador === "si" ? 1.45 : 1;
  const plazo = Number(input.plazo);
  const plazoFactor = plazo <= 10 ? 0.9 : plazo >= 30 ? 1.16 : 1;
  const factor =
    (suma / 50000) * fumadorFactor * plazoFactor * (a.productos.vida?.factor || 1);

  return build(a, toLocal(base[0] * factor, pais), toLocal(base[1] * factor, pais), {
    frecuencia: "mensual",
    productoLabel: "Seguro de vida",
    resumenCorto: `${usdFmt(suma)} suma`,
    detalle: `${usdFmt(suma)} suma · ${plazo} años · ${
      input.fumador === "si" ? "Fumador" : "No fumador"
    }`,
    variables: ["edad", "suma asegurada", "fumador", "plazo"],
    precision: edad > 55 ? "Media" : "Alta",
  }, "vida");
}

/** Puerto de `calcSalud(a)` (seguros.js:250-268). */
function calcSalud(
  a: Aseguradora,
  paisId: PaisId,
  pais: Pais,
  input: InputsSalud,
): ResultadoSeguro {
  const edad = clamp(input.edad, 0, 80);
  const base = SALUD_USD_MENSUAL_35[paisId] || SALUD_USD_MENSUAL_35.cr;
  const ageFactor =
    edad >= 35
      ? 1 + (edad - 35) * 0.06
      : Math.max(0.55, 1 - (35 - edad) * 0.025);
  const planFactor =
    ({ basico: 0.72, intermedio: 1, premium: 1.58 } as const)[input.plan] || 1;
  const deducibleFactor =
    ({ bajo: 1.18, medio: 1, alto: 0.82 } as const)[input.deducible] || 1;
  const modalidadFactor = input.modalidad === "familiar" ? 2.18 : 1;
  const redFactor =
    ({ local: 1, regional: 1.18, internacional: 1.45 } as const)[input.red] || 1;
  const factor =
    ageFactor *
    planFactor *
    deducibleFactor *
    modalidadFactor *
    redFactor *
    (a.productos.salud?.factor || 1);

  const planLabel = labelDe(PLAN_SALUD_OPTIONS, input.plan);
  return build(
    a,
    toLocal(base[0] * factor, pais),
    toLocal(base[1] * factor, pais),
    {
      frecuencia: "mensual",
      productoLabel: "Seguro de salud",
      resumenCorto: planLabel,
      detalle: `${planLabel} · ${labelDe(MODALIDAD_OPTIONS, input.modalidad)} · red ${labelDe(
        RED_OPTIONS,
        input.red,
      ).toLowerCase()}`,
      variables: ["edad", "nivel de plan", "deducible", "modalidad", "red médica"],
      precision: input.red === "internacional" ? "Media" : "Media-alta",
    },
    "salud",
  );
}

export interface CalcularSeguroInput {
  pais: Pais;
  paisId: PaisId;
  tipo: TipoSeguro;
  inputs: InputsSeguro;
  aseguradoras?: Aseguradora[];
  /** Año de referencia para `factorAntiguedad` (legacy = `new Date().getFullYear()`). */
  year?: number;
}

/**
 * Puerto del orquestador `calcular()` (seguros.js:270-276) + `aseguradoras()`
 * (seguros.js:147-150). Filtra por país y producto activo y delega al
 * constructor correspondiente. Función PURA: sin React ni DOM.
 */
export function calcularSeguro(input: CalcularSeguroInput): ResultadoSeguro[] {
  const {
    pais,
    paisId,
    tipo,
    inputs,
    aseguradoras = ASEGURADORAS,
    year = new Date().getFullYear(),
  } = input;
  const activos = aseguradoras.filter(
    (a) => a.pais === paisId && a.productos?.[tipo],
  );
  return activos.map((a) => {
    if (tipo === "vida") return calcVida(a, pais, inputs.vida);
    if (tipo === "salud") return calcSalud(a, paisId, pais, inputs.salud);
    return calcAuto(a, paisId, inputs.auto, year);
  });
}

/** Puerto del `sort` de `render()` (seguros.js:298-302). */
export function ordenarSeguros(
  results: ResultadoSeguro[],
  orden: OrdenSeguro,
): ResultadoSeguro[] {
  const copy = [...results];
  copy.sort(
    orden === "rating"
      ? (a, b) => (b.aseguradora.rating || 0) - (a.aseguradora.rating || 0)
      : (a, b) => a.monthlyMin - b.monthlyMin,
  );
  return copy;
}

/* ───────── defaults (HTML de index.html:287-369) ───────── */

export const INPUTS_INICIALES: InputsSeguro = {
  auto: {
    valor: DEFAULT_AUTO_VALOR.cr,
    anio: 2022,
    cobertura: "amplio",
    uso: "particular",
    zona: "capital",
    edad: 35,
  },
  vida: { edad: 35, suma: 50_000, fumador: "no", plazo: 20 },
  salud: {
    edad: 35,
    plan: "intermedio",
    deducible: "medio",
    modalidad: "individual",
    red: "local",
  },
};

function getPais(id: PaisId): Pais {
  return PAISES.find((p) => p.id === id) ?? PAISES[0];
}

/* ───────── hook ───────── */

/**
 * Puerto del orquestador `segurosRuntime` como hook de React. Mantiene el
 * estado (país, tipo, inputs, orden) y deriva `resultados` con `useMemo`.
 * Signature análoga a `useCalculadoraCredito`.
 */
export function useComparadorSeguros(): {
  pais: Pais;
  cambiarPais: (id: PaisId) => void;
  tipo: TipoSeguro;
  setTipo: (t: TipoSeguro) => void;
  inputs: InputsSeguro;
  setInputs: <K extends TipoSeguro>(tipo: K, patch: Partial<InputsSeguro[K]>) => void;
  orden: OrdenSeguro;
  setOrden: (o: OrdenSeguro) => void;
  resultados: ResultadoSeguro[];
} {
  const [paisId, setPaisId] = useState<PaisId>("cr");
  const pais = getPais(paisId);

  const [tipo, setTipoState] = useState<TipoSeguro>("auto");
  const [inputs, setInputsState] = useState<InputsSeguro>(INPUTS_INICIALES);
  const [orden, setOrden] = useState<OrdenSeguro>("precio");
  const [year] = useState<number>(() => new Date().getFullYear());

  // `cambiarPais` replica `syncCountry(force=true)` (seguros.js:564-569):
  // fuerza el valor del vehículo al default del país destino.
  const cambiarPais = useCallback((id: PaisId) => {
    const existe = PAISES.some((p) => p.id === id);
    const nuevoId = existe ? id : "cr";
    setPaisId(nuevoId);
    setInputsState((prev) => ({
      ...prev,
      auto: {
        ...prev.auto,
        valor: DEFAULT_AUTO_VALOR[nuevoId] || DEFAULT_AUTO_VALOR.cr,
      },
    }));
  }, []);

  const setTipo = useCallback((t: TipoSeguro) => {
    setTipoState(t);
  }, []);

  const setInputs = useCallback(
    <K extends TipoSeguro>(tipoActivo: K, patch: Partial<InputsSeguro[K]>) => {
      setInputsState((prev) => ({
        ...prev,
        [tipoActivo]: { ...prev[tipoActivo], ...patch },
      }));
    },
    [],
  );

  const resultados = useMemo(
    () =>
      ordenarSeguros(
        calcularSeguro({ pais, paisId, tipo, inputs, year }),
        orden,
      ),
    [pais, paisId, tipo, inputs, year, orden],
  );

  return {
    pais,
    cambiarPais,
    tipo,
    setTipo,
    inputs,
    setInputs,
    orden,
    setOrden,
    resultados,
  };
}

/** Aviso legal del país activo (puerto de `avisoLegalSeguro`, seguros.js:97-100). */
export function avisoLegalSeguro(
  paisId: PaisId,
): { seguros?: string; privacidad?: string } {
  const a: AvisoLegal | undefined = AVISOS_LEGALES[paisId] ?? AVISOS_LEGALES.cr;
  return { seguros: a?.seguros, privacidad: a?.privacidad };
}
