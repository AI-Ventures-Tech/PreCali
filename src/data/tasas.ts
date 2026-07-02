import type { PaisId } from "../types/precali";

/**
 * Puerto fiel de las tablas de tasas propias de `seguros.js` (líneas 7-35).
 * Se mantienen como constantes tipadas separadas del hook para poder testear
 * el estimador puro sin depender de React ni del DOM.
 *
 * Rangos en porcentaje anual sobre el valor del vehículo (`TASAS_AUTO`),
 * prima mensual USD de referencia para un perfil de 35 años (`SALUD_USD_MENSUAL_35`)
 * y valor por defecto del vehículo al cambiar de país (`DEFAULT_AUTO_VALOR`).
 */

export type CoberturaAuto = "basico" | "intermedio" | "amplio";
export type UsoAuto = "particular" | "comercial" | "plataforma";
export type ZonaAuto = "capital" | "interior" | "alto_riesgo";
export type Fumador = "si" | "no";
export type PlanSalud = "basico" | "intermedio" | "premium";
export type DeducibleSalud = "bajo" | "medio" | "alto";
export type ModalidadSalud = "individual" | "familiar";
export type RedSalud = "local" | "regional" | "internacional";
export type TipoSeguro = "auto" | "vida" | "salud";
export type OrdenSeguro = "precio" | "rating";

/** `TASAS_AUTO` (seguros.js:7-15) — [min, max] % anual por país y cobertura. */
export const TASAS_AUTO: Record<PaisId, Record<CoberturaAuto, [number, number]>> = {
  mx: { basico: [0.8, 1.5], intermedio: [2, 3.5], amplio: [3.5, 6.5] },
  gt: { basico: [1.2, 2], intermedio: [2, 3.5], amplio: [2.5, 5] },
  sv: { basico: [0.8, 1.5], intermedio: [1.5, 2.8], amplio: [2.2, 4] },
  hn: { basico: [1.5, 2.5], intermedio: [2.5, 4], amplio: [3.5, 6] },
  ni: { basico: [1.5, 2.5], intermedio: [2.5, 4], amplio: [3, 5.5] },
  cr: { basico: [0.8, 1.5], intermedio: [1.5, 2.5], amplio: [2, 4] },
  pa: { basico: [0.6, 1.1], intermedio: [1.2, 2], amplio: [2, 3.8] },
};

/** `SALUD_USD_MENSUAL_35` (seguros.js:17-25) — [min, max] USD/mes perfil 35 años. */
export const SALUD_USD_MENSUAL_35: Record<PaisId, [number, number]> = {
  mx: [217, 371],
  gt: [103, 258],
  sv: [80, 220],
  hn: [99, 217],
  ni: [41, 110],
  cr: [59, 157],
  pa: [130, 250],
};

/** `DEFAULT_AUTO_VALOR` (seguros.js:27-35) — valor del vehículo al cambiar de país. */
export const DEFAULT_AUTO_VALOR: Record<PaisId, number> = {
  cr: 12_000_000,
  mx: 350_000,
  gt: 120_000,
  sv: 20_000,
  hn: 500_000,
  ni: 15_000,
  pa: 20_000,
};

/**
 * Etiquetas legibles de cada `<option>` del legacy (index.html:300-367).
 * El estimador las usa para armar `meta.detalle` / `meta.resumenCorto`
 * igual que `els.<select>.options[...selectedIndex].text` en seguros.js.
 */
export const COBERTURA_LABEL: Record<CoberturaAuto, string> = {
  basico: "Básica / RC",
  intermedio: "Intermedia",
  amplio: "Todo riesgo",
};

export const USO_OPTIONS: { value: UsoAuto; label: string }[] = [
  { value: "particular", label: "Particular" },
  { value: "comercial", label: "Comercial" },
  { value: "plataforma", label: "Plataformas / reparto" },
];

export const ZONA_OPTIONS: { value: ZonaAuto; label: string }[] = [
  { value: "capital", label: "Capital / zona urbana" },
  { value: "interior", label: "Interior del país" },
  { value: "alto_riesgo", label: "Zona de mayor riesgo" },
];

export const COBERTURA_OPTIONS: { value: CoberturaAuto; label: string }[] = [
  { value: "basico", label: "Básica / responsabilidad civil" },
  { value: "intermedio", label: "Intermedia / terceros completo" },
  { value: "amplio", label: "Todo riesgo / cobertura amplia" },
];

export const FUMADOR_OPTIONS: { value: Fumador; label: string }[] = [
  { value: "no", label: "No fumador" },
  { value: "si", label: "Fumador" },
];

export const PLAZO_VIDA_OPTIONS: { value: number; label: string }[] = [
  { value: 10, label: "10 años" },
  { value: 20, label: "20 años" },
  { value: 30, label: "30 años" },
];

export const PLAN_SALUD_OPTIONS: { value: PlanSalud; label: string }[] = [
  { value: "basico", label: "Básico" },
  { value: "intermedio", label: "Intermedio" },
  { value: "premium", label: "Premium / internacional" },
];

export const DEDUCIBLE_OPTIONS: { value: DeducibleSalud; label: string }[] = [
  { value: "bajo", label: "Bajo" },
  { value: "medio", label: "Medio" },
  { value: "alto", label: "Alto" },
];

export const MODALIDAD_OPTIONS: { value: ModalidadSalud; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "familiar", label: "Familiar" },
];

export const RED_OPTIONS: { value: RedSalud; label: string }[] = [
  { value: "local", label: "Local" },
  { value: "regional", label: "Regional" },
  { value: "internacional", label: "Internacional" },
];

/** Helper para resolver el label de un valor de option (fallback al valor). */
export function labelDe<T extends string>(
  opciones: { value: T; label: string }[],
  value: T,
): string {
  return opciones.find((o) => o.value === value)?.label ?? value;
}
