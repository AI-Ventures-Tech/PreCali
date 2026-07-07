import type { Banco, Pais } from "@/types/precali";
import { TIPO_CAMBIO_USD } from "@/data/config";
import type { Falla, Moneda } from "@/hooks/calc";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Puerto de `monedaInfo(mon)` (app.js:62). */
export function monedaInfo(moneda: Moneda, pais: Pais): {
  codigo: string;
  simbolo: string;
  cambioUSD: number;
} {
  if (moneda === "usd") return { codigo: "USD", simbolo: "$", cambioUSD: 1 };
  return {
    codigo: pais.moneda || "CRC",
    simbolo: pais.simbolo || "₡",
    cambioUSD: pais.cambioUSD || TIPO_CAMBIO_USD,
  };
}

/** Puerto de `fmt(v, mon)` (app.js:76). */
export function fmt(v: number, moneda: Moneda, pais: Pais): string {
  const symbol = monedaInfo(moneda, pais).simbolo;
  return (
    symbol +
    new Intl.NumberFormat("es-CR", { maximumFractionDigits: 0 }).format(
      Math.round(v),
    )
  );
}

/** Puerto de `fmtPlano(v, mon)` (app.js:81) — separador de miles con espacio. */
export function fmtPlano(v: number, moneda: Moneda, pais: Pais): string {
  const symbol = monedaInfo(moneda, pais).simbolo;
  const n = Math.max(0, Math.round(Number(v) || 0));
  return (
    symbol +
    new Intl.NumberFormat("es-CR", { maximumFractionDigits: 0 })
      .format(n)
      .replace(/,/g, " ")
  );
}

/** Puerto de `describirMonto(v, mon)` (app.js:87). */
export function describirMonto(v: number, moneda: Moneda, pais: Pais): string {
  const n = Math.max(0, Math.round(Number(v) || 0));
  if (n === 0) return `${fmtPlano(0, moneda, pais)} · 0`;
  const divisor = n >= 1000000 ? 1000000 : 1000;
  const unidad = n >= 1000000 ? "millones" : "mil";
  const valor = n / divisor;
  const decimales = valor >= 10 || Number.isInteger(valor) ? 0 : 1;
  return `${fmtPlano(n, moneda, pais)} · ${valor.toLocaleString("es-CR", {
    maximumFractionDigits: decimales,
  })} ${unidad}`;
}

/** Puerto de `fechaLegible(iso)` (app.js:97). */
export function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]}, ${y}`;
}

/** Puerto de `etiquetaCalidadDato(banco)` (app.js:103). */
export function etiquetaCalidadDato(banco: Banco): string {
  // Los datos tipados no exponen `calidadDato`, así que nunca es referencial.
  return (banco as Banco & { calidadDato?: string }).calidadDato === "referencial"
    ? " · Referencial"
    : "";
}

/** Puerto de `textoCalidadDato(banco)` (app.js:107). */
export function textoCalidadDato(banco: Banco): string {
  if ((banco as Banco & { calidadDato?: string }).calidadDato === "referencial") {
    return "Datos regionales referenciales cargados para prueba de mercado; deben validarse con el banco antes de aplicar.";
  }
  return `Información tomada del sitio oficial de ${banco.nombre} (${banco.web}).`;
}

/** Puerto de `describirFallaPrincipal(r, moneda)` (app.js:956-973). */
export function describirFallaPrincipal(
  falla: Falla | undefined,
  moneda: Moneda,
  pais: Pais,
): string {
  if (!falla) return "No cumple una condicion basica del banco.";
  if (falla.tipo === "ingreso") {
    return `Ingreso minimo requerido: ${fmt(falla.requerido ?? 0, moneda, pais)}.`;
  }
  if (falla.tipo === "deuda") {
    const ratioActual =
      (falla.ingreso ?? 0) > 0
        ? Math.round(((falla.deudas ?? 0) / falla.ingreso!) * 100)
        : 0;
    return `Deudas actuales: ${ratioActual}% del ingreso. Maximo banco: ${Math.round(
      (falla.ratioMax ?? 0) * 100,
    )}%.`;
  }
  if (falla.tipo === "sinPrima") {
    return `Requiere prima para financiar hasta ${Math.round(
      (falla.financia ?? 0) * 100,
    )}% del bien.`;
  }
  if (falla.tipo === "montoMin") {
    return `Monto calculado bajo el minimo: ${fmt(falla.requerido ?? 0, moneda, pais)}.`;
  }
  return "No cumple una condicion basica del banco.";
}

