// ============================================================
// PreCali AI — Cliente REST de Twilio
// ============================================================
// Port fiel de `api/_lib/precali-twilio.js` (CommonJS → TypeScript).
//
// TwiML (la respuesta sincronica al webhook) solo permite texto
// plano. Para enviar listas o botones interactivos hay que usar
// la API REST de Mensajes de Twilio de forma proactiva. Este
// modulo encapsula esas dos formas de envio.
//
// Usa `fetch` directo contra la REST API de Twilio (igual que el
// legado): no depende del paquete npm `twilio`.

import { getEnv } from "@/lib/env";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

/** Respuesta de la REST API de Messages de Twilio (campos sueltos). */
export interface TwilioMessageResponse {
  sid?: string;
  status?: string;
  body?: string;
  error_code?: string | number | null;
  error_message?: string | null;
  [key: string]: unknown;
}

export interface SendTextParams {
  to: string;
  from: string;
  body: string;
}

export interface SendContentParams {
  to: string;
  from: string;
  contentSid: string;
  /** Objeto plano { "1": "valor", "2": "valor" } → se serializa a JSON. */
  contentVariables?: Record<string, string>;
}

/**
 * Error al enviar un mensaje por la REST API de Twilio.
 * Mantiene el `.body` (hasta 500 chars) que el legado adjuntaba al Error.
 */
export class TwilioSendError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`twilio_send_${status}`);
    this.name = "TwilioSendError";
    this.status = status;
    this.body = body;
  }
}

function twilioCredentials(): { sid: string; token: string } {
  const env = getEnv();
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("twilio_credentials_missing");
  return { sid, token };
}

function authHeader(): string {
  const { sid, token } = twilioCredentials();
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

async function postMessage(params: Record<string, string>): Promise<TwilioMessageResponse> {
  const { sid } = twilioCredentials();
  const body = new URLSearchParams(params);

  const response = await fetch(`${TWILIO_API_BASE}/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new TwilioSendError(response.status, raw.slice(0, 500));
  }
  return JSON.parse(raw) as TwilioMessageResponse;
}

// Envia texto plano (se usa poco ahora; la mayoria de los pasos de
// texto se responden directo por TwiML, que es mas rapido).
export async function sendText({ to, from, body }: SendTextParams): Promise<TwilioMessageResponse> {
  return postMessage({ To: to, From: from, Body: body });
}

// Envia un mensaje basado en un Content Template (lista o botones).
// contentVariables es un objeto plano { "1": "valor", "2": "valor" }.
export async function sendContent({
  to,
  from,
  contentSid,
  contentVariables,
}: SendContentParams): Promise<TwilioMessageResponse> {
  const params: Record<string, string> = { To: to, From: from, ContentSid: contentSid };
  if (contentVariables && Object.keys(contentVariables).length) {
    params.ContentVariables = JSON.stringify(contentVariables);
  }
  return postMessage(params);
}
