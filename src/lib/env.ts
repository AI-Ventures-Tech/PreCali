// PreCali — typed environment access for server code (Route Handlers / Server Components / lib).
// All code that touches secrets lives under src/lib/** and is never sent to the client.

export interface PrecaliEnv {
  // Twilio (WhatsApp webhook + messaging)
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_CONTENT_LIST_PRODUCTO: string;
  TWILIO_CONTENT_QR_GENERICO: string;
  // AI providers
  PRECALI_AI_PROVIDER: "openai" | "groq";
  PRECALI_AI_DISABLED: string;
  PRECALI_AI_DOCUMENT_FALLBACK: string;
  PRECALI_AI_TEXT: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  GROQ_API_KEY: string;
  GROQ_MODEL: string;
  GROQ_MODEL_VISION: string;
  GROQ_VISION_MODEL: string;
  // Upstash KV / Redis (state) — acepta ambas nomenclaturas (UPSTASH_* y KV_*)
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  KV_REST_API_URL: string;
  KV_REST_API_TOKEN: string;
  // Feature flags
  PRECALI_INTERACTIVE_DELAY_MS: string;
  PRECALI_LIVE_WEB_DISABLED: string;
}

type EnvKey = keyof PrecaliEnv;

function read(key: EnvKey): string {
  return process.env[key] ?? "";
}

/**
 * Snapshot tipado de las variables de entorno. No lanza: en el legado todo es
 * defensivo (flags en vacío = desactivado). Las llamadas que requieran un valor
 * deben validar con las helpers de más abajo.
 */
export function getEnv(): PrecaliEnv {
  return {
    TWILIO_ACCOUNT_SID: read("TWILIO_ACCOUNT_SID"),
    TWILIO_AUTH_TOKEN: read("TWILIO_AUTH_TOKEN"),
    TWILIO_CONTENT_LIST_PRODUCTO: read("TWILIO_CONTENT_LIST_PRODUCTO"),
    TWILIO_CONTENT_QR_GENERICO: read("TWILIO_CONTENT_QR_GENERICO"),
    PRECALI_AI_PROVIDER: (read("PRECALI_AI_PROVIDER") || "openai") as PrecaliEnv["PRECALI_AI_PROVIDER"],
    PRECALI_AI_DISABLED: read("PRECALI_AI_DISABLED"),
    PRECALI_AI_DOCUMENT_FALLBACK: read("PRECALI_AI_DOCUMENT_FALLBACK"),
    PRECALI_AI_TEXT: read("PRECALI_AI_TEXT"),
    OPENAI_API_KEY: read("OPENAI_API_KEY"),
    OPENAI_MODEL: read("OPENAI_MODEL"),
    GROQ_API_KEY: read("GROQ_API_KEY"),
    GROQ_MODEL: read("GROQ_MODEL"),
    GROQ_MODEL_VISION: read("GROQ_MODEL_VISION"),
    GROQ_VISION_MODEL: read("GROQ_VISION_MODEL"),
    UPSTASH_REDIS_REST_URL: read("UPSTASH_REDIS_REST_URL"),
    UPSTASH_REDIS_REST_TOKEN: read("UPSTASH_REDIS_REST_TOKEN"),
    KV_REST_API_URL: read("KV_REST_API_URL"),
    KV_REST_API_TOKEN: read("KV_REST_API_TOKEN"),
    PRECALI_INTERACTIVE_DELAY_MS: read("PRECALI_INTERACTIVE_DELAY_MS"),
    PRECALI_LIVE_WEB_DISABLED: read("PRECALI_LIVE_WEB_DISABLED"),
  };
}

/** true si el flag está presente y no es un valor falsy explícito. */
export function isFeatureEnabled(flag: EnvKey): boolean {
  const v = read(flag).trim().toLowerCase();
  return v !== "" && v !== "0" && v !== "false" && v !== "disabled" && v !== "no";
}

/** true si el flag está explícitamente activado como "disabled"/"false"/"0". */
export function isFeatureDisabled(flag: EnvKey): boolean {
  const v = read(flag).trim().toLowerCase();
  return v === "1" || v === "true" || v === "disabled" || v === "yes";
}

export function interactiveDelayMs(): number {
  const n = Number(read("PRECALI_INTERACTIVE_DELAY_MS"));
  return Number.isFinite(n) && n > 0 ? n : 1800;
}
