const { handleIncoming, redisplayStep } = require("../_lib/precali-flow");
const { defaultSession, getSession, kvConfigured, resetSession, saveSession } = require("../_lib/precali-memory");
const { readPreCaliDocument } = require("../_lib/precali-documents");
const { readImageFinancialDocument } = require("../_lib/precali-ocr");
const { fetchTwilioMedia } = require("../_lib/twilio-media");
const { sendContent, sendText } = require("../_lib/precali-twilio");
const { buildListaProducto, buildQuickReply, templatesConfigured } = require("../_lib/precali-content-templates");

const INTERACTIVE_AFTER_TEXT_DELAY_MS = Number(process.env.PRECALI_INTERACTIVE_DELAY_MS || 1800);

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlText(body) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(body)}</Message></Response>`;
}

function twimlEmpty() {
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePlainText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isGreetingReset(bodyText) {
  return /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches)$/i.test(normalizePlainText(bodyText));
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve("");
      return;
    }
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function parseParams(req, rawBody) {
  if (req.body && typeof req.body === "object") return req.body;
  return Object.fromEntries(new URLSearchParams(rawBody || ""));
}

function explicitCountryFromPhone(from) {
  // MVP: produccion enfocada solo en Costa Rica.
  // La data regional completa queda respaldada para una expansion futura.
  return "CR";
}

async function tryReadDocument(numMedia, mediaUrl, mediaType) {
  if (Number(numMedia || 0) <= 0 || !mediaUrl) return { text: "", note: "" };
  try {
    const media = await fetchTwilioMedia(mediaUrl);
    const contentType = mediaType || media.contentType;
    if (String(contentType || "").startsWith("image/")) {
      const result = await readImageFinancialDocument(media.buffer, contentType);
      if (result.ok && result.extractedText && result.extractedText.trim().length >= 15) {
        return { text: result.extractedText.trim().slice(0, 8000), note: "" };
      }
      return { text: "", note: result.message || "Recibi la imagen, pero no pude leer texto util. Intenta con una foto mas nitida o escribe los datos." };
    }
    const result = readPreCaliDocument(media.buffer, contentType);
    if (result.ok && result.extractedText && result.extractedText.trim().length >= 15) {
      return { text: result.extractedText.trim().slice(0, 8000), note: "" };
    }
    return {
      text: "",
      note: "Recibi un documento, pero no pude extraer texto util. Intenta con PDF seleccionable o escribe los datos directamente.",
    };
  } catch (_) {
    return {
      text: "",
      note: "No pude descargar el documento ahora. Intenta de nuevo en un momento o escribe los datos directamente.",
    };
  }
}

async function dispatchActions(actions, to, from) {
  if (!actions || !actions.length) return { twimlBody: null };

  const useInteractive = templatesConfigured() && Boolean(process.env.TWILIO_ACCOUNT_SID);
  const preTexts = [];
  let interactiveAction = null;
  let twimlTextBody = null;

  let lastInteractiveIdx = -1;
  for (let i = actions.length - 1; i >= 0; i--) {
    if (actions[i].kind === "list" || actions[i].kind === "buttons") {
      lastInteractiveIdx = i;
      break;
    }
  }

  if (lastInteractiveIdx >= 0) {
    for (let i = 0; i < lastInteractiveIdx; i++) {
      if (actions[i].kind === "text") preTexts.push(actions[i].body);
    }
    interactiveAction = actions[lastInteractiveIdx];
  } else {
    const textActions = actions.filter((action) => action.kind === "text");
    if (textActions.length > 1) {
      for (let i = 0; i < textActions.length - 1; i++) preTexts.push(textActions[i].body);
    }
    twimlTextBody = textActions[textActions.length - 1] ? textActions[textActions.length - 1].body : null;
  }

  if (useInteractive && preTexts.length) {
    for (const body of preTexts) {
      try {
        await sendText({ to, from, body });
      } catch (_) {}
    }
    if (interactiveAction && INTERACTIVE_AFTER_TEXT_DELAY_MS > 0) {
      await sleep(INTERACTIVE_AFTER_TEXT_DELAY_MS);
    }
  } else if (!useInteractive && preTexts.length && interactiveAction) {
    twimlTextBody = preTexts.join("\n\n");
  }

  if (interactiveAction && useInteractive) {
    try {
      if (interactiveAction.kind === "list") {
        const { contentSid, contentVariables } = buildListaProducto();
        await sendContent({ to, from, contentSid, contentVariables });
      } else {
        const { contentSid, contentVariables } = buildQuickReply(interactiveAction.body, interactiveAction.options);
        await sendContent({ to, from, contentSid, contentVariables });
      }
      return { twimlBody: null };
    } catch (_) {
      twimlTextBody = buildFallbackText(interactiveAction);
    }
  } else if (interactiveAction && !useInteractive) {
    twimlTextBody = (preTexts.length ? preTexts.join("\n\n") + "\n\n" : "") + buildFallbackText(interactiveAction);
  }

  return { twimlBody: twimlTextBody };
}

function buildFallbackText(action) {
  if (!action) return "";
  const options = (action.options || [])
    .filter((option) => option.id !== "na")
    .map((option, index) => `${index + 1}. ${option.title}`)
    .join("\n");
  return `${action.body}\n\n${options}\n\nResponde con el numero o el texto de la opcion.`;
}

function resolveButtonFromText(bodyText, session) {
  if (!bodyText) return null;
  const text = bodyText.trim().toLowerCase();
  const step = session && session.step;

  const maps = {
    pedir_producto: { "1": "personal", "2": "vehiculo", "3": "hipoteca" },
    post_resultado: { "1": "aplicar", "2": "requisitos", "3": "ahora_no" },
    elegir_banco_aplicar: { "1": "banco_0", "2": "banco_1", "3": "banco_2" },
    elegir_banco_requisitos: { "1": "banco_0", "2": "banco_1", "3": "banco_2" },
    lead_fuente_ingresos: { "1": "asalariado", "2": "independiente", "3": "duda" },
    autorizar_soft_precali: { "1": "soft_precali_si", "2": "duda", "3": "soft_precali_no" },
    confirmar_datos_extraidos: { "1": "datos_ok", "2": "datos_corregir", "3": "duda" },
    confirmar_hard_pull: { "1": "hard_si", "2": "duda", "3": "hard_no" },
  };
  if (maps[step] && maps[step][text]) return maps[step][text];

  if (/^(si|sí|dale|ok|claro|de acuerdo|autorizo|acepto|vamos|va)$/i.test(text)) {
    if (step === "post_resultado") return "aplicar";
    if (step === "autorizar_soft_precali") return "soft_precali_si";
    if (step === "confirmar_datos_extraidos") return "datos_ok";
    if (step === "confirmar_hard_pull") return "hard_si";
  }
  if (/^(no|mejor no|ahora no|luego|despues|después)$/i.test(text)) {
    if (step === "post_resultado") return "ahora_no";
    if (step === "autorizar_soft_precali") return "soft_precali_no";
    if (step === "confirmar_hard_pull") return "hard_no";
  }
  if (/asalariad|emplead|planilla/i.test(text)) return "asalariado";
  if (/independ|negocio|freelance|propio/i.test(text)) return "independiente";
  if (/requisito|documento/i.test(text) && step === "post_resultado") return "requisitos";
  if (/aplicar/i.test(text) && step === "post_resultado") return "aplicar";
  return null;
}

function commandName(bodyText) {
  const match = String(bodyText || "").trim().match(/^\/([a-z0-9_-]+)\b/i);
  return match ? match[1].toLowerCase() : "";
}

function displayAmount(value, currency) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  return `${currency || "CRC"} ${n.toLocaleString("es-CR")}`;
}

function productName(product) {
  if (product === "vehiculo") return "vehiculo";
  if (product === "hipoteca") return "vivienda";
  if (product === "personal") return "personal";
  return "sin definir";
}

function buildCommandsText() {
  return [
    "*Comandos tecnicos PreCali*",
    "/reset - borra la memoria de este chat y reinicia el flujo.",
    "/status - muestra paso actual y perfil detectado.",
    "/instructions - muestra la logica del bot.",
    "/replay - repite la pregunta o botones del paso actual.",
    "/ping - confirma que el webhook responde.",
    "/commands - muestra esta lista.",
  ].join("\n");
}

function buildInstructionsText() {
  return [
    "*Logica de PreCali IA*",
    "1. Mercado activo: Costa Rica.",
    "2. Usa CRC por defecto; si el usuario dice dolares, usa USD.",
    "3. Capacidad = ingreso x ratio del banco - deudas.",
    "4. Monto maximo = cuota posible con tasa y plazo del banco.",
    "5. Si hay prima o valor del bien, limita por financiamiento maximo.",
    "6. Tasas, bancos y requisitos salen de data.js; no se inventan.",
    "7. Despues de comparar, guia a aplicar, requisitos o pausar.",
    "8. La memoria dura hasta 30 dias si Upstash/KV esta activo.",
  ].join("\n");
}

function buildStatusText(session, defaultCountry) {
  const profile = session.profile || {};
  const currency = profile.currency || (defaultCountry === "CR" ? "CRC" : "");
  const results = session.lastResults && Array.isArray(session.lastResults.opciones)
    ? session.lastResults.opciones.length
    : 0;

  return [
    "*Estado tecnico PreCali*",
    `Memoria: ${kvConfigured() ? "Upstash/KV activo" : "fallback local"}`,
    `Version estado: ${session.version || "sin version"}`,
    `Paso: ${session.step || "inicio"}`,
    `Pais: ${profile.country || defaultCountry || "CR"}`,
    `Moneda: ${currency || "sin definir"}`,
    `Producto: ${productName(profile.product)}`,
    `Ingreso: ${displayAmount(profile.income, currency)}`,
    `Deudas: ${displayAmount(profile.debt, currency)}`,
    `Prima: ${displayAmount(profile.downPayment, currency)}`,
    `Banco objetivo: ${session.targetBank || "ninguno"}`,
    `Opciones calculadas: ${results}`,
  ].join("\n");
}

async function handleTechCommand({ command, session, from, defaultCountry }) {
  if (!command) return null;

  if (command === "reset") {
    await resetSession(from);
    const fresh = defaultSession();
    const started = await handleIncoming({ session: fresh, bodyText: "", buttonPayload: "", buttonText: "", defaultCountry });
    return {
      actions: [ { kind: "text", body: "Memoria reiniciada para este chat." }, ...started.actions ],
      session: started.session,
    };
  }

  if (command === "instructions") {
    return { actions: [{ kind: "text", body: buildInstructionsText() }], session };
  }

  if (command === "status" || command === "debug") {
    return { actions: [{ kind: "text", body: buildStatusText(session, defaultCountry) }], session };
  }

  if (command === "replay") {
    return { actions: redisplayStep(session), session };
  }

  if (command === "ping") {
    return { actions: [{ kind: "text", body: `pong. Memoria: ${kvConfigured() ? "Upstash/KV activo" : "fallback local"}.` }], session };
  }

  if (command === "commands" || command === "help") {
    return { actions: [{ kind: "text", body: buildCommandsText() }], session };
  }

  return {
    actions: [{ kind: "text", body: `Comando no reconocido: /${command}\n\n${buildCommandsText()}` }],
    session,
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, name: "PreCali IA WhatsApp guided flow" }));
    return;
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, POST");
    res.end("Method Not Allowed");
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    const params = parseParams(req, rawBody);
    const from = params.From || "";
    const toNumber = params.To || "";
    const bodyText = String(params.Body || "").trim();
    const numMedia = params.NumMedia;
    const mediaUrl = params.MediaUrl0;
    const mediaType = params.MediaContentType0;
    const buttonPayload = params.ButtonPayload || params.ListId || null;
    const buttonText = params.ButtonText || null;
    const defaultCountry = explicitCountryFromPhone(from);
    const session = await getSession(from);
    const techCommand = commandName(bodyText);

    if (techCommand) {
      const commandResult = await handleTechCommand({ command: techCommand, session, from, defaultCountry });
      const { twimlBody } = await dispatchActions(commandResult.actions, from, toNumber);
      await saveSession(from, commandResult.session);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml; charset=utf-8");
      res.end(twimlBody ? twimlText(twimlBody) : twimlEmpty());
      return;
    }

    if (!buttonPayload && Number(numMedia || 0) <= 0 && session.step !== "inicio" && isGreetingReset(bodyText)) {
      await resetSession(from);
      const fresh = defaultSession();
      const started = await handleIncoming({ session: fresh, bodyText: "", buttonPayload: "", buttonText: "", defaultCountry });
      const actions = [{ kind: "text", body: "Listo, reiniciamos la conversacion." }, ...started.actions];
      const { twimlBody } = await dispatchActions(actions, from, toNumber);
      await saveSession(from, started.session);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml; charset=utf-8");
      res.end(twimlBody ? twimlText(twimlBody) : twimlEmpty());
      return;
    }

    let effectiveBodyText = bodyText;
    let effectiveButtonPayload = buttonPayload;

    if (Number(numMedia || 0) > 0) {
      const doc = await tryReadDocument(numMedia, mediaUrl, mediaType);
      if (doc.text) {
        effectiveBodyText = `[DOCUMENTO_RECIBIDO]\n${doc.text}`;
        effectiveButtonPayload = null;
      } else if (doc.note) {
        effectiveBodyText = doc.note;
      }
    }

    if (!effectiveButtonPayload && effectiveBodyText) {
      effectiveButtonPayload = resolveButtonFromText(effectiveBodyText, session);
    }

    const { actions, session: newSession } = await handleIncoming({
      session,
      bodyText: effectiveBodyText,
      buttonPayload: effectiveButtonPayload,
      buttonText,
      defaultCountry,
    });

    const { twimlBody } = await dispatchActions(actions, from, toNumber);
    await saveSession(from, newSession);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    res.end(twimlBody ? twimlText(twimlBody) : twimlEmpty());
  } catch (_) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    res.end(twimlText("PreCali tuvo un problema. Intenta de nuevo en unos segundos."));
  }
};
