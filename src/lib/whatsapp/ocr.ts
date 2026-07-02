// ============================================================
// PreCali AI — OCR de imagenes via Groq Vision
// ============================================================
// Port fiel de `api/_lib/precali-ocr.js` (CommonJS -> TypeScript).
//
// Cuando el usuario manda una FOTO de su orden patronal / colilla /
// estado de cuenta, el parser local de documentos (documents.ts)
// no puede leerla porque no hace OCR de pixeles. Este modulo envia
// la imagen al modelo de vision de Groq (llama-3.2-11b-vision),
// recibe el texto extraido y lo pasa por el mismo parser
// financiero estructural para obtener nombre, cedula, ingresos, etc.
//
// Usa `fetch` directo contra la REST API de Groq (OpenAI-compatible):
// no depende del paquete npm `openai`. Si GROQ_API_KEY no esta
// configurada, se devuelve un resultado `ok: false` con un mensaje
// claro para el usuario.

import { getEnv } from "@/lib/env";
import { parseFinancialDocument, type ParsedDocument, type DocumentData, type DocumentProfileData } from "@/lib/whatsapp/documents";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_VISION_MODEL = "llama-3.2-11b-vision-preview";
const REQUEST_TIMEOUT_MS = 18000;

/** Resultado de leer una imagen (espejo del legado). */
export interface OcrResult {
  ok: boolean;
  reason?: string;
  type?: string;
  message?: string;
  textLength: number;
  extractedText: string;
  document: DocumentData;
  profile: DocumentProfileData;
  confidence: number;
  notes: string[];
  warnings: string[];
  preview: string;
}

function hasGroqKey(): boolean {
  return Boolean(getEnv().GROQ_API_KEY);
}

function visionModel(): string {
  const env = getEnv();
  return env.GROQ_VISION_MODEL || env.GROQ_MODEL_VISION || DEFAULT_VISION_MODEL;
}

function mediaUrl(buffer: Buffer, contentType: string): string {
  const mime = String(contentType || "image/jpeg").split(";")[0] || "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function buildPrompt(): string {
  return [
    "Sos un lector OCR financiero para PreCali.",
    "Lee la imagen y extrae texto util para precalificar credito.",
    "No inventes datos. Si no ves un campo, omitilo.",
    "Responde SOLO texto plano, una linea por campo.",
    "",
    "Campos esperados si aparecen:",
    "Nombre:",
    "Cedula:",
    "Patrono:",
    "Salario neto:",
    "Salario bruto:",
    "Total deducciones:",
    "Deuda mensual:",
    "Producto:",
    "Prima:",
    "Valor bien:",
    "Observaciones:",
  ].join("\n");
}

async function callGroqVision(buffer: Buffer, contentType: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getEnv().GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: visionModel(),
        temperature: 0,
        max_tokens: 900,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildPrompt() },
              { type: "image_url", image_url: { url: mediaUrl(buffer, contentType) } },
            ],
          },
        ],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      const error = new Error(`groq_vision_${response.status}`);
      (error as Error & { body: string }).body = raw.slice(0, 1000);
      throw error;
    }

    const data = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
    return String(data?.choices?.[0]?.message?.content || "").trim();
  } finally {
    clearTimeout(timer);
  }
}

/** Resultado fallido vacio (mismos campos que el caso de exito). */
function emptyDocumentData(): DocumentData {
  return { name: null, idNumber: null, employer: null, grossIncome: null, netIncome: null, totalDeductions: null, strongObligations: null };
}

function emptyProfileData(): DocumentProfileData {
  return { product: "", income: 0, debt: 0, downPayment: 0, assetValue: 0, requestedYears: 0 };
}

export async function readImageFinancialDocument(
  buffer: Buffer | null | undefined,
  contentType: string,
): Promise<OcrResult> {
  if (!buffer || !buffer.length) {
    return {
      ok: false,
      reason: "empty_image",
      message: "La imagen venia vacia.",
      textLength: 0,
      extractedText: "",
      document: emptyDocumentData(),
      profile: emptyProfileData(),
      confidence: 0,
      notes: [],
      warnings: [],
      preview: "",
    };
  }

  if (!hasGroqKey()) {
    return {
      ok: false,
      reason: "groq_key_missing",
      message:
        "Recibi la imagen, pero el OCR de fotos necesita GROQ_API_KEY configurada. Mandame PDF/DOCX/CSV con texto, o escribime los datos.",
      textLength: 0,
      extractedText: "",
      document: emptyDocumentData(),
      profile: emptyProfileData(),
      confidence: 0,
      notes: [],
      warnings: [],
      preview: "",
    };
  }

  try {
    const extractedText = await callGroqVision(buffer, contentType);
    const parsed: ParsedDocument = parseFinancialDocument(extractedText);
    const usefulText = extractedText.trim();
    return {
      ok: usefulText.length >= 15,
      type: "image",
      textLength: usefulText.length,
      extractedText: usefulText.slice(0, 12000),
      document: parsed.document,
      profile: parsed.profile,
      confidence: parsed.confidence || 0,
      notes: parsed.notes || [],
      warnings: parsed.warnings || [],
      preview: usefulText.slice(0, 600),
      message:
        usefulText.length >= 15
          ? ""
          : "Recibi la imagen, pero no pude leer texto financiero claro. Podes intentar otra foto mas nitida o escribir los datos.",
    };
  } catch {
    return {
      ok: false,
      reason: "groq_vision_failed",
      message:
        "Recibi la imagen, pero el OCR con IA fallo en este momento. Podes intentar otra vez o escribir ingreso, deudas y prima.",
      textLength: 0,
      extractedText: "",
      document: emptyDocumentData(),
      profile: emptyProfileData(),
      confidence: 0,
      notes: [],
      warnings: [],
      preview: "",
    };
  }
}
