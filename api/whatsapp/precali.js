const { handleIncoming, redisplayStep, manejarDuda } = require("../_lib/precali-flow");
const { getSession, saveSession, resetSession } = require("../_lib/precali-memory");
const { readPreCaliDocument } = require("../_lib/precali-documents");
const { fetchTwilioMedia } = require("../_lib/twilio-media");
const { sendContent, sendText } = require("../_lib/precali-twilio");
const { buildListaProducto, buildQuickReply, templatesConfigured } = require("../_lib/precali-content-templates");

// ============================================================
// PreCali AI — Webhook de WhatsApp
// ============================================================
// Flujo:
// 1. Lee el mensaje/documento de Twilio.
// 2. Carga la sesion del usuario (KV o memoria).
// 3. Le pasa todo a la maquina de estados (precali-flow.js).
// 4. Ejecuta las acciones resultantes:
//    - "text"    → respuesta sincrona por TwiML (mas rapido)
//    - "list"    → API REST de Twilio con Content Template
//    - "buttons" → API REST de Twilio con Content Template
//    Solo el ULTIMO mensaje de texto va en el TwiML response;
//    todo lo anterior se envia de forma proactiva por REST.
// 5. Guarda la sesion actualizada.

function escapeXml(v) {
  return String(v || "")
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

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") { resolve(""); return; }
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function parseParams(req, rawBody) {
  if (req.body && typeof req.body === "object") return req.body;
  return Object.fromEntries(new URLSearchParams(rawBody || ""));
}

function explicitCountryFromPhone(from) {
  const p = String(from || "").replace(/^whatsapp:/i, "").replace(/[^\d+]/g, "");
  if (p.startsWith("+506")) return "CR";
  if (p.startsWith("+507")) return "PA";
  if (p.startsWith("+502")) return "GT";
  if (p.startsWith("+504")) return "HN";
  if (p.startsWith("+505")) return "NI";
  if (p.startsWith("+503")) return "SV";
  if (p.startsWith("+521") || p.startsWith("+52")) return "MX";
  return "CR";
}

async function tryReadDocument(numMedia, mediaUrl, mediaType) {
  if (Number(numMedia || 0) <= 0 || !mediaUrl) return { text: "", note: "" };
  try {
    const media = await fetchTwilioMedia(mediaUrl);
    const ctype = mediaType || media.contentType;
    if (String(ctype).startsWith("image/")) {
      return {
        text: "",
        note: "[La persona envió una imagen. Pedile que mande el documento como PDF, DOCX o CSV con texto, o que escriba los datos directamente.]",
      };
    }
    const result = readPreCaliDocument(media.buffer, ctype);
    if (result.ok && result.extractedText && result.extractedText.trim().length >= 15) {
      return { text: result.extractedText.trim().slice(0, 8000), note: "" };
    }
    return { text: "", note: "[Recibí un documento pero no pude extraer texto. Intentá con PDF seleccionable o escribí los datos directamente.]" };
  } catch (_) {
    return { text: "", note: "[No pude descargar el documento ahora. Intentá de nuevo en un momento o escribí los datos directamente.]" };
  }
}

// Divide las acciones: las que van por REST (asincronicas, no caben en TwiML)
// y el ultimo texto plano que va en el TwiML síncrono.
// Regla simple: list y buttons siempre van por REST. Los texts intermedios
// también van por REST, solo el último va en TwiML (ahorra un round trip).
async function dispatchActions(actions, to, from) {
  if (!actions || !actions.length) return { twimlBody: null };

  const useInteractive = templatesConfigured() && Boolean(process.env.TWILIO_ACCOUNT_SID);

  // Separar textos intermedios, el interactive final, y el texto TwiML.
  const preTexts = [];
  let interactiveAction = null;
  let twimlTextBody = null;

  // Buscamos el ultimo mensaje interactivo (list o buttons); todo lo que
  // va antes de el es texto introductorio que mandamos por REST.
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
    // Solo textos: el ultimo va en TwiML, los demas por REST.
    const textActions = actions.filter((a) => a.kind === "text");
    if (textActions.length > 1) {
      for (let i = 0; i < textActions.length - 1; i++) preTexts.push(textActions[i].body);
    }
    twimlTextBody = textActions[textActions.length - 1]
      ? textActions[textActions.length - 1].body
      : null;
  }

  // Enviar textos previos por REST
  if (useInteractive && preTexts.length) {
    for (const body of preTexts) {
      try { await sendText({ to, from, body }); } catch (_) {}
    }
  } else if (!useInteractive && preTexts.length) {
    // Sin REST configurado: combinar todos en un solo TwiML
    if (interactiveAction) {
      twimlTextBody = preTexts.join("\n\n");
    }
  }

  // Enviar el mensaje interactivo por REST
  if (interactiveAction && useInteractive) {
    try {
      if (interactiveAction.kind === "list") {
        const { contentSid, contentVariables } = buildListaProducto();
        await sendContent({ to, from, contentSid, contentVariables });
      } else if (interactiveAction.kind === "buttons") {
        const { contentSid, contentVariables } = buildQuickReply(
          interactiveAction.body,
          interactiveAction.options
        );
        await sendContent({ to, from, contentSid, contentVariables });
      }
      return { twimlBody: null };
    } catch (_) {
      // Si falla el envio interactivo, caemos a texto plano como fallback
      twimlTextBody = buildFallbackText(interactiveAction);
    }
  } else if (interactiveAction && !useInteractive) {
    // Sin plantillas: convertimos lista/botones a texto plano
    twimlTextBody = (preTexts.length ? preTexts.join("\n\n") + "\n\n" : "") + buildFallbackText(interactiveAction);
  }

  return { twimlBody: twimlTextBody };
}

function buildFallbackText(action) {
  if (!action) return "";
  if (action.kind === "list") {
    return "¿Qué tipo de crédito te interesa?\n1. Crédito personal\n2. Crédito vehicular\n3. Crédito de vivienda\n\nRespondé con el número o el nombre.";
  }
  if (action.kind === "buttons") {
    const opts = action.options
      .filter((o) => o.id !== "na")
      .map((o, i) => `${i + 1}. ${o.title}`)
      .join("\n");
    return `${action.body}\n\n${opts}\n\nRespondé con el número o el texto de la opción.`;
  }
  return "";
}

// Interpreta si un texto libre matchea un boton de la sesion anterior
function resolveButtonFromText(bodyText, session) {
  if (!bodyText) return null;
  const t = bodyText.trim().toLowerCase();

  // Atajos numericos universales para cuando no hay botones interactivos
  const numMap = { "1": null, "2": null, "3": null };
  if (session.step === "confirmar_soft_pull") {
    numMap["1"] = "soft_si"; numMap["2"] = "duda"; numMap["3"] = "soft_no";
  } else if (session.step === "post_resultado") {
    numMap["1"] = "aplicar"; numMap["2"] = "duda"; numMap["3"] = "otro";
  } else if (session.step === "confirmar_hard_pull") {
    numMap["1"] = "hard_si"; numMap["2"] = "duda"; numMap["3"] = "hard_no";
  }
  if (numMap[t]) return numMap[t];

  // Atajos de texto libre para confirmaciones comunes
  if (/^(si|sí|dale|ok|claro|de acuerdo|autorizo|acepto|vamos|va)$/i.test(t)) {
    if (session.step === "confirmar_soft_pull") return "soft_si";
    if (session.step === "confirmar_hard_pull") return "hard_si";
    if (session.step === "post_resultado") return "aplicar";
  }
  if (/^(no|mejor no|ahora no|luego|despues|después)$/i.test(t)) {
    if (session.step === "confirmar_soft_pull") return "soft_no";
    if (session.step === "confirmar_hard_pull") return "hard_no";
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, name: "PreCali AI — WhatsApp bot v2 (flujo guiado)" }));
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

    // ButtonPayload y ButtonText vienen de los mensajes interactivos de Twilio
    const buttonPayload = params.ButtonPayload || params.ListId || null;
    const buttonText = params.ButtonText || null;

    const defaultCountry = explicitCountryFromPhone(from);
    const session = await getSession(from);

    // Si hay documento adjunto, extraemos texto y lo metemos al flujo
    let documentNote = "";
    let documentText = "";
    if (Number(numMedia || 0) > 0) {
      const doc = await tryReadDocument(numMedia, mediaUrl, mediaType);
      documentText = doc.text;
      documentNote = doc.note;
    }

    // Si hay texto de documento, lo procesamos como un mensaje especial
    // dentro del paso actual (para leer ingresos de una orden patronal, etc.)
    let effectiveBodyText = bodyText;
    let effectiveButtonPayload = buttonPayload;

    if (documentText) {
      // Avisamos lo que leimos, pedimos confirmacion, y re-mostramos el paso
      const preview = documentText.slice(0, 300);
      const { message, aiHistory } = await manejarDuda({
        session,
        userText: `[Documento adjunto recibido]\n${preview}\n\nEl usuario acaba de subir un documento. Extraé del texto cualquier dato financiero relevante (ingreso, deudas, patrono, nombre) y presentaselos en un mensaje corto y amigable para que confirmen si es correcto. No hagas la simulacion todavia.`,
      });
      const newSession = { ...session, aiHistory };
      const redisplayActions = redisplayStep(newSession);
      const { twimlBody } = await dispatchActions(
        [{ kind: "text", body: message }, ...redisplayActions],
        from, toNumber
      );
      await saveSession(from, newSession);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml; charset=utf-8");
      res.end(twimlBody ? twimlText(twimlBody) : twimlEmpty());
      return;
    }

    if (documentNote) {
      effectiveBodyText = documentNote;
    }

    // Resolver el payload del boton (si hay texto escrito en vez de boton)
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
  } catch (_error) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    res.end(twimlText("PreCali tuvo un problema. Intentá de nuevo en unos segundos."));
  }
};
