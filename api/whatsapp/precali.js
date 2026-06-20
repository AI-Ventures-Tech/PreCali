const { readPreCaliDocument } = require("../_lib/precali-documents");
const { fetchTwilioMedia } = require("../_lib/twilio-media");
const { runAgentTurn } = require("../_lib/precali-agent");
const { getHistory, saveHistory, resetHistory } = require("../_lib/precali-memory");

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(message) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
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
  const phone = String(from || "").replace(/^whatsapp:/i, "").replace(/[^\d+]/g, "");
  if (phone.startsWith("+506")) return "CR";
  if (phone.startsWith("+507")) return "PA";
  if (phone.startsWith("+502")) return "GT";
  if (phone.startsWith("+504")) return "HN";
  if (phone.startsWith("+505")) return "NI";
  if (phone.startsWith("+503")) return "SV";
  if (phone.startsWith("+521")) return "MX";
  if (phone.startsWith("+52")) return "MX";
  return "";
}

async function extractDocumentText(input) {
  if (Number(input.numMedia || 0) <= 0 || !input.mediaUrl) return { text: "", note: "" };

  try {
    const media = await fetchTwilioMedia(input.mediaUrl);
    const contentType = input.mediaType || media.contentType;

    if (String(contentType || "").startsWith("image/")) {
      return {
        text: "",
        note:
          "[La persona envio una foto/imagen. El sistema todavia no puede leer imagenes automaticamente. " +
          "Pedile amablemente que mande el documento como PDF, DOCX o CSV con texto, o que escriba los datos directamente.]",
      };
    }

    const result = readPreCaliDocument(media.buffer, contentType);
    if (!result.extractedText || result.extractedText.trim().length < 15) {
      return {
        text: "",
        note:
          "[La persona mando un documento adjunto, pero no se pudo extraer texto util de el. " +
          "Pedile que lo reenvie como PDF o DOCX con texto seleccionable, o que escriba los datos directamente.]",
      };
    }

    return { text: result.extractedText, note: "" };
  } catch (_) {
    return {
      text: "",
      note:
        "[La persona mando un documento adjunto, pero no se pudo descargar/leer en este momento. " +
        "Pedile que lo intente de nuevo en unos minutos, o que escriba los datos directamente.]",
    };
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, name: "PreCali AI - asesor crediticio por WhatsApp" }));
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
    const input = {
      body: params.Body,
      from: params.From,
      numMedia: params.NumMedia,
      mediaUrl: params.MediaUrl0,
      mediaType: params.MediaContentType0,
    };

    const bodyText = String(input.body || "").trim();
    if (/^(reset|reiniciar|borrar memoria|nuevo chat)$/i.test(bodyText)) {
      resetHistory(input.from);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml; charset=utf-8");
      res.end(twiml("Listo, reinicie la conversacion. Soy *PreCali AI*. Que queres precalificar: casa, carro o prestamo personal?"));
      return;
    }

    const defaultCountry = explicitCountryFromPhone(input.from);
    const { text: documentText, note } = await extractDocumentText(input);
    const userText = note ? `${note}\n${bodyText}`.trim() : bodyText;
    const history = getHistory(input.from);
    const { message, history: newHistory } = await runAgentTurn({
      history,
      userText,
      documentText,
      defaultCountry,
    });

    saveHistory(input.from, newHistory);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    res.end(twiml(message));
  } catch (_) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    res.end(twiml("PreCali tuvo un problema procesando tu mensaje. Probemos de nuevo en un momento."));
  }
};
