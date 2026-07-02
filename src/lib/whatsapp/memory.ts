// ============================================================
// PreCali AI — Memoria de conversacion (hasta 30 dias)
// ============================================================
// Port fiel de `api/_lib/precali-memory.js` (CommonJS → TypeScript).
//
// Guarda el ESTADO COMPLETO de la conversacion por numero de
// telefono: en que paso del flujo guiado va, los datos ya
// recolectados (perfil), los ultimos resultados calculados, y un
// historial corto para que la IA pueda resolver dudas con
// contexto.
//
// Backend: Vercel KV / Upstash Redis (HTTP REST, sin SDK) si esta
// configurado (KV_REST_API_URL + KV_REST_API_TOKEN, que Vercel
// agrega automaticamente al instalar el addon "Upstash for
// Redis"/"Vercel KV"). Se aceptan tambien las vars nativas de
// Upstash (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
// Si no hay KV configurado, cae a memoria del proceso (se pierde
// al reiniciar la funcion) para que el bot siga funcionando igual
// mientras se configura.

import { getEnv } from "@/lib/env";
import {
  SESSION_VERSION,
  type Profile,
  type Lead,
  type Session,
  type SessionStep,
} from "@/lib/whatsapp/types";

export { SESSION_VERSION };

export const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dias
export const MAX_AI_HISTORY = 12; // mensajes recientes para la IA (no toda la conversacion)
export const KEY_PREFIX = "precali:conv:";

/** Lista canonica de pasos validos (fuente de verdad: `SessionStep`). */
export const VALID_STEPS: ReadonlySet<SessionStep> = new Set<SessionStep>([
  "inicio",
  "pedir_ingreso",
  "pedir_deudas",
  "pedir_prima",
  "post_resultado",
  "elegir_banco_aplicar",
  "elegir_banco_requisitos",
  "lead_datos",
  "lead_fuente_ingresos",
  "esperar_documentos",
  "autorizar_soft_precali",
  "confirmar_datos_extraidos",
  "corregir_datos_extraidos",
  "confirmar_hard_pull",
  "aplicado",
  "pausado",
]);

const DEFAULT_PROFILE: Profile = {
  country: "",
  currency: "",
  product: "",
  income: 0,
  debt: 0,
  downPayment: 0,
  assetValue: 0,
  requestedYears: 0,
};

const DEFAULT_LEAD: Lead = {
  fullName: "",
  idNumber: "",
  email: "",
  incomeSource: "",
  phoneOverride: "",
};

// ---------- Configuracion KV ----------

function kvUrl(): string {
  const env = getEnv();
  return env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || "";
}

function kvToken(): string {
  const env = getEnv();
  return env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || "";
}

/** true solo cuando hay URL + token de KV/Upstash disponibles. */
export function kvConfigured(): boolean {
  return Boolean(kvUrl() && kvToken());
}

interface UpstashResponse {
  result?: string | null;
}

async function kvCommand(command: unknown[]): Promise<UpstashResponse> {
  const response = await fetch(kvUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`kv_${response.status}`);
  return (await response.json()) as UpstashResponse;
}

// ---------- Respaldo en memoria (si no hay KV configurado) ----------

interface MemoryEntry {
  session: Session;
  ts: number;
}

const memoryStore = new Map<string, MemoryEntry>();

function memoryCleanup(): void {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (!value || now - value.ts > TTL_SECONDS * 1000) memoryStore.delete(key);
  }
}

function memoryGet(phone: string): Session | null {
  memoryCleanup();
  const entry = memoryStore.get(phone);
  return entry ? entry.session : null;
}

function memorySet(phone: string, session: Session): void {
  memoryCleanup();
  memoryStore.set(phone, { session, ts: Date.now() });
}

function memoryDelete(phone: string): void {
  memoryStore.delete(phone);
}

// ---------- Sanitizacion de clave (CWE-89 analogue) ----------
// La clave se arma SOLO a partir de digitos del numero de telefono:
// nunca se concatena input arbitrario al prefijo de clave.

function digitsOnly(phone: unknown): string {
  if (typeof phone !== "string" && typeof phone !== "number") return "";
  return String(phone).replace(/\D+/g, "");
}

// ---------- Helpers de normalizacion ----------

function cleanNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

// ---------- API publica ----------

export function defaultSession(): Session {
  return {
    version: SESSION_VERSION,
    step: "inicio",
    profile: { ...DEFAULT_PROFILE },
    lastResults: null,
    targetBank: null,
    lead: { ...DEFAULT_LEAD },
    documentText: "",
    extractedSummary: "",
    correctionNote: "",
    aiHistory: [],
    updatedAt: Date.now(),
  };
}

export function normalizeProfile(profile: unknown): Profile {
  const source = asObject(profile);
  const merged: Profile = { ...DEFAULT_PROFILE, ...(source as Partial<Profile> | undefined) };
  return {
    ...merged,
    country: String(merged.country || ""),
    currency: String(merged.currency || ""),
    product: String(merged.product || ""),
    income: cleanNumber(merged.income),
    debt: cleanNumber(merged.debt),
    downPayment: cleanNumber(merged.downPayment),
    assetValue: cleanNumber(merged.assetValue),
    requestedYears: cleanNumber(merged.requestedYears),
  };
}

export function normalizeLead(lead: unknown): Lead {
  const source = asObject(lead);
  const merged: Lead = { ...DEFAULT_LEAD, ...(source as Partial<Lead> | undefined) };
  return {
    ...merged,
    fullName: String(merged.fullName || ""),
    idNumber: String(merged.idNumber || ""),
    email: String(merged.email || ""),
    incomeSource: String(merged.incomeSource || ""),
    phoneOverride: String(merged.phoneOverride || ""),
  };
}

export function normalizeSession(session: unknown): Session {
  const base = defaultSession();
  const source = asObject(session);
  const stepCandidate = source?.step;
  const step: SessionStep =
    typeof stepCandidate === "string" && (VALID_STEPS as Set<string>).has(stepCandidate)
      ? (stepCandidate as SessionStep)
      : base.step;
  const aiHistory: unknown[] = Array.isArray(source?.aiHistory)
    ? source!.aiHistory.slice(-MAX_AI_HISTORY)
    : [];
  const updatedAtRaw = Number(source?.updatedAt);
  const updatedAt =
    Number.isFinite(updatedAtRaw) && updatedAtRaw > 0 ? updatedAtRaw : Date.now();

  // Mirror fiel del legado: {...base, ...source} + overrides explicitos.
  const merged = { ...base, ...(source ?? {}) } as Session;

  return {
    ...merged,
    version: SESSION_VERSION,
    step,
    profile: normalizeProfile(source?.profile),
    lead: normalizeLead(source?.lead),
    aiHistory,
    updatedAt,
  };
}

export async function getSession(phone: unknown): Promise<Session> {
  const digits = digitsOnly(phone);
  if (!digits) return defaultSession();
  const key = KEY_PREFIX + digits;

  if (kvConfigured()) {
    try {
      const data = await kvCommand(["GET", key]);
      if (data && data.result) {
        const parsed = JSON.parse(data.result) as unknown;
        return normalizeSession(parsed);
      }
      return defaultSession();
    } catch {
      const fallback = memoryGet(digits);
      return fallback ? normalizeSession(fallback) : defaultSession();
    }
  }

  const fallback = memoryGet(digits);
  return fallback ? normalizeSession(fallback) : defaultSession();
}

export async function saveSession(phone: unknown, session: unknown): Promise<void> {
  const digits = digitsOnly(phone);
  if (!digits) return;
  const toSave = normalizeSession({ ...(asObject(session) ?? {}), updatedAt: Date.now() });
  const key = KEY_PREFIX + digits;

  if (kvConfigured()) {
    try {
      await kvCommand(["SETEX", key, TTL_SECONDS, JSON.stringify(toSave)]);
      return;
    } catch {
      // si KV falla, al menos guardamos en memoria de esta instancia
    }
  }

  memorySet(digits, toSave);
}

export async function resetSession(phone: unknown): Promise<void> {
  const digits = digitsOnly(phone);
  if (!digits) return;
  const key = KEY_PREFIX + digits;
  if (kvConfigured()) {
    try {
      await kvCommand(["DEL", key]);
    } catch {
      // no-op
    }
  }
  memoryDelete(digits);
}
