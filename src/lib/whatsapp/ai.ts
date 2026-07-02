// ============================================================
// PreCali AI — Abstraccion de proveedores de IA (OpenAI + Groq)
// ============================================================
// Port fiel de `api/_lib/precali-ai.js` (CommonJS -> TypeScript).
//
// Dos modos de uso de IA, con seleccion automatica de proveedor:
//
//   1. EXTRACCION (analyzeWithPreCaliAi): extrae datos financieros
//      del mensaje del usuario y/o documento adjunto. OpenAI para
//      multimedia (imagen/PDF via /v1/responses con json_schema),
//      Groq para texto puro (mas rapido y barato). Si el documento
//      ya se parseo localmente (documentText), Groq puede usarse
//      incluso con media.
//
//   2. ASESOR CONVERSACIONAL (writeAdvisorReplyWithPreCaliAi):
//      solo Groq. Genera una respuesta humana corta al usuario
//      basada en el perfil calculado, las opciones de bancos y la
//      base de conocimiento.
//
// Usa `fetch` directo contra las REST APIs de OpenAI y Groq
// (OpenAI-compatible): no depende del paquete npm `openai`.
//
// SEGURIDAD: la descarga de medios de Twilio reusa
// `fetchTwilioMedia` de `@/lib/whatsapp/media`, que valida el host
// contra un allowlist (CWE-918 SSRF). Las API keys nunca se loguean.

import { getEnv } from "@/lib/env";
import { fetchTwilioMedia } from "@/lib/whatsapp/media";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// ---------- Tipos publicos ----------

export type AiProvider = "openai" | "groq" | "";

export interface AiInput {
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  numMedia?: number;
  documentText?: string;
  recentMessages?: string[];
}

export interface AdvisorBankResult {
  bank: string;
  rate: number;
  amount: number;
  payment: number;
  years: number;
}

export interface AdvisorProfile {
  country?: string;
  currency?: string;
  income?: number;
  debt?: number;
  [key: string]: unknown;
}

export interface AdvisorInput extends AiInput {
  profile?: AdvisorProfile;
  results?: AdvisorBankResult[];
  knowledge?: { lines: string[] };
  fallbackReply?: string;
  missingData?: string[];
}

export interface NormalizedAiResult {
  profile: {
    product: string | null;
    currency: string | null;
    income: number | null;
    debt: number | null;
    downPayment: number | null;
    assetValue: number | null;
    requestedYears: number | null;
  };
  document: {
    type: string | null;
    name: string | null;
    idNumber: string | null;
    employer: string | null;
    grossIncome: number | null;
    netIncome: number | null;
  };
  confidence: number;
  missing: string[];
  notes: string;
}

export interface AdvisorReply {
  message: string;
  confidence: number;
}

// ---------- Helpers de keys y seleccion de proveedor ----------

function hasOpenAiKey(): boolean {
  return Boolean(getEnv().OPENAI_API_KEY);
}

function hasGroqKey(): boolean {
  return Boolean(getEnv().GROQ_API_KEY);
}

// PRECALI_AI_PROVIDER: se lee directo de process.env (no de getEnv)
// porque getEnv() asigna un default "openai" cuando la variable no
// esta seteada, pero el legado trata el valor vacio como
// "auto-seleccion" (Groq para texto si hay key, OpenAI para media).
// Usar getEnv() aqui romperia el fallback automatico a Groq.
function activeAiProvider(input: AiInput | null | undefined): AiProvider {
  const forced = String(process.env.PRECALI_AI_PROVIDER || "").trim().toLowerCase();
  const numMedia = Number(input && input.numMedia ? input.numMedia : 0);
  const hasDocumentText = Boolean(input && input.documentText);

  if (forced === "openai") return hasOpenAiKey() ? "openai" : "";
  if (forced === "groq") {
    if (numMedia > 0 && !hasDocumentText) return hasOpenAiKey() ? "openai" : "";
    return hasGroqKey() ? "groq" : "";
  }

  if (numMedia > 0 && !hasDocumentText) return hasOpenAiKey() ? "openai" : "";
  if (hasGroqKey()) return "groq";
  if (hasOpenAiKey()) return "openai";
  return "";
}

// PRECALI_AI_DISABLED: el legado solo desactiva con el valor "1"
// (no usa isFeatureDisabled, que acepta mas valores falsy).
function aiEnabled(input: AiInput | null | undefined): boolean {
  return Boolean(activeAiProvider(input)) && getEnv().PRECALI_AI_DISABLED !== "1";
}

function shouldUseAiForMessage(input: AiInput | null | undefined): boolean {
  if (!aiEnabled(input)) return false;

  const numMedia = Number(input && input.numMedia ? input.numMedia : 0);
  if (numMedia > 0) {
    if (getEnv().PRECALI_AI_DOCUMENT_FALLBACK !== "1") return false;
    if (input && input.documentText && activeAiProvider(input) === "groq") return true;
    return activeAiProvider(input) === "openai";
  }

  if (getEnv().PRECALI_AI_TEXT === "0") return false;

  const body = String(input && input.body ? input.body : "").trim();
  if (body.length < 18) return false;
  if (/^(hola|buenas|menu|ayuda|inicio|empezar|hey|ola)$/i.test(body)) return false;

  return true;
}

// ---------- Normalizacion de resultados ----------

function safeJsonParse<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    const match = String(value).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
}

function normalizeProduct(value: unknown): string | null {
  const product = String(value || "").toLowerCase();
  if (product === "vehiculo" || product === "personal" || product === "hipoteca") return product;
  return null;
}

function normalizeCurrency(value: unknown): string | null {
  const currency = String(value || "").toUpperCase();
  if (["CRC", "USD"].includes(currency)) return currency;
  return null;
}

interface RawAiResult {
  profile?: Record<string, unknown> | null;
  document?: Record<string, unknown> | null;
  confidence?: number;
  missing?: unknown[];
  notes?: unknown;
}

export function normalizeAiResult(result: unknown): NormalizedAiResult {
  const raw = (result || {}) as RawAiResult;
  const profile = (raw.profile || {}) as Record<string, unknown>;
  const document = (raw.document || {}) as Record<string, unknown>;

  return {
    profile: {
      product: normalizeProduct(profile.product),
      currency: normalizeCurrency(profile.currency),
      income: normalizeNumber(profile.income),
      debt: normalizeNumber(profile.debt),
      downPayment: normalizeNumber(profile.downPayment),
      assetValue: normalizeNumber(profile.assetValue),
      requestedYears: normalizeNumber(profile.requestedYears),
    },
    document: {
      type: document.type ? String(document.type) : null,
      name: document.name ? String(document.name) : null,
      idNumber: document.idNumber ? String(document.idNumber) : null,
      employer: document.employer ? String(document.employer) : null,
      grossIncome: normalizeNumber(document.grossIncome),
      netIncome: normalizeNumber(document.netIncome),
    },
    confidence: Math.max(0, Math.min(1, Number(raw.confidence ? raw.confidence : 0))),
    missing: Array.isArray(raw.missing) ? raw.missing.map(String).slice(0, 8) : [],
    notes: raw.notes ? String(raw.notes).slice(0, 500) : "",
  };
}

// ---------- JSON Schema para OpenAI structured output ----------

function buildSchema(): Record<string, unknown> {
  const nullableNumber = {
    anyOf: [{ type: "number" }, { type: "null" }],
  };
  const nullableString = {
    anyOf: [{ type: "string" }, { type: "null" }],
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["profile", "document", "confidence", "missing", "notes"],
    properties: {
      profile: {
        type: "object",
        additionalProperties: false,
        required: ["product", "currency", "income", "debt", "downPayment", "assetValue", "requestedYears"],
        properties: {
          product: {
            anyOf: [{ type: "string", enum: ["personal", "vehiculo", "hipoteca"] }, { type: "null" }],
          },
          currency: {
            anyOf: [{ type: "string", enum: ["CRC", "USD"] }, { type: "null" }],
          },
          income: nullableNumber,
          debt: nullableNumber,
          downPayment: nullableNumber,
          assetValue: nullableNumber,
          requestedYears: nullableNumber,
        },
      },
      document: {
        type: "object",
        additionalProperties: false,
        required: ["type", "name", "idNumber", "employer", "grossIncome", "netIncome"],
        properties: {
          type: nullableString,
          name: nullableString,
          idNumber: nullableString,
          employer: nullableString,
          grossIncome: nullableNumber,
          netIncome: nullableNumber,
        },
      },
      confidence: { type: "number" },
      missing: {
        type: "array",
        items: { type: "string" },
      },
      notes: { type: "string" },
    },
  };
}

// ---------- Prompts de extraccion ----------

function buildExtractionPrompt(body: string | undefined, mediaType: string | undefined): string {
  return [
    "Sos el extractor de datos de PreCali para pre-calificacion financiera en Costa Rica.",
    "Extrae solamente datos que aparezcan en el mensaje o documento. No inventes montos.",
    "Puede venir texto desordenado, con faltas de ortografia, orden patronal, boleta de pago, colilla, estado de cuenta, proforma, foto o PDF.",
    "Usa salario/ingreso NETO si existe. Si solo existe salario bruto, ponlo en grossIncome y usa income solo si el documento indica neto o liquido.",
    "No trates rebajos legales de planilla como deudas mensuales, excepto si aparecen como prestamos, cuotas, embargos, pension u obligaciones recurrentes.",
    "Producto: hipoteca para casa/vivienda/lote/terreno/propiedad; vehiculo para carro/auto/moto; personal para prestamo personal o si no hay garantia.",
    "Detecta la moneda si el usuario la menciona. Usa CRC para colones costarricenses o USD para dolares.",
    "Devuelve numeros puros en la moneda detectada del mensaje. No uses simbolos ni separadores.",
    "Si hay documento adjunto, clasificalo y extrae nombre, cedula, patrono, ingreso bruto y neto cuando se pueda.",
    "",
    "Mensaje de WhatsApp:",
    body || "(sin texto)",
    "",
    "Tipo de archivo adjunto:",
    mediaType || "(sin adjunto)",
  ].join("\n");
}

function buildGroqExtractionPrompt(body: string | undefined, recentMessages: string[] | undefined): string {
  const historyLines =
    Array.isArray(recentMessages) && recentMessages.length
      ? recentMessages.slice(-5).map((item, index) => `${index + 1}. ${String(item)}`).join("\n")
      : "(sin contexto previo)";

  return [
    "Sos el extractor conversacional de PreCali para pre-calificacion financiera en Costa Rica.",
    "Entende texto desordenado de WhatsApp y devolve SOLO JSON valido.",
    "No inventes montos. Si no sabes algo, usa null o array vacio.",
    "Usa producto: personal, vehiculo o hipoteca.",
    "Si el usuario hace una pregunta de seguimiento, usa el contexto reciente para inferir a que se refiere.",
    "Detecta la moneda si el usuario la menciona. Usa CRC para colones costarricenses o USD para dolares.",
    "Devuelve numeros puros en la moneda detectada del mensaje. No uses simbolos ni separadores.",
    "",
    "Contexto reciente del chat:",
    historyLines,
    "",
    "Mensaje actual:",
    body || "(sin texto)",
    "",
    'Devuelve un objeto JSON con esta forma exacta: {"profile":{"product":string|null,"currency":string|null,"income":number|null,"debt":number|null,"downPayment":number|null,"assetValue":number|null,"requestedYears":number|null},"document":{"type":null,"name":null,"idNumber":null,"employer":null,"grossIncome":null,"netIncome":null},"confidence":number,"missing":[string],"notes":string}',
  ].join("\n");
}

function buildGroqDocumentPrompt(
  body: string | undefined,
  recentMessages: string[] | undefined,
  documentText: string,
): string {
  const historyLines =
    Array.isArray(recentMessages) && recentMessages.length
      ? recentMessages.slice(-5).map((item, index) => `${index + 1}. ${String(item)}`).join("\n")
      : "(sin contexto previo)";

  return [
    "Sos el extractor documental de PreCali.",
    "Analiza texto crudo de una orden patronal, colilla, constancia, estado de cuenta o PDF financiero.",
    "Devuelve SOLO JSON valido. No inventes montos.",
    "Si el salario es quincenal, conviertelo a mensual multiplicando por 2.",
    "Usa ingreso neto/liquido si aparece. Si solo hay bruto, colocalo como grossIncome y usa income solo si no hay neto.",
    "No trates deducciones de ley como deuda. Solo usa deuda si dice prestamo, tarjeta, embargo, pension, cuota u obligacion recurrente.",
    "Producto: hipoteca para casa/vivienda/lote/terreno/propiedad; vehiculo para carro/auto/moto; personal si no hay garantia.",
    "Detecta la moneda si aparece en el mensaje o documento. Usa CRC o USD. Si no aparece, usa null.",
    "",
    "Contexto reciente del chat:",
    historyLines,
    "",
    "Mensaje del usuario:",
    body || "(sin texto)",
    "",
    "Texto extraido del documento:",
    String(documentText || "").slice(0, 12000),
    "",
    'Devuelve un objeto JSON con esta forma exacta: {"profile":{"product":string|null,"currency":string|null,"income":number|null,"debt":number|null,"downPayment":number|null,"assetValue":number|null,"requestedYears":number|null},"document":{"type":string|null,"name":string|null,"idNumber":string|null,"employer":string|null,"grossIncome":number|null,"netIncome":number|null},"confidence":number,"missing":[string],"notes":string}',
  ].join("\n");
}

// ---------- Helpers del asesor (moneda + recomendacion) ----------

const ADVISOR_COUNTRY_CONFIG: Record<string, { defaultCurrency: string; currencies: Record<string, { scale: number }> }> = {
  CR: { defaultCurrency: "CRC", currencies: { CRC: { scale: 1 }, USD: { scale: 540 } } },
};

function advisorCurrency(profile: AdvisorProfile | null | undefined): string {
  const country = profile && profile.country ? profile.country : "CR";
  const config = ADVISOR_COUNTRY_CONFIG[country] || ADVISOR_COUNTRY_CONFIG.CR;
  return profile && profile.currency ? profile.currency : config.defaultCurrency;
}

function advisorCurrencyScale(profile: AdvisorProfile | null | undefined): number {
  const country = profile && profile.country ? profile.country : "CR";
  const config = ADVISOR_COUNTRY_CONFIG[country] || ADVISOR_COUNTRY_CONFIG.CR;
  const currency = advisorCurrency(profile);
  const currencyConfig = config.currencies[currency] || config.currencies[config.defaultCurrency];
  return currencyConfig ? currencyConfig.scale : 1;
}

function advisorMoney(value: unknown, profile: AdvisorProfile | null | undefined): string {
  const amount = Math.max(0, Math.round((Number(value) || 0) / advisorCurrencyScale(profile)));
  return advisorCurrency(profile) + " " + amount.toLocaleString("es-CR");
}

function advisorRecommendedOption(
  results: AdvisorBankResult[] | null | undefined,
  profile: AdvisorProfile | null | undefined,
): AdvisorBankResult | null {
  if (!Array.isArray(results) || !results.length) return null;
  const netIncome = Math.max(1, Number(profile && (profile as AdvisorProfile).income || 0) - Number(profile && (profile as AdvisorProfile).debt || 0));
  const affordable = results
    .map((result) => ({ result, burden: Number(result.payment || 0) / netIncome }))
    .filter((item) => item.burden <= 0.35)
    .sort((a, b) => a.burden - b.burden || Number(a.result.rate || 0) - Number(b.result.rate || 0));
  if (affordable.length) return affordable[0].result;
  return results.slice().sort((a, b) => Number(a.payment || 0) - Number(b.payment || 0) || Number(a.rate || 0) - Number(b.rate || 0))[0];
}

// ---------- Descarga de medios + contenido multimodal ----------
// Reusa fetchTwilioMedia de media.ts, que incluye guard SSRF
// (allowlist de hosts de Twilio, CWE-918).

function extensionForContentType(contentType: string): string {
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("wordprocessingml")) return "docx";
  if (contentType.includes("msword")) return "doc";
  if (contentType.includes("csv")) return "csv";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "bin";
}

type MediaContentPart =
  | { type: "input_image"; image_url: string }
  | { type: "input_file"; filename: string; file_data: string };

function mediaContentPart(
  media: { buffer: Buffer; contentType: string } | null,
  fallbackType: string | undefined,
): MediaContentPart | null {
  if (!media || !media.buffer) return null;

  const contentType = (media.contentType || fallbackType || "application/octet-stream").split(";")[0].toLowerCase();
  const base64 = media.buffer.toString("base64");

  if (contentType.startsWith("image/")) {
    return {
      type: "input_image",
      image_url: `data:${contentType};base64,${base64}`,
    };
  }

  return {
    type: "input_file",
    filename: `precali-document.${extensionForContentType(contentType)}`,
    file_data: `data:${contentType};base64,${base64}`,
  };
}

function outputTextFromResponse(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string") return data.output_text;

  const texts: string[] = [];
  for (const item of (data.output as Array<{ content?: Array<{ text?: string }> }> | undefined) || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") texts.push(content.text);
    }
  }
  return texts.join("\n");
}

// ---------- Llamada a OpenAI (/v1/responses con json_schema) ----------

interface OpenAiError extends Error {
  status?: number;
  body?: string;
}

async function callOpenAi({
  body,
  mediaUrl,
  mediaType,
  numMedia,
}: {
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  numMedia?: number;
}): Promise<NormalizedAiResult> {
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: buildExtractionPrompt(body, mediaType),
    },
  ];

  if (Number(numMedia || 0) > 0 && mediaUrl) {
    const media = await fetchTwilioMedia(mediaUrl);
    const mediaPart = mediaContentPart(media, mediaType);
    if (mediaPart) content.push(mediaPart);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getEnv().OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getEnv().OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: "user",
          content,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "precali_extraction",
          strict: true,
          schema: buildSchema(),
        },
      },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`openai_${response.status}`) as OpenAiError;
    error.status = response.status;
    error.body = raw.slice(0, 1000);
    throw error;
  }

  const data = safeJsonParse<Record<string, unknown>>(raw);
  const outputText = outputTextFromResponse(data || {});
  const parsed = safeJsonParse(outputText);
  if (!parsed) throw new Error("openai_invalid_json");

  return normalizeAiResult(parsed);
}

// ---------- Llamada a Groq (/openai/v1/chat/completions) ----------

interface GroqError extends Error {
  status?: number;
  body?: string;
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
}

async function callGroq({
  body,
  recentMessages,
  documentText,
}: {
  body?: string;
  recentMessages?: string[];
  documentText?: string;
}): Promise<NormalizedAiResult> {
  const prompt = documentText
    ? buildGroqDocumentPrompt(body, recentMessages, documentText)
    : buildGroqExtractionPrompt(body, recentMessages);

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getEnv().GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getEnv().GROQ_MODEL || DEFAULT_GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Sos PreCali AI. Extrae datos financieros con precision y devuelve solo JSON valido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`groq_${response.status}`) as GroqError;
    error.status = response.status;
    error.body = raw.slice(0, 1000);
    throw error;
  }

  const data = safeJsonParse<GroqResponse>(raw);
  const outputText =
    data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content || "" : "";
  const parsed = safeJsonParse(outputText);
  if (!parsed) throw new Error("groq_invalid_json");

  return normalizeAiResult(parsed);
}

// ---------- Prompt del asesor conversacional ----------

function buildGroqAdvisorPrompt(input: AdvisorInput): string {
  const historyLines =
    Array.isArray(input.recentMessages) && input.recentMessages.length
      ? input.recentMessages.slice(-5).map((item, index) => `${index + 1}. ${String(item)}`).join("\n")
      : "(sin contexto previo)";
  const profile = input.profile || {};
  const netIncome = Math.max(1, Number(profile.income || 0) - Number(profile.debt || 0));
  const options = Array.isArray(input.results) ? input.results.slice(0, 8) : [];
  const recommended = advisorRecommendedOption(options, profile);
  const recommendedBurden = recommended ? Math.round((Number(recommended.payment || 0) / netIncome) * 100) : 0;
  const optionLines = options.length
    ? options
        .map((item, index) =>
          [
            `${index + 1}. ${item.bank}`,
            `tasa ${item.rate}%`,
            `monto ${advisorMoney(item.amount, profile)}`,
            `cuota ${advisorMoney(item.payment, profile)}`,
            `carga ${Math.round((Number(item.payment || 0) / netIncome) * 100)}%`,
            `plazo ${item.years} anos`,
          ].join(" | "),
        )
        .join("\n")
    : "(sin opciones calculadas)";
  const recommendedLine = recommended
    ? `${recommended.bank} | cuota ${advisorMoney(recommended.payment, profile)} | carga ${recommendedBurden}% | tasa ${recommended.rate}% | monto ${advisorMoney(recommended.amount, profile)}`
    : "(sin recomendacion calculada)";
  const knowledgeLines =
    input.knowledge && Array.isArray(input.knowledge.lines) && input.knowledge.lines.length
      ? input.knowledge.lines.slice(0, 44).map((item, index) => `${index + 1}. ${String(item)}`).join("\n")
      : "(sin base de conocimiento adicional)";
  const fallbackReply = input.fallbackReply ? String(input.fallbackReply).slice(0, 1600) : "(sin borrador)";
  const missingData =
    Array.isArray(input.missingData) && input.missingData.length ? input.missingData.join(", ") : "(ninguno detectado)";

  return [
    "Sos PreCali AI, asesor crediticio experto, empatico y altamente comercial para Costa Rica.",
    "Tu objetivo es conversar como asesor crediticio humano: entender, explicar, calcular cuando haya datos y guiar al usuario a aplicar formalmente al banco elegido por este chat.",
    "Presenta a PreCali como puente digital entre el usuario y los bancos: perfilamos, comparamos y preparamos la aplicacion sin filas ni papeleo fisico.",
    "Responde como humano: claro, directo, empatico y confiable. Usa vos de forma natural y respetuosa.",
    "No hagas cuestionarios roboticos. Pide un dato a la vez, o maximo dos si el usuario ya dio contexto claro.",
    "Usa SOLO el perfil, opciones calculadas y base de conocimiento abajo. No inventes bancos, tasas, aprobaciones, requisitos, alianzas ni procesos.",
    "Si el usuario menciona un banco que aparece en las opciones calculadas, evalua ese banco; no digas que no existe.",
    "Si el usuario pregunta cual banco conviene, usa la recomendacion calculada por PreCali y explica el criterio.",
    "No elijas solo por tasa. Considera cuota mensual, carga sobre ingreso y lo que el usuario pregunto.",
    "No compares el monto del prestamo contra la prima. La prima se suma al prestamo para estimar valor total del bien.",
    "Si no hay valor del carro/casa, aclara que falta ese dato para afinar la prima real.",
    "Si faltan datos, NO hagas tabla. Responde natural y pide solo el siguiente dato mas importante.",
    "Si datos faltantes incluye tipo de credito, pregunta si busca casa, carro o prestamo personal. No asumas personal solo porque el perfil diga personal.",
    'Si ya hay resultados y el usuario pidio simulacion, muestra maximo 3 bancos en este formato: 🏦 *Banco* / • Cuota est.: MONEDA MONTO/mes / • Prima: MONTO | Plazo: X anos / _Para iniciar tu tramite digital responde: "Aplicar a Banco"_.',
    "Si la pregunta es educativa, de requisitos, documentos u objecion, responde directamente con la base de conocimiento o borrador especifico. Nunca pegues una tabla de simulacion para una duda puntual.",
    "Si el usuario pregunta por buro, score, Soft Pull o Hard Pull: valida su miedo y explica que PreCali inicia con una consulta blanda/precalificacion que no es la revision formal del banco; el Hard Pull solo se autoriza si decide formalizar.",
    "Si pregunta por costo: di que PreCali es 100% gratuito para el usuario; no cobramos por comparar ni iniciar el proceso digital.",
    "Si pregunta por seguridad: menciona HTTPS, acceso restringido, servidores con estandares reconocidos y consentimiento. No prometas AES-256 ni destruccion en 30 dias.",
    'Si el usuario pregunta si debe ir a sucursal, frena esa idea: PreCali prepara el tramite digital y le pides responder Aplicar a Banco.',
    "Si el usuario pregunta si deberia aplicar, da criterio, aclara que sigue siendo precalificacion y pide autorizacion para iniciar el estudio crediticio.",
    "No mandes una tabla completa si el usuario hizo una duda puntual.",
    "Maximo 6 lineas cortas. Usa montos con moneda. Termina con una pregunta concreta orientada al siguiente paso.",
    "",
    "Contexto reciente:",
    historyLines,
    "",
    "Mensaje actual:",
    input.body || "(sin texto)",
    "",
    "Perfil calculado:",
    JSON.stringify(profile),
    "",
    "Datos faltantes detectados:",
    missingData,
    "",
    "Opciones calculadas:",
    optionLines,
    "",
    "Recomendacion calculada por PreCali:",
    recommendedLine,
    "",
    "Base de conocimiento PreCali y bancos:",
    knowledgeLines,
    "",
    "Borrador deterministico disponible para reescribir sin perder datos:",
    fallbackReply,
    "",
    'Devuelve SOLO JSON valido con esta forma: {"message":"respuesta para WhatsApp","confidence":0.0}',
  ].join("\n");
}

async function writeAdvisorReplyWithPreCaliAi(input: AdvisorInput): Promise<AdvisorReply | null> {
  if (!aiEnabled(input) || activeAiProvider(input) !== "groq") return null;
  if (getEnv().PRECALI_AI_TEXT === "0") return null;

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getEnv().GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getEnv().GROQ_MODEL || DEFAULT_GROQ_MODEL,
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Sos PreCali AI, asesor crediticio conversacional. Responde con criterio financiero usando solo datos proporcionados y guiando al siguiente paso.",
        },
        {
          role: "user",
          content: buildGroqAdvisorPrompt(input),
        },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`groq_advisor_${response.status}`) as GroqError;
    error.status = response.status;
    error.body = raw.slice(0, 1000);
    throw error;
  }

  const data = safeJsonParse<GroqResponse>(raw);
  const outputText =
    data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content || "" : "";
  const parsed = safeJsonParse<{ message?: unknown; confidence?: number }>(outputText);
  if (!parsed || !parsed.message) throw new Error("groq_advisor_invalid_json");

  const message = String(parsed.message).slice(0, 900);
  if (/(monto|prestamo|credito).{0,40}(inferior|menor).{0,40}prima|prima.{0,40}(supera|mayor).{0,40}(monto|prestamo|credito)/i.test(message)) {
    return null;
  }

  return {
    message,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
  };
}

// ---------- API publica ----------

async function analyzeWithPreCaliAi(input: AiInput): Promise<NormalizedAiResult | null> {
  if (!shouldUseAiForMessage(input)) return null;
  const provider = activeAiProvider(input);
  if (provider === "groq") return callGroq(input);
  return callOpenAi(input);
}

export {
  aiEnabled,
  activeAiProvider,
  shouldUseAiForMessage,
  analyzeWithPreCaliAi,
  writeAdvisorReplyWithPreCaliAi,
};
