// ============================================================
// PreCali AI — Construccion de base de conocimiento contextual
// ============================================================
// Port fiel de `api/_lib/precali-knowledge.js` (CommonJS -> TypeScript).
//
// Construye la "base de conocimiento" que se le pasa al prompt del
// asesor IA (Groq) para que sus respuestas se basen en datos reales
// de PreCali y de los bancos de Costa Rica, en lugar de alucinar.
//
// Tiene dos fuentes:
//   1. Estatica: lineas hardcodeadas + frases extraidas del HTML
//      del sitio (index.html, terminos.html, privacidad.html) +
//      condiciones de los bancos (desde los datos tipados en
//      `@/data/bancos`).
//   2. Dinamica (live web): si el usuario pregunta por requisitos,
//      tasas o un banco especifico, hace fetch HTTP a la pagina
//      oficial del banco y extrae fragmentos relevantes.
//
// SEGURIDAD: el fetch de paginas de bancos valida la URL antes de
// la peticion (CWE-918 SSRF): rechaza IPs privados/internos y
// requiere http(s). Los nombres de archivo HTML leidos del disco
// son literales hardcodeados (no input del usuario), por lo que no
// hay riesgo de path traversal (CWE-22).

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { isFeatureDisabled } from "@/lib/env";
import { BANCOS } from "@/data/bancos";
import type { Banco, CondicionPrestamo } from "@/types/precali";

// ---------- Constantes (espejo del legado) ----------

const COUNTRY_NAMES: Record<string, string> = {
  CR: "Costa Rica",
};

const PRODUCT_LABELS: Record<string, string> = {
  personal: "prestamo personal",
  vehiculo: "credito vehicular",
  hipoteca: "credito hipotecario",
};

// ---------- Tipos publicos ----------

export interface KnowledgeProfile {
  country?: string;
  product?: string;
  currency?: string;
}

export interface KnowledgeInput {
  body?: string;
  profile?: KnowledgeProfile;
  defaultCountry?: string;
}

export interface KnowledgeResult {
  country: string;
  product: string;
  lines: string[];
}

export interface LiveBankUrl {
  bank: string;
  url: string;
}

// ---------- Normalizacion de pais ----------

function normalizeCountry(country: string | undefined): string {
  return "CR";
}

// ---------- Lectura de archivos HTML del proyecto ----------
// Los nombres son literales hardcodeados (no input del usuario):
// no hay riesgo de path traversal (CWE-22).

function readRootFile(filename: string): string {
  const candidate = join(process.cwd(), filename);
  try {
    if (existsSync(candidate)) return readFileSync(candidate, "utf8");
  } catch {
    // no-op: el legado devolvia "" si el archivo no existia.
  }
  return "";
}

// ---------- Limpieza de HTML ----------

function stripHtml(html: unknown): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&aacute;/g, "a")
    .replace(/&eacute;/g, "e")
    .replace(/&iacute;/g, "i")
    .replace(/&oacute;/g, "o")
    .replace(/&uacute;/g, "u")
    .replace(/&ntilde;/g, "n")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function relevantSentences(text: string, patterns: RegExp[], limit: number): string[] {
  const normalized = stripHtml(text);
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const matches: string[] = [];
  for (const sentence of sentences) {
    if (patterns.some((pattern) => pattern.test(sentence))) matches.push(sentence);
    if (matches.length >= limit) break;
  }
  return matches;
}

// ---------- Conocimiento estatico del sitio ----------

function siteKnowledgeLines(): string[] {
  // Conocimiento del sitio como fuente única y estable.
  // (Antes se extraía de index.html/terminos.html/privacidad.html con relevantSentences,
  //  pero esos archivos legacy se eliminaron en la migración a Next.js. Las frases clave
  //  que los regex buscaban se incorporaron aquí directamente — sin parseo de archivos.)
  const lines = [
    "PreCali compara opciones de bancos y aseguradoras de Costa Rica para mostrar tasas, requisitos y proximos pasos con claridad.",
    "La calculadora procesa la situacion financiera y usa sistema frances de amortizacion.",
    "Cada banco define capacidad de pago, tasa, plazo maximo y porcentaje de financiamiento.",
    "PreCali no es banco, no otorga prestamos y las precalificaciones son estimaciones referenciales no vinculantes.",
    "PreCali NO es una entidad bancaria ni financiera; los resultados son estimaciones informativas y la aprobacion depende de cada banco.",
    "La aprobacion final depende del analisis crediticio de cada entidad: historial, antiguedad laboral, sector, score interno, productos vigentes y garantias.",
    "Los datos se basan en informacion publica de bancos, folletos publicos y reportes regulatorios; pueden variar entre actualizaciones.",
    "PreCali usa consentimiento para tratamiento y posible comparticion de datos con asesores o socios aliados cuando pueda derivar en una oferta util.",
    "PreCali debe presentar la primera etapa como consulta blanda/precalificacion: no es el Hard Pull formal del banco. El Hard Pull se autoriza aparte si el usuario decide aplicar.",
    "PreCali es gratuito para el usuario al comparar y arrancar el tramite digital.",
    "Seguridad: HTTPS, servidores con estandares reconocidos, acceso restringido y auditorias periodicas; ningun sistema digital es 100% seguro.",
    "Derechos de datos: acceso, rectificacion, cancelacion, oposicion, revocacion y portabilidad; privacidad@precali.net.",
  ];
  return Array.from(new Set(lines)).slice(0, 16);
}

// ---------- Conocimiento de bancos (desde datos tipados) ----------

type BankCondition = CondicionPrestamo & { tasaLocal?: number };

function conditionRate(condition: BankCondition | null, currency: string): number | null {
  if (!condition) return null;
  if (currency === "USD" && Number.isFinite(Number(condition.tasaUSD))) return Number(condition.tasaUSD);
  if (Number.isFinite(Number(condition.tasaCRC))) return Number(condition.tasaCRC);
  if (Number.isFinite(Number(condition.tasaLocal))) return Number(condition.tasaLocal);
  if (Number.isFinite(Number(condition.tasaUSD))) return Number(condition.tasaUSD);
  return null;
}

function conditionLine(bank: Banco, product: string, currency: string): string {
  const condition = (bank[product as "personal" | "vehiculo" | "hipoteca"] ?? null) as BankCondition | null;
  if (!condition) return "";
  const rate = conditionRate(condition, currency);
  const parts = [
    bank.nombre,
    rate !== null ? `tasa ${rate}%` : "",
    condition.plazoMax ? `plazo max ${condition.plazoMax} anos` : "",
    condition.ratioMax ? `DTI ${Math.round(Number(condition.ratioMax) * 100)}%` : "",
    condition.financia ? `financia hasta ${Math.round(Number(condition.financia) * 100)}%` : "",
    condition.ingresoMin ? `ingreso min ${condition.ingresoMin}` : "",
    condition.montoMin ? `monto min ${condition.montoMin}` : "",
    condition.garantia ? `garantia: ${condition.garantia}` : "",
    condition.url ? `fuente: ${condition.url}` : bank.web ? `fuente: ${bank.web}` : "",
  ].filter(Boolean);
  return parts.join(" | ");
}

function bankKnowledgeLines(profile: KnowledgeProfile): string[] {
  const country = normalizeCountry(profile && profile.country);
  const currency = profile && profile.currency ? profile.currency : "";
  const product = profile && profile.product ? profile.product : "";
  // normalizeCountry siempre devuelve "CR" y todos los bancos en los datos
  // son de CR, asi que el filter por pais del legado era un no-op.
  void country;
  const countryBanks: Banco[] = BANCOS;
  const products = product && PRODUCT_LABELS[product] ? [product] : ["personal", "vehiculo", "hipoteca"];
  const lines: string[] = [];

  for (const item of countryBanks.slice(0, 12)) {
    for (const currentProduct of products) {
      const line = conditionLine(item, currentProduct, currency);
      if (line) lines.push(`${PRODUCT_LABELS[currentProduct]}: ${line}`);
    }
    if (product && lines.length >= 12) break;
    if (!product && lines.length >= 18) break;
  }

  return lines;
}

// ---------- Deteccion de intencion de busqueda web ----------

function shouldUseLiveWeb(body: string | undefined): boolean {
  return /(requisitos?|documentos?|tasa|tasas|actual|hoy|oficial|pagina|web|sitio|banco|bac|bcr|nacional|popular|promerica|davi|davivienda|lafise|bbva|scotiabank|banrural|banpro|ficohsa)/i.test(
    String(body || ""),
  );
}

function bankMentioned(bank: Banco, body: string | undefined): boolean {
  const text = String(body || "").toLowerCase();
  const name = String(bank.nombre || "").toLowerCase();
  const id = String(bank.id || "").toLowerCase();
  if (name && text.includes(name)) return true;
  if (id && text.includes(id)) return true;
  if (/bac/.test(text) && /bac/.test(name)) return true;
  if (/davi/.test(text) && /davi/.test(name)) return true;
  if (/\bbn\b|nacional/.test(text) && /nacional/.test(name)) return true;
  if (/bcr/.test(text) && /costa rica/.test(name)) return true;
  return false;
}

function liveBankUrls(profile: KnowledgeProfile, body: string | undefined): LiveBankUrl[] {
  const product = profile && PRODUCT_LABELS[profile.product ?? ""] ? profile.product! : "";
  const countryBanks: Banco[] = BANCOS;
  const mentioned = countryBanks.filter((bank) => bankMentioned(bank, body));
  const selected = (mentioned.length ? mentioned : countryBanks).slice(0, mentioned.length ? 2 : 1);
  const urls: LiveBankUrl[] = [];
  for (const bank of selected) {
    const condition = product ? (bank[product as "personal" | "vehiculo" | "hipoteca"] ?? null) : null;
    const url = condition && condition.url ? condition.url : bank.web;
    if (url && /^https?:\/\//i.test(url) && !urls.some((item) => item.url === url)) {
      urls.push({ bank: bank.nombre, url });
    }
  }
  return urls;
}

function relevantLiveText(text: string): string {
  const clean = stripHtml(text).slice(0, 18000);
  const sentences = clean.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const picked = sentences.filter((line) =>
    /(credito|prestamo|hipotec|vehicul|personal|tasa|plazo|requisit|ingreso|prima|enganche|financia|cuota|solicitud)/i.test(line),
  );
  return picked.slice(0, 3).join(" ").slice(0, 700);
}

// ---------- Guard SSRF (CWE-918) ----------
// Las URLs de bancos provienen de datos de confianza (no input del
// usuario), pero validamos antes del fetch como defensa en
// profundidad: rechazamos protocolos distintos de http(s) y bloqueamos
// IPs privados/internos que podrian apuntar a la infraestructura
// interna si los datos se compromised alguna vez.

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1") return true;
  if (host.endsWith(".localhost")) return true;
  if (isPrivateIPv4(host)) return true;
  // IPv6 link-local fe80::/10 y unique-local fc00::/7 (prefijo)
  if (/^fe[89ab][0-9a-f]?:/.test(host) || /^f[cd][0-9a-f]{2}:/.test(host)) return true;
  return false;
}

function isSafeExternalUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  if (isPrivateHostname(parsed.hostname)) return false;
  return true;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "PreCaliBot/1.0 (+https://precali.vercel.app)",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
      },
    });
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") || "";
    if (!/text|html|xml/i.test(contentType)) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLiveBankKnowledge(input: KnowledgeInput | null | undefined): Promise<string[]> {
  if (isFeatureDisabled("PRECALI_LIVE_WEB_DISABLED")) return [];
  if (!shouldUseLiveWeb(input?.body)) return [];
  const profile = input && input.profile ? input.profile : {};

  // Guard SSRF: filtrar URLs antes de cualquier peticion.
  const urls = liveBankUrls(profile, input?.body)
    .filter((item) => isSafeExternalUrl(item.url))
    .slice(0, 2);

  const lines: string[] = [];
  for (const item of urls) {
    const html = await fetchWithTimeout(item.url, 1400);
    const snippet = html ? relevantLiveText(html) : "";
    if (snippet) {
      lines.push(`Fuente web oficial ${item.bank}: ${snippet} (${item.url})`);
    } else {
      lines.push(`Fuente oficial disponible para ${item.bank}: ${item.url}`);
    }
  }
  return lines;
}

// ---------- API publica ----------

export function buildPreCaliKnowledge(input: KnowledgeInput | null | undefined): KnowledgeResult {
  const profile = input && input.profile ? input.profile : {};
  const country = normalizeCountry(profile.country || (input && input.defaultCountry) || "CR");
  const product = PRODUCT_LABELS[profile.product ?? ""] || "credito";
  const header = [
    `Pais detectado: ${COUNTRY_NAMES[country] || country}.`,
    `Producto contextual: ${product}.`,
    "Usa esta base como conocimiento interno. Si algo no esta aqui, no lo inventes.",
  ];

  return {
    country,
    product,
    lines: header.concat(siteKnowledgeLines(), bankKnowledgeLines({ ...profile, country })).slice(0, 34),
  };
}
