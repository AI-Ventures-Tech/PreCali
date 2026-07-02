// ============================================================
// PreCali AI — Descarga de medios de Twilio
// ============================================================
// Port fiel de `api/_lib/twilio-media.js` (CommonJS → TypeScript),
// con un guard de allowlist de host (CWE-918 SSRF) que el legado
// no tenia: el legado hacia fetch a cualquier URL con las
// credenciales de Twilio. Ahora se rechazan los hosts fuera del
// dominio de Twilio antes de hacer la peticion.

import { getEnv } from "@/lib/env";

export const MAX_MEDIA_BYTES = 7 * 1024 * 1024;

export interface FetchedMedia {
  buffer: Buffer;
  contentType: string;
}

// ---------- Allowlist de hosts (CWE-918 SSRF) ----------
// Twilio entrega los medios desde api.twilio.com y subdominios de
// twilio.com; el binario puede servirse desde S3. Se permite solo:
//   - *.twilio.com / twilio.com / api.twilio.com
//   - buckets S3 cuyo nombre empieza con "twilio" (*.s3.amazonaws.com)
// Cualquier otro host se rechaza con un error claro para evitar
// que un atacante use esta funcion como proxy SSRF.
const ALLOWED_HOST_EXACT = new Set<string>(["twilio.com", "api.twilio.com"]);
const ALLOWED_HOST_SUFFIX = ".twilio.com";
const S3_SUFFIX = ".s3.amazonaws.com";
const S3_BUCKET_PREFIX = "twilio";

function isAllowedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (ALLOWED_HOST_EXACT.has(host)) return true;
  if (host.endsWith(ALLOWED_HOST_SUFFIX) && host.length > ALLOWED_HOST_SUFFIX.length) return true;
  // Bucket S3 con nombre "twilio*": <bucket>.s3.amazonaws.com
  if (host.endsWith(S3_SUFFIX) && host.length > S3_SUFFIX.length) {
    const bucket = host.slice(0, host.length - S3_SUFFIX.length);
    if (bucket.startsWith(S3_BUCKET_PREFIX)) return true;
  }
  return false;
}

/**
 * Descarga un medio de Twilio usando Basic Auth con las credenciales
 * de la cuenta. Valida que el host pertenezca a Twilio antes de
 * fetchear (guard SSRF). Limita el tamanio a MAX_MEDIA_BYTES.
 */
export async function fetchTwilioMedia(url: string): Promise<FetchedMedia | null> {
  if (!url) return null;

  const env = getEnv();
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("twilio_media_auth_missing");
  }

  // --- Guard SSRF: solo hosts de Twilio ---
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("twilio_media_invalid_url");
  }
  if (!parsed.protocol || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
    throw new Error("twilio_media_invalid_url");
  }
  if (!isAllowedMediaHost(parsed.hostname)) {
    throw new Error("twilio_media_host_blocked");
  }

  const response = await fetch(url, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
    },
  });

  if (!response.ok) {
    throw new Error(`twilio_media_fetch_${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length > MAX_MEDIA_BYTES) {
    throw new Error("twilio_media_too_large");
  }

  return {
    buffer,
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}
