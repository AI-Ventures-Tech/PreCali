// PreCali — tipos del bot de WhatsApp (scaffold para S11–S15).
// Port fiel de api/_lib/precali-memory.js (Session/Profile/Lead) y precali-flow.js (Action).

import type { PaisId } from "@/types/precali";
import type { RiskLevel } from "@/types/buro";

export const SESSION_VERSION = 2 as const;

export type SessionStep =
  | "inicio"
  | "pedir_producto"
  | "pedir_ingreso"
  | "pedir_deudas"
  | "pedir_prima"
  | "post_resultado"
  | "elegir_banco_aplicar"
  | "elegir_banco_requisitos"
  | "lead_datos"
  | "lead_fuente_ingresos"
  | "esperar_documentos"
  | "autorizar_soft_precali"
  | "confirmar_datos_extraidos"
  | "corregir_datos_extraidos"
  | "confirmar_hard_pull"
  | "aplicado"
  | "pausado";

export interface Profile {
  country: string;
  currency: string;
  product: string;
  income: number;
  debt: number;
  downPayment: number;
  assetValue: number;
  requestedYears: number;
}

export interface Lead {
  fullName: string;
  idNumber: string;
  email: string;
  incomeSource: string;
  phoneOverride: string;
}

export interface Session {
  version: typeof SESSION_VERSION;
  step: SessionStep;
  profile: Profile;
  lastResults: unknown | null;
  targetBank: string | null;
  lead: Lead;
  // INV-4 (CWE-359): only the level is persisted — score, sugefCategory, ratio and
  // other EngineResult fields are computed in stepLeadDatos and discarded before
  // saveSession. The bot only needs `level` in subsequent turns.
  buroLevel: RiskLevel | null;
  documentText: string;
  extractedSummary: string;
  correctionNote: string;
  aiHistory: unknown[];
  updatedAt: number;
}

/** Acciones que el flow devuelve para que el webhook las despache a Twilio. */
export type Action =
  | { kind: "text"; body: string }
  | { kind: "buttons"; body: string; options: ButtonOption[] }
  | { kind: "lista"; body: string; sections?: ListaSection[] };

export interface ButtonOption {
  id: string;
  title: string;
  description?: string;
}

export interface ListaSection {
  title: string;
  rows: { id: string; title: string; description?: string }[];
}

/** Mensaje entrante normalizado desde el webhook de Twilio. */
export interface IncomingMessage {
  session: Session;
  bodyText: string;
  buttonPayload?: string;
  buttonText?: string;
  defaultCountry: PaisId;
}

export interface HandleIncomingResult {
  actions: Action[];
  session: Session;
}
