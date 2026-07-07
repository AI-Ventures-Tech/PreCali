// ============================================================
// PreCali AI — Plantillas de contenido interactivo
// ============================================================
// Port fiel de `api/_lib/precali-content-templates.js` (CommonJS → TypeScript).
//
// Usa los Content SID creados una sola vez con
// scripts/setup-twilio-content.js (guardados como variables de
// entorno). Esta capa arma el "contentVariables" correcto para
// cada momento de la conversacion.

import { getEnv } from "@/lib/env";
import type { ButtonOption } from "@/lib/whatsapp/types";

/** Payload para enviar un Content Template por la REST API de Twilio. */
export interface ContentTemplatePayload {
  contentSid: string;
  contentVariables: Record<string, string>;
}

function listProductoSid(): string {
  return getEnv().TWILIO_CONTENT_LIST_PRODUCTO || "";
}

function quickReplySid(): string {
  return getEnv().TWILIO_CONTENT_QR_GENERICO || "";
}

/** true solo cuando el Content SID del quick reply generico esta configurado. */
export function templatesConfigured(): boolean {
  return Boolean(quickReplySid());
}

// Compatibilidad: el inicio ahora usa quick reply, no list-picker.
export function buildListaProducto(): ContentTemplatePayload {
  return {
    contentSid: quickReplySid() || listProductoSid(),
    contentVariables: {
      "1": "Hola! Soy *PreCali AI*, tu asesor de credito. Que queres simular hoy?",
      "2": "personal",
      "3": "Personal",
      "4": "vehiculo",
      "5": "Vehiculo",
      "6": "hipoteca",
      "7": "Vivienda",
    },
  };
}

// Arma un envio de menu de 3 botones, siempre con la misma forma:
// texto + boton1/boton2/boton3. options = [{ id, title }, { id, title }, { id, title }]
export function buildQuickReply(
  bodyText: string,
  options: ButtonOption[],
): ContentTemplatePayload {
  const padded = options.slice(0, 3);
  while (padded.length < 3) padded.push({ id: "na", title: "—" });

  return {
    contentSid: quickReplySid(),
    contentVariables: {
      "1": bodyText,
      "2": padded[0].id,
      "3": padded[0].title,
      "4": padded[1].id,
      "5": padded[1].title,
      "6": padded[2].id,
      "7": padded[2].title,
    },
  };
}
