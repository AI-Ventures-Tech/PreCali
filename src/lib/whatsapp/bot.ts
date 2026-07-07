// ============================================================
// PreCali AI — Bot: logica de simulacion, perfilado y mensajes
// ============================================================
// Port fiel de `api/_lib/precali-whatsapp-bot.js` (CommonJS → TypeScript).
//
// Este modulo es el motor numerico y de mensajes del bot. Expone:
//   - coerceProfile / parseProfile: normalizacion del perfil financiero.
//   - simulate: corre la comparativa contra el catalogo de bancos.
//   - toInternalAmount / currencyConfig: conversion de moneda
//     (interna ↔ visible).
//   - buildReply / buildReplyFromProfile: armado de mensajes
//     deterministas (fallback del asesor de IA).
//
// FUENTE DE DATOS: el catalogo de bancos ahora vive en
// `@/data/bancos` (modulo tipado). En el legado se cargaba desde
// `data.js` con `vm.runInNewContext`; la transformacion
// (`sourceCondition`/`bankFromSource`) es identica, solo cambia el
// origen de los datos. Todos los bancos cargados son de Costa Rica.
//
// NOTA DE FIDELIDAD: la escala USD se mantiene en 540 (igual que el
// legado) para que la normalizacion de montos sea byte-identica.
// No se usa `@/data/config.TIPO_CAMBIO_USD` (510) aqui porque esa
// constante pertenece a otra capa (calculadora web) y cambiaria los
// numeros que el bot muestra.

import { BANCOS as BANCOS_SOURCE } from "@/data/bancos";
import type { Banco, CondicionPrestamo, RequisitoCategoria } from "@/types/precali";

// ---------- Tipos internos ----------

/** Perfil en UNIDADES INTERNAS (escaladas por la moneda). */
export interface InternalProfile {
  country: string;
  currency: string;
  product: string;
  income: number;
  debt: number;
  downPayment: number;
  assetValue: number;
  requestedYears: number;
}

/** Subset de perfil que usa money() para resolver pais/moneda. */
type MoneyProfile = { country: string; currency: string };

/** Condicion transformada desde `CondicionPrestamo` (data source). */
interface SourceCondition {
  rates: Record<string, number>;
  maxYears: number;
  ratio: number;
  minIncome: number;
  minAmount: number;
  finance: number | undefined;
  commission: number | undefined;
  url: string;
  guarantee: string;
  requirements: RequisitoCategoria[];
  currency: string;
  sourceCurrency: string;
  hasExplicitUsdRate: boolean;
  // El legado consultaba `base.terms` de forma defensiva; el data source
  // actual no expone terms, pero se conserva el campo opcional para
  // reproducir el mismo camino de codigo (siempre queda en null).
  terms?: Record<string, Partial<SourceCondition>>;
}

interface CatalogBank {
  id: string;
  name: string;
  country: string;
  source: string;
  dataQuality: string;
  web: string;
  personal: SourceCondition | null;
  vehiculo: SourceCondition | null;
  hipoteca: SourceCondition | null;
}

/** Condicion ya resuelta para un perfil (con tasa y minimos internos). */
export interface ResolvedCondition extends SourceCondition {
  rate: number;
}

/** Resultado individual de simulacion por banco. */
export interface SimResult {
  bank: string;
  rate: number;
  years: number;
  amount: number;
  payment: number;
  capacity: number;
  ratio: number;
  finance: number;
  minIncome: number;
  maxYears: number;
  requirements: RequisitoCategoria[];
}

/** Contexto de solicitante detectado del texto libre. */
export interface ApplicantContext {
  independent: boolean;
  coBorrower: boolean;
  debtConsolidator: boolean;
  blemishedCredit: boolean;
  highDownPayment: boolean;
  recentEmployment: boolean;
  informal: boolean;
  senior: boolean;
  noSavings: boolean;
  foreignResident: boolean;
  firstHome: boolean;
  age: number;
}

export interface BuildReplyInput {
  body?: string;
  numMedia?: number;
  defaultCountry?: string;
  defaultCurrency?: string;
}

export interface BuildReplyOptions {
  allowEstimateWithoutDownPayment?: boolean;
  prefixLines?: string[];
  followUpBody?: string;
  analysis?: ApplicantContext;
}

export interface CurrencyConfigResult {
  currency: string;
  locale: string;
  scale: number;
}

// ---------- Carga del catalogo de bancos ----------

function normalizeSourceCountry(country: unknown): string {
  return String(country || "cr").toUpperCase();
}

function sourceCurrencyForCountry(country: unknown): string {
  const nativeCurrencies: Record<string, string> = {
    CR: "CRC",
  };
  return nativeCurrencies[normalizeSourceCountry(country)] || "CRC";
}

function sourceCondition(product: CondicionPrestamo | null | undefined, country: string): SourceCondition | null {
  if (!product) return null;
  const nativeCurrency = sourceCurrencyForCountry(country);
  const nativeRate = Number(product.tasaCRC);
  const usdRate = product.tasaUSD === undefined ? undefined : Number(product.tasaUSD);
  const rates: Record<string, number> = {};
  if (Number.isFinite(nativeRate)) rates[nativeCurrency] = nativeRate;
  if (usdRate !== undefined && Number.isFinite(usdRate)) rates.USD = usdRate;

  return {
    rates,
    maxYears: Number(product.plazoMax) || 0,
    ratio: Number(product.ratioMax) || 0.35,
    minIncome: Number(product.ingresoMin) || 0,
    minAmount: Number(product.montoMin) || 0,
    finance: product.financia === undefined ? undefined : Number(product.financia),
    commission: product.comision === undefined ? undefined : Number(product.comision),
    url: product.url || "",
    guarantee: product.garantia || "",
    requirements: product.requisitos || [],
    currency: nativeCurrency,
    sourceCurrency: nativeCurrency,
    hasExplicitUsdRate: product.tasaUSD !== undefined,
  };
}

function bankFromSource(bank: Banco): CatalogBank {
  const country = normalizeSourceCountry(undefined);
  return {
    id: bank.id,
    name: bank.nombre,
    country,
    source: "data.js",
    dataQuality: bank.web ? "oficial/revisada" : "oficial/revisada",
    web: bank.web || "",
    personal: sourceCondition(bank.personal, country),
    vehiculo: sourceCondition(bank.vehiculo, country),
    hipoteca: sourceCondition(bank.hipoteca, country),
  };
}

function loadBankCatalog(): CatalogBank[] {
  return BANCOS_SOURCE.map(bankFromSource).filter((bank): bank is CatalogBank => Boolean(bank && bank.id && bank.name));
}

const BANKS: CatalogBank[] = loadBankCatalog();

const COUNTRY_CONFIG: Record<
  string,
  { name: string; defaultCurrency: string; currencies: Record<string, { locale: string; scale: number }> }
> = {
  CR: {
    name: "Costa Rica",
    defaultCurrency: "CRC",
    currencies: { CRC: { locale: "es-CR", scale: 1 }, USD: { locale: "en-US", scale: 540 } },
  },
};

const AMOUNT_PATTERN = /([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m)\b)?(?:\s+[\d.,]+\s*mil\b)?)/;

// ---------- Normalizacion de texto ----------

function normalize(text: unknown): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeAmountWords(text: string): string {
  const millions: Record<string, number> = {
    medio: 0.5,
    media: 0.5,
    un: 1,
    uno: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
  };
  const thousands: Record<string, number> = {
    cien: 100,
    ciento: 100,
    doscientos: 200,
    trescientos: 300,
    cuatrocientos: 400,
    quinientos: 500,
    seiscientos: 600,
    setecientos: 700,
    ochocientos: 800,
    novecientos: 900,
  };

  let result = text;
  for (const [word, value] of Object.entries(millions)) {
    result = result.replace(new RegExp("\\b" + word + "\\s+(?:millon|millones)\\b", "g"), value + " millones");
  }
  for (const [word, value] of Object.entries(thousands)) {
    result = result.replace(new RegExp("\\b" + word + "\\s+mil\\b", "g"), value + " mil");
  }
  return result;
}

function normalizeTypos(text: string): string {
  return text
    .replace(/\bmill\?n\b/g, "millon")
    .replace(/\bcr\?dito\b/g, "credito")
    .replace(/\bhipot\?ca\b/g, "hipoteca")
    .replace(/\bkiero\b/g, "quiero")
    .replace(/\bqiero\b/g, "quiero")
    .replace(/\bnesecito\b/g, "necesito")
    .replace(/\bnesesito\b/g, "necesito")
    .replace(/\bkasa\b/g, "casa")
    .replace(/\bveiculo\b/g, "vehiculo")
    .replace(/\bveiculos\b/g, "vehiculos")
    .replace(/\bdevo\b/g, "debo")
    .replace(/\bdevemos\b/g, "debemos")
    .replace(/\bpreztamo\b/g, "prestamo")
    .replace(/\bhipotekario\b/g, "hipotecario");
}

function normalizeInputText(body: unknown): string {
  return normalizeAmountWords(normalizeTypos(normalize(body)));
}

// ---------- Pais / moneda ----------

function detectCountry(text: string, defaultCountry: string | undefined): string {
  return "CR";
}

function defaultCurrencyForCountry(country: string): string {
  const config = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.CR;
  return config.defaultCurrency;
}

function detectCurrency(text: string, country: string, defaultCurrency: string | undefined): string {
  if (/\busd\b|dolares?|\$|\bverdes?\b/.test(text)) return "USD";
  if (/\bcrc\b|colones?\b/.test(text)) return "CRC";
  return defaultCurrency || defaultCurrencyForCountry(country);
}

export function currencyConfig(country: string | undefined, currency: string | undefined): CurrencyConfigResult {
  const countryConfig = COUNTRY_CONFIG[country || "CR"] || COUNTRY_CONFIG.CR;
  const selectedCurrency = currency || countryConfig.defaultCurrency;
  const config =
    countryConfig.currencies[selectedCurrency] ||
    countryConfig.currencies[countryConfig.defaultCurrency] ||
    COUNTRY_CONFIG.CR.currencies.CRC;
  return { currency: selectedCurrency, locale: config.locale, scale: config.scale };
}

export function money(value: unknown, countryOrProfile: string | MoneyProfile, currencyArg?: string): string {
  const country =
    typeof countryOrProfile === "object" ? countryOrProfile.country : (countryOrProfile as string);
  const currency =
    typeof countryOrProfile === "object" ? countryOrProfile.currency : (currencyArg as string);
  const config = currencyConfig(country || "CR", currency);
  const rounded = Math.max(0, Math.round((Number(value) || 0) / config.scale));
  return config.currency + " " + rounded.toLocaleString(config.locale);
}

export function toInternalAmount(value: unknown, country: string | undefined, currency: string | undefined): number {
  const config = currencyConfig(country || "CR", currency);
  return Math.max(0, Math.round((Number(value) || 0) * config.scale));
}

// ---------- Parseo de montos ----------

function parseAmount(raw: unknown): number {
  if (!raw) return 0;

  const text = String(raw).toLowerCase();
  const compound = text.match(/([\d.,]+)\s*(?:millones|millon|mill|m)\b\s+([\d.,]+)\s*mil\b/);
  if (compound) {
    const millions = Number(compound[1].replace(/[,\s]/g, ""));
    const thousands = Number(compound[2].replace(/[,\s]/g, ""));
    if (Number.isFinite(millions) && Number.isFinite(thousands)) {
      return millions * 1000000 + thousands * 1000;
    }
  }

  const compact = text.replace(/[,\s]/g, "");
  const number = Number(compact.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(number)) return 0;

  if (/millones|millon|mill|m\b/.test(compact)) return number * 1000000;
  if (/mil|k\b/.test(compact)) return number * 1000;
  return number;
}

function hasWrittenAmountCue(text: string): boolean {
  return (
    /\b\d[\d.,]*\b/.test(text) ||
    /\b(medio|media|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos)\s+(millones|millon|mill|mil|k|m)\b/.test(
      text,
    )
  );
}

function findAmount(text: string, patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseAmount(match[1]);
  }
  return 0;
}

function amountAfter(text: string, labels: string[], blockers: string[]): number {
  for (const label of labels) {
    const matcher = new RegExp("\\b(?:" + label + ")\\b", "g");
    let labelMatch: RegExpExecArray | null;

    while ((labelMatch = matcher.exec(text))) {
      const segment = text.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 60);
      const amountMatch = segment.match(AMOUNT_PATTERN);
      if (!amountMatch) continue;

      const beforeAmount = segment.slice(0, amountMatch.index || 0);
      const blocked = blockers.some((blocker) => new RegExp("\\b(?:" + blocker + ")\\b").test(beforeAmount));
      if (!blocked) return parseAmount(amountMatch[1]);
    }
  }

  return 0;
}

function detectProduct(text: string): string {
  if (/(casa|vivienda|hipoteca|hipotecario|apartamento|departamento|apto|depa|lote|terreno|propiedad|inmueble|condominio)/.test(text)) {
    return "hipoteca";
  }
  if (/(carro|auto|vehiculo|veiculo|vehicular|moto|prendario|pickup|pick up|camioneta)/.test(text)) {
    return "vehiculo";
  }
  return "personal";
}

function minimumAssetInput(currency: string): number {
  if (currency === "USD") return 1000;
  return 100000;
}

export function parseProfile(body: unknown, options?: { defaultCountry?: string; defaultCurrency?: string }): InternalProfile {
  const text = normalizeInputText(body);
  const product = detectProduct(text);
  const country = detectCountry(text, options && options.defaultCountry);
  const currency = detectCurrency(text, country, options && options.defaultCurrency);

  const income =
    amountAfter(
      text,
      ["gano", "gana", "ganamos", "ganan", "ingreso", "ingresos", "salario", "sueldo", "neto", "devengo", "me quedan libres", "me quedan", "me deja", "recibo", "brete"],
      ["debo", "deuda", "deudas", "pago", "pagos", "cuotas", "prima", "enganche", "aporte", "abono", "carro", "auto", "vehiculo", "veiculo", "casa", "vivienda", "monto", "valor"],
    ) ||
    findAmount(text, [
      /([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m))?)\s*(?:de ingreso|de salario|netos|mensuales)/,
      /gano[^\d]{0,20}\$?([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m))?)/,
      /gana[^\d]{0,20}\$?([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m))?)/,
    ]);

  const debt =
    /(no debo|sin deudas?|deuda cero)/.test(text)
      ? 0
      : amountAfter(
          text,
          ["debo", "debemos", "deuda", "deudas", "pago", "pagos", "cuotas", "rebajos", "me quitan", "me descuentan"],
          ["gano", "ingreso", "ingresos", "salario", "sueldo", "neto", "prima", "enganche", "aporte", "carro", "auto", "vehiculo", "veiculo", "casa", "vivienda", "monto", "valor", "tengo"],
        ) ||
        findAmount(text, [
          /([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m))?)\s*(?:de deuda|en deudas|de pagos|en pagos)/,
        ]);

  const downPayment =
    amountAfter(
      text,
      ["prima", "enganche", "aporte", "abono", "ahorrados", "ahorrado", "guardados", "guardado", "tengo ahorrados", "tengo ahorrado", "tengo guardados", "tengo guardado"],
      ["debo", "deuda", "deudas", "pago", "pagos", "cuotas", "gano", "ingreso", "salario", "sueldo", "monto", "valor"],
    ) ||
    findAmount(text, [
      /([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m))?)\s*(?:usd|dolares?|crc|colones?|mxn|pesos?|gtq|quetzales?|hnl|lempiras?|nio|cordobas?)?\s*(?:de\s+)?(?:prima|enganche|aporte|abono)\b/,
      /([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m))?)\s*(?:usd|dolares?|crc|colones?|mxn|pesos?|gtq|quetzales?|hnl|lempiras?|nio|cordobas?|verdes?)?\s*(?:ahorrad[oa]s?|guardad[oa]s?)\b/,
      /(?:ahorrad[oa]s?|guardad[oa]s?)\D{0,12}([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m))?)/,
    ]) ||
    0;

  const rawAssetValue =
    amountAfter(
      text,
      ["valor", "monto", "vale", "cuesta", "hipoteca", "hipotecario", "casa", "vivienda", "propiedad", "apartamento", "apto", "depa", "lote", "terreno", "carro", "auto", "vehiculo", "veiculo", "prestamo", "credito", "financiar", "financiamiento", "ocupo", "necesito", "nesesito"],
      ["gano", "ingreso", "ingresos", "salario", "sueldo", "neto", "devengo", "debo", "deuda", "deudas", "pago", "pagos", "cuotas", "prima", "enganche", "aporte", "tengo", "contamos", "tenemos"],
    );
  const assetValue = rawAssetValue >= minimumAssetInput(currency) ? rawAssetValue : 0;
  const downPaymentPercentMatch = text.match(/(\d{1,2})\s*%\s*(?:de\s+)?(?:prima|enganche|aporte|abono)/);
  const downPaymentFromPercent =
    downPaymentPercentMatch && assetValue > 0 ? Math.round(assetValue * (Number(downPaymentPercentMatch[1]) / 100)) : 0;

  const yearsMatch = text.match(/(\d{1,2})\s*(?:anos|ano|anios|plazo)/);
  const defaultYears = product === "hipoteca" ? 30 : product === "personal" ? 5 : 6;
  const requestedYears = yearsMatch ? Number(yearsMatch[1]) : defaultYears;

  return {
    country,
    currency,
    product,
    income: toInternalAmount(income, country, currency),
    debt: toInternalAmount(debt, country, currency),
    downPayment: toInternalAmount(downPayment || downPaymentFromPercent, country, currency),
    assetValue: toInternalAmount(assetValue, country, currency),
    requestedYears: Math.max(1, Math.min(requestedYears || defaultYears, 30)),
  };
}

export function coerceProfile(profile: Partial<InternalProfile> | null | undefined): InternalProfile {
  const source = profile || {};
  const country = COUNTRY_CONFIG[source.country || ""] ? (source.country as string) : "CR";
  const currency = currencyConfig(country, source.currency).currency;
  const product = ["personal", "vehiculo", "hipoteca"].includes(source.product || "") ? (source.product as string) : "personal";
  const defaultYears = product === "hipoteca" ? 30 : product === "personal" ? 5 : 6;

  return {
    country,
    currency,
    product,
    income: Math.max(0, Math.round(Number(source.income) || 0)),
    debt: Math.max(0, Math.round(Number(source.debt) || 0)),
    downPayment: Math.max(0, Math.round(Number(source.downPayment) || 0)),
    assetValue: Math.max(0, Math.round(Number(source.assetValue) || 0)),
    requestedYears: Math.max(1, Math.min(Math.round(Number(source.requestedYears) || defaultYears), 30)),
  };
}

// ---------- Matematica financiera ----------

function paymentFor(amount: number, annualRate: number, years: number): number {
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = annualRate / 100 / 12;
  if (!monthlyRate) return amount / months;
  return amount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
}

function amountForPayment(payment: number, annualRate: number, years: number): number {
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = annualRate / 100 / 12;
  if (!monthlyRate) return payment * months;
  return payment * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
}

function maxLoanFromDownPayment(downPayment: number, financeRatio: number): number {
  const ratio = Number(financeRatio) || 0;
  if (!downPayment || ratio <= 0 || ratio >= 1) return Number.MAX_SAFE_INTEGER;
  return (downPayment * ratio) / (1 - ratio);
}

function conditionForProfile(bank: CatalogBank, profile: InternalProfile): ResolvedCondition | null {
  if (bank.country && bank.country !== profile.country) return null;
  const base = bank[profile.product as "personal" | "vehiculo" | "hipoteca"];
  if (!base) return null;

  const bankCurrency = base.currency || defaultCurrencyForCountry(bank.country || profile.country);
  const currencyTerms =
    (base.terms && base.terms[profile.currency]) ? base.terms[profile.currency] : null;
  const merged: SourceCondition = currencyTerms ? { ...base, ...currencyTerms } : base;
  const conditionCurrency = merged.currency || bankCurrency;
  const rate = merged.rates
    ? Number(merged.rates[profile.currency] || merged.rates[bankCurrency] || (merged as SourceCondition & { rate?: number }).rate)
    : Number((merged as SourceCondition & { rate?: number }).rate);

  return {
    ...merged,
    rate,
    minIncome: toInternalAmount(merged.minIncome, bank.country || profile.country, conditionCurrency),
    minAmount: toInternalAmount(merged.minAmount, bank.country || profile.country, conditionCurrency),
  };
}

function productConditions(profile: InternalProfile): { bank: string; condition: ResolvedCondition }[] {
  return BANKS.map((bank) => ({ bank: bank.name, condition: conditionForProfile(bank, profile) }))
    .filter((item): item is { bank: string; condition: ResolvedCondition } => item.condition !== null && Number.isFinite(item.condition.rate));
}

export function simulate(profile: InternalProfile): SimResult[] {
  const results: SimResult[] = [];
  const netIncome = Math.max(0, profile.income - profile.debt);
  if (netIncome <= 0) return results;

  for (const bank of BANKS) {
    const condition = conditionForProfile(bank, profile);
    if (!condition) continue;

    const years = Math.min(profile.requestedYears, condition.maxYears);
    const ratio = Math.min(0.45, Number(condition.ratio) || 0.4);
    const finance = condition.finance || 0.85;
    const capacity = Math.max(0, profile.income * ratio - profile.debt);
    let amount = amountForPayment(capacity, condition.rate, years);

    if (profile.assetValue && profile.product !== "personal") {
      const financeLimit = profile.assetValue * finance;
      const requested = Math.max(0, profile.assetValue - profile.downPayment);
      amount = Math.min(amount, financeLimit, requested || financeLimit);
    } else if (profile.downPayment && profile.product !== "personal") {
      amount = Math.min(amount, maxLoanFromDownPayment(profile.downPayment, finance));
    }

    const qualifies = profile.income >= condition.minIncome && amount >= condition.minAmount && capacity > 0;
    if (!qualifies) continue;

    const payment = paymentFor(amount, condition.rate, years);
    results.push({
      bank: bank.name,
      rate: condition.rate,
      years,
      amount,
      payment,
      capacity,
      ratio,
      finance,
      minIncome: condition.minIncome,
      maxYears: condition.maxYears,
      requirements: condition.requirements || [],
    });
  }

  return results.sort((a, b) => a.rate - b.rate || b.amount - a.amount);
}

// ---------- Mensajes / helpers ----------

function missingProfileMessage(profile: InternalProfile): string {
  if (!profile.income) {
    return [
      "Necesito un dato para seguir.",
      "Tu ingreso mensual aproximado.",
      closingQuestion("¿Cuánto ganás al mes?"),
    ].join("\n");
  }

  if (profile.product !== "personal" && !profile.downPayment) {
    return [
      "Vamos bien.",
      "Ahora necesito tu prima aproximada.",
      closingQuestion("¿Con cuánto contás de prima?"),
    ].join("\n");
  }

  return "";
}

function likelyDocumentFollowUp(body: unknown): boolean {
  const text = normalizeInputText(body);
  const mentionsIncomeContext = /(ingreso|ingresos|salario|sueldo|neto|devengo|orden patronal|colilla|boleta|documento|pdf|archivo|adjunto|estos son mis ingresos|te mando|no debo|sin deudas?|deuda cero)/.test(text);
  const mentionsIntent = /(carro|auto|vehiculo|veiculo|casa|vivienda|hipoteca|credito|prestamo|financiar)/.test(text);
  return mentionsIncomeContext && mentionsIntent;
}

function productTitle(product: string): string {
  if (product === "hipoteca") return "credito hipotecario";
  if (product === "vehiculo") return "credito vehicular";
  return "credito personal";
}

function assetLabel(product: string): string {
  return product === "vehiculo" ? "vehiculo" : "bien";
}

function bold(value: string | number): string {
  return `*${value}*`;
}

function closingQuestion(question: string): string {
  return bold(question);
}

function hasDebtSignal(text: string): boolean {
  return /(debo|debemos|deuda|deudas|pago|pagos|cuotas|rebajos|no debo|sin deudas?|deuda cero|tarjetas?|quitan|descuentan)/.test(text);
}

function hasDownPaymentSignal(text: string): boolean {
  return /(prima|enganche|aporte|abono)/.test(text);
}

function detectRequestedBank(text: string): string {
  const normalizedText = normalize(text);
  const compactText = normalizedText.replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    bac: "BAC Credomatic",
    bn: "Banco Nacional",
  };

  for (const [alias, name] of Object.entries(aliases)) {
    if (new RegExp("\\b" + alias + "\\b").test(normalizedText)) return name;
  }

  const selected = BANKS.find((bank) => {
    const bankName = normalize(bank.name || "");
    const compactName = bankName.replace(/[^a-z0-9]/g, "");
    const compactId = normalize(bank.id || "").replace(/[^a-z0-9]/g, "");
    return (
      (Boolean(bankName) && normalizedText.includes(bankName)) ||
      (Boolean(compactName) && compactText.includes(compactName)) ||
      (Boolean(compactId) && compactText.includes(compactId))
    );
  });

  return selected ? selected.name : "";
}

function applyCommandForBank(bankName: string): string {
  return `Aplicar a ${bankName}`;
}

function detectApplicantContext(body: unknown, profile: InternalProfile): ApplicantContext {
  const text = normalizeInputText(body);
  const ageMatch = text.match(/\b(\d{2})\s*anos?\b/);
  const age = ageMatch ? Number(ageMatch[1]) : 0;
  const firstHome = /(primer hogar|primer departamento|primera casa|novio y yo|mi novio y yo|pareja|juntos ganamos|co-propietarios|co deudor)/.test(text);

  return {
    independent: /(independiente|freelance|freelancer|programador|trabajo remoto|facturas|estados de cuenta|sin recibos)/.test(text),
    coBorrower: /(novio y yo|mi novio y yo|pareja|juntos ganamos|co-propietarios|co deudor|mancomunad)/.test(text),
    debtConsolidator: /(tarjetas?|al tope|prestamo personal|capacidad ahogada|consolid)/.test(text) || profile.debt > profile.income * 0.3,
    blemishedCredit: /(buro|manchas?|atras|atrasado|mala racha|finiquito|historial)/.test(text),
    highDownPayment: profile.assetValue > 0 && profile.downPayment / Math.max(profile.assetValue, 1) >= 0.35,
    recentEmployment: /(apenas|reci[eé]n|periodo de prueba|entre a trabajar)/.test(text) || /\b([1-5])\s*meses\b/.test(text),
    informal: /(tienda|abarrotes|efectivo|no declaro|negocio propio|sector informal|comercio local)/.test(text),
    senior: /pensionad/.test(text) || age >= 60,
    noSavings: /(no tengo nada ahorrado|cero enganche|100%|sin prima|sin ahorros)/.test(text),
    foreignResident: /(ciudadano estadounidense|residencia legal|extranjero|expatriado|residente reciente)/.test(text),
    firstHome,
    age,
  };
}

function buildDiagnosticIntro(analysis: ApplicantContext): string {
  if (analysis.independent) return "Entiendo perfectamente. Como independiente, lo clave es demostrar estabilidad.";
  if (analysis.coBorrower) return "Tiene sentido. Uniendo ingresos, la foto mejora bastante.";
  if (analysis.debtConsolidator) return "Entiendo el cuello de botella. Tus deudas te estan comiendo capacidad.";
  if (analysis.blemishedCredit) return "Entiendo la preocupacion. Una mancha pagada no pesa igual que una deuda activa.";
  if (analysis.highDownPayment) return "Tu prima alta juega mucho a tu favor.";
  if (analysis.recentEmployment) return "Vas bien, pero la antiguedad laboral pesa bastante.";
  if (analysis.informal) return "Entiendo tu caso. El reto es volver trazable ese ingreso.";
  if (analysis.senior) return "Claro. La edad pesa mas por el seguro que por tu ingreso.";
  if (analysis.noSavings) return "Te entiendo. Sin prima, el mercado se pone mas cerrado.";
  if (analysis.foreignResident) return "Si, hay ruta. La residencia y el ingreso externo cambian el juego.";
  if (analysis.firstHome) return "Buen momento para ordenar la compra del primer hogar.";
  return "";
}

function buildProfileAdvice(profile: InternalProfile, analysis: ApplicantContext, results: SimResult[]): string[] {
  const lines: string[] = [];

  if (analysis.independent) {
    lines.push(`1. Ordena de ${bold("6 a 12 meses")} de estados de cuenta y facturas.`);
    lines.push("2. Te conviene una ruta con banca flexible o cooperativa.");
  } else if (analysis.coBorrower) {
    lines.push("1. Si van juntos, podemos sumar ingresos mancomunados.");
    lines.push("2. Conviene cuidar ambas deudas antes de aplicar.");
  } else if (analysis.debtConsolidator) {
    lines.push(`1. Tus deudas actuales consumen ${bold(money(profile.debt, profile))} por mes.`);
    lines.push("2. Podemos explorar una compra con consolidacion para liberar cuota.");
  } else if (analysis.blemishedCredit) {
    lines.push("1. Si la deuda ya esta pagada, una carta de finiquito ayuda mucho.");
    lines.push("2. Vale la pena explorar cooperativas o banca de segunda oportunidad.");
  } else if (analysis.highDownPayment) {
    lines.push("1. Tu prima baja mucho el riesgo para el banco.");
    lines.push("2. Eso ayuda a defender mejor tasa y aprobacion.");
  } else if (analysis.recentEmployment) {
    lines.push("1. Esperar a cumplir 6 meses te abre mas puertas.");
    lines.push("2. Si venis del mismo sector, podemos defender continuidad laboral.");
  } else if (analysis.informal) {
    lines.push("1. Empeza a bancarizar ventas por al menos 6 meses.");
    lines.push("2. Tambien podemos revisar microfinancieras o visita de negocio.");
  } else if (analysis.senior) {
    lines.push("1. Lo normal es acortar plazo o sumar un co-deudor joven.");
    lines.push("2. La clave es cuadrar con la regla edad mas plazo.");
  } else if (analysis.noSavings) {
    const minimumDown = profile.assetValue ? Math.round(profile.assetValue * 0.1) : 0;
    if (minimumDown > 0) lines.push(`1. Para empezar, apunta a una prima minima de ${bold(money(minimumDown, profile))}.`);
    lines.push("2. Sin prima, casi ningun banco financia el 100%.");
  } else if (analysis.foreignResident) {
    lines.push("1. Hay bancos que manejan residentes con ingresos externos.");
    lines.push("2. Te van a pedir residencia, origen de fondos y estados de cuenta.");
  } else if (analysis.firstHome) {
    lines.push("1. Vale la pena priorizar plazo largo y prima baja.");
    lines.push("2. Tambien podemos probar escenario con co-propietario.");
  } else if (results.length) {
    lines.push("1. La tasa mas baja no siempre es la mejor si aprieta la cuota.");
    lines.push("2. Conviene elegir la opcion que deje aire a tu presupuesto.");
  }

  return lines.slice(0, 2);
}

function defaultNextQuestion(analysis: ApplicantContext): string {
  if (analysis.debtConsolidator) return "Queres que te deje la mejor ruta para aplicar despues de ordenar tus deudas?";
  if (analysis.independent) return "Queres que te prepare la aplicacion digital con estados de cuenta?";
  if (analysis.coBorrower) return "Queres que preparemos la aplicacion digital con ambos ingresos?";
  return "Con cual banco queres iniciar la aplicacion digital?";
}

interface DownPaymentRange {
  min: number;
  max: number;
  asset: string;
  market: string;
}

function recommendedDownPaymentRange(product: string): DownPaymentRange | null {
  if (product === "vehiculo") return { min: 0.1, max: 0.2, asset: "vehiculo", market: "vehiculos" };
  if (product === "hipoteca") return { min: 0.1, max: 0.2, asset: "bien", market: "vivienda" };
  return null;
}

function lowDownPaymentInsight(profile: InternalProfile): string {
  if (!profile.assetValue || !profile.downPayment || profile.product === "personal") return "";
  const range = recommendedDownPaymentRange(profile.product);
  if (!range) return "";
  const share = profile.downPayment / Math.max(profile.assetValue, 1);
  if (share >= range.min) return "";
  const percent = Math.max(1, Math.round(share * 100));
  return `Tu prima cubre cerca de ${bold(percent + "%")} del ${range.asset}. Lo usual es ver entre ${bold(Math.round(range.min * 100) + "%")} y ${bold(Math.round(range.max * 100) + "%")} en ${range.market}.`;
}

function needsDownPaymentRealityCheck(profile: InternalProfile): boolean {
  return (
    profile.product === "hipoteca" &&
    profile.assetValue > 0 &&
    profile.downPayment > 0 &&
    profile.downPayment / Math.max(profile.assetValue, 1) < 0.05
  );
}

export function recommendedOption(results: SimResult[], profile: InternalProfile): SimResult | null {
  if (!results.length) return null;
  const netIncome = Math.max(1, profile.income - profile.debt);
  const affordable = results
    .map((result) => ({ result, burden: result.payment / netIncome }))
    .filter((item) => item.burden <= 0.35)
    .sort((a, b) => a.burden - b.burden || a.result.rate - b.result.rate);
  if (affordable.length) return affordable[0].result;
  return results.slice().sort((a, b) => a.payment - b.payment || a.rate - b.rate)[0];
}

function visibleResults(results: SimResult[], profile: InternalProfile, limit = 3): SimResult[] {
  const recommended = recommendedOption(results, profile);
  const selected: SimResult[] = [];
  if (recommended) selected.push(recommended);
  results.forEach((result) => {
    if (selected.length >= limit) return;
    if (!selected.some((item) => item.bank === result.bank)) selected.push(result);
  });
  return selected;
}

function requiredDownPaymentForResult(result: SimResult | null, profile: InternalProfile): number {
  if (!result || !profile || profile.product === "personal") return 0;
  if (profile.assetValue) return Math.max(0, profile.assetValue - result.amount);
  if (profile.downPayment) return profile.downPayment;
  const finance = Number(result.finance) || 0.85;
  if (finance <= 0 || finance >= 1) return 0;
  return Math.max(0, result.amount * ((1 - finance) / finance));
}

function mentionedResult(results: SimResult[], text: string): SimResult | null {
  const normalizedText = normalize(text);
  const compactText = normalizedText.replace(/[^a-z0-9]/g, "");
  return (
    results.find((result) => {
      const compactBank = normalize(result.bank).replace(/[^a-z0-9]/g, "");
      if (compactBank && compactText.includes(compactBank)) return true;
      if (/davi/.test(compactText) && /davi/.test(compactBank)) return true;
      if (/\bbac\b/.test(normalizedText) && /bac/.test(compactBank)) return true;
      if (/\bbn\b/.test(normalizedText) && /banconacional/.test(compactBank)) return true;
      return false;
    }) || null
  );
}

function buildOriginacionReply(body: unknown, profile: InternalProfile, results: SimResult[]): string {
  const text = normalizeInputText(body);
  const choice = Array.isArray(results) && results.length ? recommendedOption(results, profile) : null;
  const bankText = choice ? ` para ${bold(choice.bank)}` : "";

  if (/(bur[oó]|buro|score|mancha|historial|soft pull|hard pull|consulta|estudio crediticio|me baja|me afecta)/.test(text)) {
    return [
      "Te entiendo perfectamente; haces bien en cuidar tu historial.",
      `PreCali arranca con una ${bold("consulta blanda / Soft Pull")} para perfilar opciones sin ir banco por banco.`,
      `El ${bold("Hard Pull")} del banco se autoriza aparte solo si decidis aplicar${bankText}.`,
      closingQuestion("Me decis tu ingreso neto mensual para empezar sin afectar tu proceso?"),
    ].join("\n");
  }

  if (/(seguridad|datos|documentos|privacidad|orden patronal|colilla|boleta|cedula|informacion)/.test(text) && /(seguridad|datos|documentos|privacidad|manejan|guardan|envian|protegen)/.test(text)) {
    return [
      "Si, lo manejamos con mucho cuidado.",
      "Usamos HTTPS, acceso restringido y servidores con estandares reconocidos.",
      "Tus datos se usan para perfilarte y preparar la aplicacion al banco que elijas.",
      "Antes de enviar nada al banco, te pedimos consentimiento por este chat.",
      closingQuestion("Queres que avancemos con la validacion inicial?"),
    ].join("\n");
  }

  if (/(cuanto cuesta|costo|cobran|cobro|gratis|gratuito|comision|tengo que pagar|hay que pagar|pagar por precali|pagarles)/.test(text)) {
    return [
      `Para vos, PreCali es ${bold("100% gratuito")}.`,
      "No te cobramos por comparar ni por iniciar el tramite digital.",
      "Nuestro modelo se sostiene con entidades o aliados cuando se concreta una oportunidad.",
      closingQuestion("Queres que sigamos con la aplicacion digital?"),
    ].join("\n");
  }

  if (/(como funciona|que hacen|que es precali|ustedes que|por que aplicar|filas|papeleo|digital)/.test(text)) {
    return [
      "PreCali es el puente digital entre vos y los bancos.",
      "Perfilamos tu caso, te mostramos opciones y enviamos el expediente al banco elegido.",
      "La idea es evitar filas y papeleo innecesario.",
      closingQuestion(choice ? `Queres que iniciemos con ${choice.bank}?` : "Queres iniciar tu precalificacion ahora?"),
    ].join("\n");
  }

  return "";
}

function compactRequirements(result: SimResult | null): string[] {
  const requirements = Array.isArray(result && result.requirements) ? result!.requirements : [];
  const items: string[] = [];
  for (const group of requirements) {
    for (const item of group.items || []) {
      if (items.length >= 4) break;
      items.push(item);
    }
    if (items.length >= 4) break;
  }
  if (items.length) return items;
  return [
    "identificacion vigente",
    "comprobante de ingresos",
    "autorizacion para estudio crediticio",
    "documento del bien o proforma si aplica",
  ];
}

function buildFollowUpReply(profile: InternalProfile, results: SimResult[], analysis: ApplicantContext, body: unknown): string {
  const text = normalizeInputText(body);
  const best = results[0] || null;
  const originacionReply = buildOriginacionReply(body, profile, results);
  if (originacionReply) return originacionReply;

  if (/^(si|sí|ok|dale|de acuerdo|correcto|autorizo|acepto|confirmo|doy permiso)\.?$/.test(text) || /\b(autorizo|acepto|confirmo|doy permiso)\b/.test(text)) {
    const choice = mentionedResult(results, text) || recommendedOption(results, profile) || best;
    return [
      "Perfecto, queda registrada tu autorizacion inicial.",
      choice ? `Voy a preparar tu perfil para ${bold(choice.bank)}.` : "Voy a preparar tu perfil con la opcion mas sana.",
      "Para dejarlo listo, necesito confirmar los datos finales del expediente.",
      closingQuestion(profile.product === "vehiculo" ? "Me pasas valor, ano y modelo del carro?" : "Me pasas valor de la propiedad y ubicacion?"),
    ].join("\n");
  }

  if (/(requisitos?|documentos?|que pide|qu[eé] pide|ocupo|necesito llevar|necesito presentar)/.test(text) && results.length) {
    const choice = mentionedResult(results, text) || recommendedOption(results, profile) || best;
    const items = compactRequirements(choice);
    return [
      choice ? `Para ${bold(choice.bank)}, normalmente revisamos esto primero:` : "Normalmente revisamos esto primero:",
      items.map((item) => `• ${item}`).join("\n"),
      "Antes de enviarlo al banco, te pedimos consentimiento por este chat.",
      closingQuestion(choice ? `Queres que preparemos tu expediente para ${choice.bank}?` : "Queres que preparemos tu expediente digital?"),
    ].join("\n");
  }

  if (/(sucursal|ir al banco|ir a banco|filas?|papeleo|que hago ahora|siguiente paso|ahora que)/.test(text) && results.length) {
    const choice = mentionedResult(results, text) || recommendedOption(results, profile) || best;
    return [
      "Para nada, no hace falta empezar con filas.",
      "PreCali prepara tu perfil y el expediente de forma digital.",
      choice ? `Si queres avanzar con ${bold(choice.bank)}, responde ${bold(`Aplicar a ${choice.bank}`)}.` : "Si queres avanzar, responde con el banco que te interesa.",
      closingQuestion("Le damos viaje?"),
    ].join("\n");
  }

  if (/(hard pull|consulta dura|revision dura|bur[oó]|buro)/.test(text) && !/(soft pull|consulta suave)/.test(text)) {
    return [
      "Buena duda.",
      "Un hard pull es una revision formal de tu historial.",
      "Puede mover un poco tu buro por un tiempo corto.",
      closingQuestion("Queres que primero prioricemos bancos que arranquen con validacion suave?"),
    ].join("\n");
  }

  if (/(soft pull|consulta suave|validacion suave)/.test(text)) {
    return [
      "Si, podemos ir por esa ruta primero.",
      `Mantengo tu ingreso de ${bold(money(profile.income, profile))} y ${profile.downPayment ? "tu prima de " + bold(money(profile.downPayment, profile)) : "tu perfil actual"} para esa comparacion.`,
      "La idea es precalificar primero y dejar la revision formal para despues.",
      closingQuestion("Queres que te deje primero el escenario mas cuidadoso con tu buro?"),
    ].join("\n");
  }

  if (/(incluye|trae|lleva).{0,18}(seguros?|seguro|poliza|marchamo|gastos)/.test(text)) {
    return [
      "Es una muy buena pregunta.",
      best
        ? `La cuota de ${bold(money(best.payment, profile))} es una base estimada del credito.`
        : "La cuota que te mostre es una base estimada del credito.",
      "Todavia no estoy metiendo seguros, comisiones ni gastos finales del banco.",
      closingQuestion(profile.product === "vehiculo" ? "Queres que la deje mas conservadora sumando seguros estimados?" : "Queres que la deje mas conservadora sumando seguros y gastos estimados?"),
    ].join("\n");
  }

  if (/(puedo|se puede|podria).{0,18}(bajar|subir|cambiar).{0,18}(anos|ano|anios|plazo)|\bmas corto\b|\bmas largo\b/.test(text) && !/(\d{1,2})\s*(anos|ano|anios)/.test(text)) {
    const ranges = profile.product === "hipoteca" ? "20, 25 o 30 anos" : profile.product === "vehiculo" ? "5, 6 o 7 anos" : "3, 4 o 5 anos";
    return [
      "Claro que si.",
      "Si bajas el plazo, la cuota sube.",
      "Si lo alargas, la cuota baja pero pagas mas intereses.",
      closingQuestion(`Queres que te lo recalcule a ${ranges}?`),
    ].join("\n");
  }

  if (/\b(tanto|ese monto|ese maximo|esa prima|con esa prima|me prestarian tanto|te parece mucho|demasiado)\b/.test(text)) {
    const lines = [
      "Es una excelente pregunta.",
      `Ese techo se basa en tu ingreso de ${bold(money(profile.income, profile))} y deudas de ${bold(money(profile.debt, profile))}.`,
    ];

    if (profile.assetValue && profile.downPayment) {
      lines.push(lowDownPaymentInsight(profile) || `Con la prima de ${bold(money(profile.downPayment, profile))}, el banco revisa si el porcentaje que aportas calza con su politica.`);
    } else if (profile.downPayment && profile.product !== "personal") {
      lines.push(`Con una prima de ${bold(money(profile.downPayment, profile))}, tambien pesa cuanto porcentaje del ${profile.product === "vehiculo" ? "carro" : "bien"} estas poniendo.`);
      lines.push(
        profile.product === "vehiculo"
          ? `En vehiculos, lo normal es ver entre ${bold("10%")} y ${bold("20%")} de prima.`
          : `En vivienda, muchos bancos se sienten mas comodos desde ${bold("10%")} de prima hacia arriba.`,
      );
    }

    lines.push(
      closingQuestion(
        profile.product === "vehiculo"
          ? "Tenes visto algun modelo o precio de carro para calcular la prima exacta que te pediria el banco?"
          : "Tenes visto el valor de la casa para calcular la prima exacta y la cuota mas realista?",
      ),
    );
    return lines.join("\n");
  }

  if (/(cual|cu[aá]l).{0,20}(me conviene|conviene mas|conviene más|a ojos cerrados|mejor)\b/.test(text) && results.length) {
    const choice = recommendedOption(results, profile);
    const burden = choice ? Math.round((choice.payment / Math.max(1, profile.income - profile.debt)) * 100) : 0;
    return [
      "Yo no me iria solo por la tasa.",
      choice
        ? `${bold(choice.bank)} se ve mas sano porque deja una cuota cerca de ${bold(burden + "%")} de tu ingreso neto.`
        : "Prefiero la opcion que mejor cuide tu cuota mensual.",
      "Eso normalmente pesa mas que ahorrar unas decimas en la tasa si el presupuesto queda apretado.",
      closingQuestion(choice ? `Queres iniciar la aplicacion digital con ${choice.bank}?` : "Queres iniciar la aplicacion digital con la opcion mas sana?"),
    ].join("\n");
  }

  if (/(deberia|debo|conviene|recomiendas|recomendarias|vale la pena|seria bueno|seria mejor).{0,50}aplicar|aplicar a/.test(text) && results.length) {
    const choice = mentionedResult(results, text) || recommendedOption(results, profile) || best;
    const burden = choice ? Math.round((choice.payment / Math.max(1, profile.income - profile.debt)) * 100) : 0;
    const lines = [
      choice
        ? `Si, ${bold(choice.bank)} tiene sentido para explorar primero.`
        : "Si, tiene sentido avanzar con la opcion mas sana.",
      choice
        ? `La cuota estimada queda cerca de ${bold(burden + "%")} de tu ingreso neto.`
        : "Pero antes quiero cuidar que la cuota no te apriete.",
    ];

    if (profile.product === "vehiculo" && !profile.assetValue) {
      lines.push("Antes de aplicar formalmente, confirmaria valor, ano y modelo del carro.");
    } else if (profile.product === "hipoteca" && !profile.assetValue) {
      lines.push("Antes de aplicar formalmente, confirmaria el valor real de la propiedad.");
    }

    lines.push("Esto sigue siendo precalificacion, no aprobacion final.");
    lines.push(
      closingQuestion(
        choice
          ? `Nos autorizas iniciar el estudio crediticio y preparar tu aplicacion para ${choice.bank}?`
          : "Nos autorizas iniciar el estudio crediticio y preparar tu aplicacion?",
      ),
    );
    return lines.join("\n");
  }

  if (/\b(aplicar|solicitar|me interesa|quiero esa|enviar|mandar)\b/.test(text) && results.length) {
    const choice = mentionedResult(results, text) || recommendedOption(results, profile) || best;
    return [
      choice ? `Perfecto. Seguimos con ${bold(choice.bank)}.` : "Perfecto. Seguimos con la opcion mas sana.",
      `Primero necesitamos tu autorizacion para el ${bold("estudio crediticio inicial")}.`,
      "Con eso perfilamos tu caso y preparamos el expediente digital.",
      "La revision formal del banco se autoriza aparte antes de enviarlo.",
      closingQuestion("Nos das esa autorizacion para avanzar?"),
    ].join("\n");
  }

  return "";
}

function buildSpecialistStepMessage(profile: InternalProfile, analysis: ApplicantContext, text: string): string {
  if (analysis.blemishedCredit && !profile.income) {
    return [
      "Entiendo la preocupacion. Una mancha pagada no pesa igual que una deuda activa.",
      "Con finiquito y buen ingreso, todavia hay ruta.",
      closingQuestion("¿Cuanto ganas al mes hoy?"),
    ].join("\n");
  }

  if (analysis.foreignResident && !profile.income) {
    return [
      "Si hay ruta para residente con ingresos externos.",
      "Lo clave es mostrar residencia y estados de cuenta en dolares.",
      closingQuestion("¿Cuanto ganas al mes y desde hace cuanto?"),
    ].join("\n");
  }

  if (analysis.recentEmployment && profile.income) {
    return [
      "Entiendo la urgencia. El punto delicado es tu antiguedad.",
      "Muchos bancos piden minimo 6 meses o continuidad comprobable.",
      closingQuestion("¿Venias de un trabajo similar antes de este empleo?"),
    ].join("\n");
  }

  if (analysis.senior && profile.income) {
    return [
      "Tu ingreso estable ayuda mucho.",
      "Lo que manda aqui es la regla edad mas plazo del seguro.",
      closingQuestion("¿Te sirve ver el escenario a 10 o 12 anos, o con co-deudor?"),
    ].join("\n");
  }

  if (analysis.noSavings && profile.income) {
    return [
      "Te entiendo. El mercado casi nunca financia el 100%.",
      "Lo sano es apuntar al menos a 10% de prima mas gastos.",
      closingQuestion("¿Cuanto podrias ahorrar para empezar la prima?"),
    ].join("\n");
  }

  if (analysis.highDownPayment && profile.income && !hasDebtSignal(text)) {
    return [
      "Tu prima alta baja mucho el riesgo para el banco.",
      "Eso ayuda a defender mejor aprobacion y tasa.",
      closingQuestion("¿Tenes hoy alguna deuda mensual reportable?"),
    ].join("\n");
  }

  if (analysis.independent && profile.income && !hasDebtSignal(text)) {
    return [
      "Entiendo perfectamente. Como independiente, lo clave es demostrar estabilidad.",
      "Con 6 a 12 meses de estados de cuenta ya podemos perfilar mejor.",
      closingQuestion("¿Pagas hoy alguna deuda mensual?"),
    ].join("\n");
  }

  if (analysis.coBorrower && profile.income && !hasDebtSignal(text)) {
    return [
      "Si, se pueden sumar ingresos mancomunados.",
      "Eso mejora bastante la capacidad de compra.",
      closingQuestion("¿Cuanto pagan en deudas entre los dos?"),
    ].join("\n");
  }

  if (analysis.debtConsolidator && profile.income && !profile.debt) {
    return [
      `Excelente. Con un ingreso de ${bold(money(profile.income, profile))} ya tenemos buena base.`,
      "Para afinar perfecto, necesito la cuota mensual de esa tarjeta.",
      closingQuestion("Y de paso, tenes algo ahorrado para la prima?"),
    ].join("\n");
  }

  if (analysis.debtConsolidator && profile.income) {
    return [
      "Entiendo el cuello de botella. Tus deudas estan ahogando la cuota.",
      "Podemos mirar una compra con consolidacion para liberar aire.",
      closingQuestion("¿Tenes alguna prima disponible para arrancar?"),
    ].join("\n");
  }

  if (analysis.informal && profile.income && !hasDebtSignal(text)) {
    return [
      "Entiendo tu caso. El reto es volver trazable ese ingreso.",
      "Bancarizar ventas por 6 meses te abre muchas mas puertas.",
      closingQuestion("¿Hoy pagas alguna deuda mensual o todo esta libre?"),
    ].join("\n");
  }

  return "";
}

function affordabilityGuidance(profile: InternalProfile): string {
  if (profile.product === "personal") return "";

  const conditions = productConditions(profile);
  if (!conditions.length) return "";

  const requestedAmount = profile.assetValue ? Math.max(0, profile.assetValue - profile.downPayment) : 0;
  let best: { bank: string; extraIncome: number; extraDownPayment: number } | null = null;

  for (const item of conditions) {
    const years = Math.min(profile.requestedYears, item.condition.maxYears);
    const targetAmount = requestedAmount || item.condition.minAmount;
    const neededPayment = paymentFor(targetAmount, item.condition.rate, years);
    const neededIncome = Math.ceil((neededPayment + profile.debt) / item.condition.ratio);
    const extraIncome = Math.max(0, neededIncome - profile.income);
    const financeLimit = profile.assetValue ? profile.assetValue * (item.condition.finance || 0.85) : 0;
    const capacity = Math.max(0, profile.income * item.condition.ratio - profile.debt);
    const capacityAmount = amountForPayment(capacity, item.condition.rate, years);
    const extraDownPayment = profile.assetValue
      ? Math.max(0, requestedAmount - Math.min(capacityAmount, financeLimit))
      : 0;

    if (!best || extraIncome < best.extraIncome) {
      best = { bank: item.bank, extraIncome, extraDownPayment };
    }
  }

  if (!best) return "";
  if (best.extraIncome > 0 && best.extraDownPayment > 0) {
    return `Te ayudaría subir ingresos en ${bold(money(best.extraIncome, profile))} o la prima en ${bold(money(best.extraDownPayment, profile))}.`;
  }
  if (best.extraIncome > 0) {
    return `Te ayudaría subir ingresos en ${bold(money(best.extraIncome, profile))}.`;
  }
  if (best.extraDownPayment > 0) {
    return `Te ayudaría subir la prima en ${bold(money(best.extraDownPayment, profile))}.`;
  }
  return "";
}

function optimizationIdeas(profile: InternalProfile): string[] {
  const conditions = productConditions(profile);
  if (!conditions.length) return [];

  const targetLoan = profile.assetValue ? Math.max(0, profile.assetValue - profile.downPayment) : 0;
  const bestRate = conditions.slice().sort((a, b) => a.condition.rate - b.condition.rate)[0];
  const ideas: string[] = [];

  if (targetLoan > 0 && bestRate) {
    const years = Math.min(profile.requestedYears, bestRate.condition.maxYears);
    const ratio = Math.min(0.45, Number(bestRate.condition.ratio) || 0.4);
    const currentCapacity = Math.max(0, profile.income * ratio - profile.debt);
    const currentLoan = amountForPayment(currentCapacity, bestRate.condition.rate, years);
    const financeLimit = profile.assetValue * (bestRate.condition.finance || 0.85);
    const reachableLoan = Math.min(currentLoan, financeLimit);
    const extraDownPayment = Math.max(0, targetLoan - reachableLoan);
    if (extraDownPayment > 0) {
      ideas.push(`1. Si subis la prima en ${bold(money(extraDownPayment, profile))}, te acercas a ${bold(bestRate.bank)}.`);
    }

    if (profile.debt > 0) {
      const debtFreeCapacity = Math.max(0, profile.income * ratio);
      const debtFreeLoan = Math.min(amountForPayment(debtFreeCapacity, bestRate.condition.rate, years), financeLimit || Number.MAX_SAFE_INTEGER);
      const uplift = currentLoan > 0 ? Math.round(((debtFreeLoan - currentLoan) / currentLoan) * 100) : 0;
      if (currentLoan <= 0 && debtFreeLoan > 0) {
        ideas.push(`2. Si unificas deudas por ${bold(money(profile.debt, profile))}, vuelves a tener capacidad para aplicar.`);
      } else if (uplift > 0) {
        ideas.push(`2. Si unificas deudas por ${bold(money(profile.debt, profile))}, tu capacidad sube cerca de ${bold(uplift + "%")}.`);
      }
    }

    if (profile.requestedYears < bestRate.condition.maxYears) {
      const extendedYears = bestRate.condition.maxYears;
      const lowerPayment = paymentFor(Math.min(targetLoan, financeLimit || targetLoan), bestRate.condition.rate, extendedYears);
      ideas.push(`3. Si amplias el plazo a ${bold(extendedYears + " anos")}, tu cuota baja a ${bold(money(lowerPayment, profile))}.`);
    }
  }

  return ideas.slice(0, 3);
}

function documentFollowUpMessage(profile: InternalProfile): string {
  const hints: string[] = [];
  if (profile.product === "vehiculo") hints.push("buscás carro");
  if (profile.product === "hipoteca") hints.push("buscás casa");
  if (profile.assetValue) hints.push("un valor meta de " + bold(money(profile.assetValue, profile)));
  if (profile.downPayment) hints.push("una prima de " + bold(money(profile.downPayment, profile)));
  if (profile.debt) hints.push("deudas por " + bold(money(profile.debt, profile)));

  const secondLine = hints.length ? "Ya tengo presente que " + hints.join(", ") + "." : "Ya tengo claro si buscás casa o carro.";

  return [
    "Perfecto. Mandame la orden patronal o PDF.",
    secondLine,
    closingQuestion("¿Me lo enviás ahora?"),
  ].join("\n");
}

function formatResults(profile: InternalProfile, results: SimResult[], analysis: ApplicantContext | null): string {
  const hasAssetContext = profile.product !== "personal";
  const hasDownPaymentOnly = hasAssetContext && profile.downPayment > 0 && !profile.assetValue;
  const netIncome = Math.max(0, profile.income - profile.debt);
  const targetLoan = profile.assetValue ? Math.max(0, profile.assetValue - profile.downPayment) : 0;
  const intro = analysis ? buildDiagnosticIntro(analysis) : "";
  const realityCheck = needsDownPaymentRealityCheck(profile);
  const lines: (string | null)[] = [
    intro || null,
    bold("Precalificacion estimada"),
    "Producto: " + bold(productTitle(profile.product)),
    "Ingreso: " + bold(money(profile.income, profile)),
    "Deudas: " + bold(money(profile.debt, profile)),
    "Ingreso neto: " + bold(money(netIncome, profile)),
    profile.assetValue
      ? "Valor de referencia: " + bold(money(profile.assetValue, profile)) + (profile.downPayment ? " | Prima: " + bold(money(profile.downPayment, profile)) : "")
      : hasDownPaymentOnly
        ? "Sin valor del bien. Prima detectada: " + bold(money(profile.downPayment, profile)) + "."
        : "Sin valor del bien: estimo el monto maximo segun capacidad de pago.",
    !realityCheck ? lowDownPaymentInsight(profile) || null : null,
    hasDownPaymentOnly ? "Tomo en cuenta tu capacidad y el porcentaje maximo que financia cada banco." : null,
    hasDownPaymentOnly ? "Aqui el monto es " + bold("prestamo maximo") + ", no el valor total del bien." : null,
    "",
  ];

  if (netIncome <= 0) {
    lines.push("No puedo simular con ingreso neto en cero.");
    lines.push("Primero hay que bajar deudas o subir ingreso.");
    lines.push(closingQuestion("¿Te gustaria que recalcule reduciendo tus deudas actuales o prefieres ver opciones con una prima mayor?"));
    return lines.join("\n");
  }

  if (realityCheck) {
    const minPrime = Math.round(profile.assetValue * 0.1);
    const comfortablePrime = Math.round(profile.assetValue * 0.2);
    lines.push("Antes de simular fino, te aterrizo algo importante.");
    lines.push(lowDownPaymentInsight(profile));
    lines.push(`Para ese valor, la banca normalmente te pediria entre ${bold(money(minPrime, profile))} y ${bold(money(comfortablePrime, profile))} de prima.`);
    lines.push("Con esa prima actual, hoy te expones a un rechazo temprano.");
    lines.push("Esto es una precalificacion estimada.");
    lines.push(closingQuestion("Queres que coticemos una propiedad menor o armamos un plan de ahorro para llegar a esa prima?"));
    return lines.join("\n");
  }

  if (!results.length) {
    lines.push(
      profile.downPayment && hasAssetContext
        ? "Ya tome en cuenta tu prima de " + bold(money(profile.downPayment, profile)) + "."
        : "Con esos datos no encontre una opcion clara.",
    );
    lines.push(affordabilityGuidance(profile) || "Probemos con mas prima o menos monto.");
    optimizationIdeas(profile).forEach((idea) => lines.push(idea));
    buildProfileAdvice(profile, analysis || emptyContext(), results).forEach((line) => lines.push(line));
    lines.push("Esto es una precalificacion estimada.");
    lines.push(closingQuestion(defaultNextQuestion(analysis || emptyContext())));
    return lines.join("\n");
  }

  if (results.length === 1) {
    lines.push("Hoy veo una opcion clara con tu perfil.");
    lines.push("Las demas quedan cortas en politica o capacidad.");
  }

  if (targetLoan > 0 && results[0] && results[0].amount < targetLoan) {
    lines.push(`Hoy no llegas al monto objetivo de ${bold(money(targetLoan, profile))}.`);
    lines.push(`Tu mejor techo actual ronda ${bold(money(results[0].amount, profile))}.`);
    optimizationIdeas(profile).forEach((idea) => lines.push(idea));
  }

  visibleResults(results, profile).forEach((result, index) => {
    lines.push(
      "────────────────",
      `${index + 1}. ${bold("Banco")}: ${bold(result.bank)}`,
      `${bold("Tasa de Interes")}: ${bold(result.rate.toFixed(2) + "%")}`,
      `${bold("Monto Maximo de Prestamo")}: ${bold(money(result.amount, profile))}`,
      `${bold("Cuota Mensual Estimada")}: ${bold(money(result.payment, profile))}`,
      `${bold("Plazo")}: ${bold(result.years + " anos")}`,
      hasDownPaymentOnly ? `Valor total aprox con tu prima: ${bold(money(result.amount + profile.downPayment, profile))}` : null,
    );
  });

  lines.push("Esto es una precalificacion estimada.");
  if ((profile.product === "vehiculo" || profile.product === "hipoteca") && !profile.assetValue) {
    lines.push("Si me decis el valor del " + assetLabel(profile.product) + ", afino la cuota real.");
  }
  buildProfileAdvice(profile, analysis || emptyContext(), results).forEach((line) => lines.push(line));
  lines.push(closingQuestion(defaultNextQuestion(analysis || emptyContext())));
  return lines.filter(Boolean).join("\n");
}

function formatResultsCompact(profile: InternalProfile, results: SimResult[], analysis: ApplicantContext | null): string {
  const hasAssetContext = profile.product !== "personal";
  const hasDownPaymentOnly = hasAssetContext && profile.downPayment > 0 && !profile.assetValue;
  const netIncome = Math.max(0, profile.income - profile.debt);
  const targetLoan = profile.assetValue ? Math.max(0, profile.assetValue - profile.downPayment) : 0;
  const intro = analysis ? buildDiagnosticIntro(analysis) : "";
  const realityCheck = needsDownPaymentRealityCheck(profile);
  const applyOptions: string[] = [];
  const lines: (string | null)[] = [
    intro || null,
    bold("Precalificacion estimada"),
    "Producto: " + bold(productTitle(profile.product)),
    "Ingreso: " + bold(money(profile.income, profile)),
    "Deudas: " + bold(money(profile.debt, profile)),
    "Ingreso neto: " + bold(money(netIncome, profile)),
    profile.assetValue
      ? "Valor de referencia: " + bold(money(profile.assetValue, profile)) + (profile.downPayment ? " | Prima: " + bold(money(profile.downPayment, profile)) : "")
      : hasDownPaymentOnly
        ? "Sin valor del bien. Prima detectada: " + bold(money(profile.downPayment, profile)) + "."
        : "Sin valor del bien: estimo el monto maximo segun capacidad de pago.",
    !realityCheck ? lowDownPaymentInsight(profile) || null : null,
    hasDownPaymentOnly ? "Tomo en cuenta tu capacidad y el porcentaje maximo que financia cada banco." : null,
    hasDownPaymentOnly ? "Aqui el monto es " + bold("prestamo maximo") + ", no el valor total del bien." : null,
    "",
  ];

  if (netIncome <= 0) {
    lines.push("No puedo simular con ingreso neto en cero.");
    lines.push("Primero hay que bajar deudas o subir ingreso.");
    lines.push(closingQuestion("Quieres que recalcule reduciendo tus deudas actuales o prefieres ver opciones con una prima mayor?"));
    return lines.join("\n");
  }

  if (realityCheck) {
    const minPrime = Math.round(profile.assetValue * 0.1);
    const comfortablePrime = Math.round(profile.assetValue * 0.2);
    lines.push("Antes de simular fino, te aterrizo algo importante.");
    lines.push(lowDownPaymentInsight(profile));
    lines.push(`Para ese valor, la banca normalmente te pediria entre ${bold(money(minPrime, profile))} y ${bold(money(comfortablePrime, profile))} de prima.`);
    lines.push("Con esa prima actual, hoy te expones a un rechazo temprano.");
    lines.push("Esto es una precalificacion estimada.");
    lines.push(closingQuestion("Queres que coticemos una propiedad menor o armamos un plan de ahorro para llegar a esa prima?"));
    return lines.join("\n");
  }

  if (!results.length) {
    lines.push(
      profile.downPayment && hasAssetContext
        ? "Ya tome en cuenta tu prima de " + bold(money(profile.downPayment, profile)) + "."
        : "Con esos datos no encontre una opcion clara.",
    );
    lines.push(affordabilityGuidance(profile) || "Probemos con mas prima o menos monto.");
    optimizationIdeas(profile).forEach((idea) => lines.push(idea));
    buildProfileAdvice(profile, analysis || emptyContext(), results).forEach((line) => lines.push(line));
    lines.push("Esto es una precalificacion estimada.");
    lines.push(closingQuestion(defaultNextQuestion(analysis || emptyContext())));
    return lines.join("\n");
  }

  if (results.length === 1) {
    lines.push("Hoy veo una opcion clara con tu perfil.");
    lines.push("Las demas quedan cortas en politica o capacidad.");
  }

  if (targetLoan > 0 && results[0] && results[0].amount < targetLoan) {
    lines.push(`Hoy no llegas al monto objetivo de ${bold(money(targetLoan, profile))}.`);
    lines.push(`Tu mejor techo actual ronda ${bold(money(results[0].amount, profile))}.`);
    optimizationIdeas(profile).forEach((idea) => lines.push(idea));
  }

  visibleResults(results, profile).forEach((result) => {
    const applyCommand = applyCommandForBank(result.bank);
    applyOptions.push(applyCommand);
    lines.push(
      "----------------",
      `🏦 ${bold(result.bank)}`,
      `• Cuota est.: ${bold(money(result.payment, profile) + "/mes")}`,
      `• Prima requerida: ${bold(money(requiredDownPaymentForResult(result, profile), profile))} | Plazo: ${bold(result.years + " anos")}`,
      `• Monto estimado: ${bold(money(result.amount, profile))}`,
      hasDownPaymentOnly ? `• Valor total aprox con tu prima: ${bold(money(result.amount + profile.downPayment, profile))}` : null,
      `_Para iniciar tu tramite digital responde: "${applyCommand}"_`,
    );
  });

  lines.push("Esto es una precalificacion estimada.");
  if ((profile.product === "vehiculo" || profile.product === "hipoteca") && !profile.assetValue) {
    lines.push("Si me decis el valor del " + assetLabel(profile.product) + ", afino la cuota real.");
  }
  if (applyOptions.length) {
    lines.push(`Con un solo clic preparamos tu perfil para el analista. Responde ${bold(applyOptions.join(" / "))}.`);
  }
  buildProfileAdvice(profile, analysis || emptyContext(), results).forEach((line) => lines.push(line));
  lines.push(closingQuestion(defaultNextQuestion(analysis || emptyContext())));
  return lines.filter(Boolean).join("\n");
}

function emptyContext(): ApplicantContext {
  return {
    independent: false,
    coBorrower: false,
    debtConsolidator: false,
    blemishedCredit: false,
    highDownPayment: false,
    recentEmployment: false,
    informal: false,
    senior: false,
    noSavings: false,
    foreignResident: false,
    firstHome: false,
    age: 0,
  };
}

export function buildReplyFromProfile(
  profile: Partial<InternalProfile>,
  options?: BuildReplyOptions,
): { message: string } {
  const cleanProfile = coerceProfile(profile);
  const allowEstimateWithoutDownPayment = Boolean(options && options.allowEstimateWithoutDownPayment);
  const rawMissing = missingProfileMessage(cleanProfile);
  const missing = allowEstimateWithoutDownPayment && /prima/i.test(rawMissing) ? "" : rawMissing;
  const prefixLines = Array.isArray(options && options.prefixLines) ? options!.prefixLines!.filter(Boolean) : [];
  const followUpBody = options && options.followUpBody ? String(options.followUpBody) : "";
  const analysis = options && options.analysis ? options.analysis : detectApplicantContext(followUpBody, cleanProfile);

  if (missing) {
    return {
      message: prefixLines.length ? prefixLines.concat("", missing).join("\n") : missing,
    };
  }

  const results = simulate(cleanProfile);
  const followUpMessage = followUpBody ? buildFollowUpReply(cleanProfile, results, analysis, followUpBody) : "";
  const message = followUpMessage || formatResultsCompact(cleanProfile, results, analysis);
  return {
    message: prefixLines.length ? prefixLines.concat("", message).join("\n") : message,
  };
}

export function buildReply(input: BuildReplyInput | null | undefined): { message: string } {
  const body = input && input.body ? String(input.body) : "";
  const text = normalizeInputText(body);
  const numMedia = Number(input && input.numMedia ? input.numMedia : 0);
  const defaultCountry = input?.defaultCountry;
  const defaultCurrency = input?.defaultCurrency;

  if (numMedia > 0) {
    return {
      message: [
        "Recibí tu documento.",
        "Voy a leer ingresos y rebajos.",
        closingQuestion("¿Buscás casa, carro o préstamo personal?"),
      ].join("\n"),
    };
  }

  const hasFinancialIntent = /(gano|ingreso|salario|sueldo|neto|debo|deuda|prima|enganche|aporte|abono|casa|vivienda|hipoteca|carro|auto|vehiculo|credito|prestamo|plata|financiar)/.test(text);

  if (!text || (/^(hola|buenas|menu|ayuda|inicio|empezar|hey|ola)\b/.test(text) && !hasFinancialIntent)) {
    return {
      message: [
        "Hola, soy " + bold("PreCali AI") + ", tu precalificador de confianza.",
        "Soy tu puente digital con bancos de Costa Rica.",
        "Te ayudo a comparar, perfilarte y aplicar sin filas ni papeleo fisico.",
        "Dame ingresos, deudas, si es casa o carro, y la prima que puedes aportar.",
        "Uso tu moneda local por defecto. Si quieres cotizar en dolares, dimelo.",
        "Tambien puedes enviar orden patronal, boleta de pago o estado de cuenta.",
        closingQuestion("Estas listo para precalificar?"),
      ].join("\n"),
    };
  }

  const profile = parseProfile(body, { defaultCountry, defaultCurrency });
  const analysis = detectApplicantContext(body, profile);
  const originacionReply = buildOriginacionReply(body, profile, []);
  if (originacionReply) {
    return { message: originacionReply };
  }

  if (!profile.income && likelyDocumentFollowUp(body)) {
    return { message: documentFollowUpMessage(profile) };
  }

  if (/\b(pdf|documento|orden|patronal|boleta|colilla|foto|imagen|adjunto|archivo)\b/.test(text) && !/(gano|ingreso|salario|sueldo|neto)/.test(text)) {
    return {
      message: [
        "Mandamelo por este chat.",
        "Leo PDF con texto y orden patronal.",
        closingQuestion("¿Querés simular casa o carro?"),
      ].join("\n"),
    };
  }

  if (/(aplicar|solicitar|me interesa|quiero esa|enviar|mandar)/.test(text) && (detectRequestedBank(text) || /esa opcion|esa opción/.test(text)) && !/(gano|ingreso|salario|sueldo)/.test(text)) {
    const bank = detectRequestedBank(text);
    return {
      message: [
        bank ? `Perfecto. Seguimos con ${bold(bank)}.` : "Perfecto. Ya casi aplicamos.",
        `Primero necesitamos tu autorizacion para el ${bold("estudio crediticio inicial")}.`,
        "Con eso perfilamos tu caso y preparamos el expediente digital.",
        "La revision formal del banco se autoriza aparte antes de enviarlo.",
        closingQuestion("Nos das esa autorizacion para avanzar?"),
      ].join("\n"),
    };
  }

  if (/(^|\b)(estado|aprobado|rechazado|seguimiento)(\b|$)/.test(text) && !/estados? de cuenta/.test(text)) {
    return {
      message: [
        "Estoy encima de tu trámite.",
        "Los estados pueden ser: En análisis, Aprobado o Faltan documentos.",
        "Te avisaré apenas cambie algo.",
        closingQuestion("¿Querés revisar si falta algún documento?"),
      ].join("\n"),
    };
  }

  const specialistStep = buildSpecialistStepMessage(profile, analysis, text);
  if (specialistStep) {
    return { message: specialistStep };
  }

  if (profile.product === "personal" && !/(personal|consumo|libre inversion|gastos personales)/.test(text) && !profile.income) {
    return {
      message: [
        "Empecemos por el producto.",
        "Puedo ayudarte con casa, carro o personal.",
        closingQuestion("¿Qué querés simular hoy?"),
      ].join("\n"),
    };
  }

  if (profile.product !== "personal" && profile.income && !hasDebtSignal(text)) {
    return {
      message: [
        "Perfecto. Ya tengo tu ingreso.",
        "Ahora necesito tus deudas mensuales.",
        closingQuestion("¿Pagás alguna cuota hoy?"),
      ].join("\n"),
    };
  }

  if (profile.product !== "personal" && profile.income && hasDebtSignal(text) && !hasDownPaymentSignal(text) && !profile.downPayment) {
    return {
      message: [
        "Bien. Ya tengo ingreso y deudas.",
        "Ahora necesito tu prima aproximada.",
        closingQuestion("¿Con cuánto contás de prima?"),
      ].join("\n"),
    };
  }

  const missing = missingProfileMessage(profile);
  if (missing) return { message: missing };

  return { message: formatResultsCompact(profile, simulate(profile), analysis) };
}
