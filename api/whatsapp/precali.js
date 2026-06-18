const { buildReply, buildReplyFromProfile, coerceProfile, parseProfile, simulate } = require("../_lib/precali-whatsapp-bot");
const { analyzeWithPreCaliAi, shouldUseAiForMessage, writeAdvisorReplyWithPreCaliAi } = require("../_lib/precali-ai");
const { readPreCaliDocument } = require("../_lib/precali-documents");
const { fetchTwilioMedia } = require("../_lib/twilio-media");

const CONTEXT_TTL_MS = 20 * 60 * 1000;
const MAX_CONTEXT_MESSAGES = 5;
const recentTextContext = new Map();
const COUNTRY_CONFIG = {
  CR: { defaultCurrency: "CRC", currencies: { CRC: { scale: 1 }, USD: { scale: 540 } } },
  MX: { defaultCurrency: "MXN", currencies: { MXN: { scale: 29 }, USD: { scale: 540 } } },
  GT: { defaultCurrency: "GTQ", currencies: { GTQ: { scale: 68 }, USD: { scale: 540 } } },
  PA: { defaultCurrency: "USD", currencies: { USD: { scale: 540 } } },
  HN: { defaultCurrency: "HNL", currencies: { HNL: { scale: 22 }, USD: { scale: 540 } } },
  NI: { defaultCurrency: "NIO", currencies: { NIO: { scale: 15 }, USD: { scale: 540 } } },
  SV: { defaultCurrency: "USD", currencies: { USD: { scale: 540 } } },
  US: { defaultCurrency: "USD", currencies: { USD: { scale: 540 } } },
};

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

function hasUsefulBodyText(body) {
  return String(body || "").trim().length >= 3;
}

function cleanupRecentContext() {
  const now = Date.now();
  for (const [key, value] of recentTextContext.entries()) {
    if (!value || now - value.ts > CONTEXT_TTL_MS) recentTextContext.delete(key);
  }
}

function appendRecentMessage(messages, body) {
  const clean = String(body || "").trim();
  if (!clean) return Array.isArray(messages) ? messages.slice(-MAX_CONTEXT_MESSAGES) : [];
  const next = Array.isArray(messages) ? messages.slice() : [];
  if (!next.length || normalizeForIntent(next[next.length - 1]) !== normalizeForIntent(clean)) {
    next.push(clean);
  }
  return next.slice(-MAX_CONTEXT_MESSAGES);
}

function rememberRecentText(from, body) {
  if (!from || !hasUsefulBodyText(body)) return;
  cleanupRecentContext();
  const key = String(from);
  const current = recentTextContext.get(key) || {};
  recentTextContext.set(key, {
    ...current,
    body: String(body).trim(),
    messages: appendRecentMessage(current.messages, body),
    ts: Date.now(),
  });
}

function readRecentText(from) {
  if (!from) return "";
  cleanupRecentContext();
  const entry = recentTextContext.get(String(from));
  if (!entry) return "";
  return entry.body || "";
}

function rememberRecentProfile(from, profile, body) {
  if (!from || !profile) return;
  cleanupRecentContext();
  const key = String(from);
  const current = recentTextContext.get(key) || {};
  recentTextContext.set(key, {
    ...current,
    body: hasUsefulBodyText(body) ? String(body).trim() : current.body,
    messages: hasUsefulBodyText(body) ? appendRecentMessage(current.messages, body) : Array.isArray(current.messages) ? current.messages.slice(-MAX_CONTEXT_MESSAGES) : [],
    profile: coerceProfile(profile),
    ts: Date.now(),
  });
}

function readRecentProfile(from) {
  if (!from) return null;
  cleanupRecentContext();
  const entry = recentTextContext.get(String(from));
  return entry && entry.profile ? entry.profile : null;
}

function readRecentMessages(from) {
  if (!from) return [];
  cleanupRecentContext();
  const entry = recentTextContext.get(String(from));
  return entry && Array.isArray(entry.messages) ? entry.messages.slice(-MAX_CONTEXT_MESSAGES) : [];
}

function defaultCurrencyForCountry(country) {
  const config = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.CR;
  return config.defaultCurrency;
}

function currencyScale(country, currency) {
  const countryConfig = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.CR;
  const selectedCurrency = currency || countryConfig.defaultCurrency;
  const currencyConfig = countryConfig.currencies[selectedCurrency] || countryConfig.currencies[countryConfig.defaultCurrency];
  return currencyConfig ? currencyConfig.scale : 1;
}

function money(value, profile) {
  const country = profile && profile.country ? profile.country : "CR";
  const currency = profile && profile.currency ? profile.currency : defaultCurrencyForCountry(country);
  return currency + " " + Math.max(0, Math.round((Number(value) || 0) / currencyScale(country, currency))).toLocaleString("es-CR");
}

function productLabel(product) {
  if (product === "hipoteca") return "credito hipotecario";
  if (product === "vehiculo") return "credito vehicular";
  return "credito personal";
}

function normalizeForIntent(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function explicitCountryFromBody(body) {
  const text = normalizeForIntent(body);
  if (/\bmexico\b|\bmx\b|\bpesos\b|\bmxn\b/.test(text)) return "MX";
  if (/\bguatemala\b|\bgt\b|\bquetzales\b|\bgtq\b/.test(text)) return "GT";
  if (/\bpanama\b|\bpa\b/.test(text)) return "PA";
  if (/\bhonduras\b|\bhn\b/.test(text)) return "HN";
  if (/\bnicaragua\b|\bni\b/.test(text)) return "NI";
  if (/\bel salvador\b|\bsv\b/.test(text)) return "SV";
  return "";
}

function explicitCurrencyFromBody(body, country) {
  const text = normalizeForIntent(body);
  if (/\busd\b|dolares?\b|\$|\bverdes?\b/.test(text)) return "USD";
  if (/\bcrc\b|colones?\b/.test(text)) return "CRC";
  if (/\bmxn\b|pesos?\b/.test(text) && country === "MX") return "MXN";
  if (/\bgtq\b|quetzales?\b/.test(text)) return "GTQ";
  if (/\bhnl\b|lempiras?\b/.test(text)) return "HNL";
  if (/\bnio\b|cordobas?\b/.test(text)) return "NIO";
  return "";
}

function explicitCountryFromPhone(from) {
  const phone = String(from || "").replace(/^whatsapp:/i, "").replace(/[^\d+]/g, "");
  if (phone.startsWith("+506")) return "CR";
  if (phone.startsWith("+507")) return "PA";
  if (phone.startsWith("+502")) return "GT";
  if (phone.startsWith("+504")) return "HN";
  if (phone.startsWith("+505")) return "NI";
  if (phone.startsWith("+503")) return "SV";
  if (phone.startsWith("+52")) return "MX";
  if (phone.startsWith("+1")) return "US";
  return "";
}

function explicitProductFromBody(body) {
  const text = normalizeForIntent(body);
  if (/(de un prestamo personal|de una deuda personal|deuda personal|tarjeta de credito|deuda de tarjeta)/.test(text)) return "";
  if (/(casa|vivienda|hipoteca|hipotecario|apartamento|apto|depa|lote|terreno|propiedad|inmueble)/.test(text)) return "hipoteca";
  if (/(carro|auto|vehiculo|veiculo|vehicular|moto|prendario|pickup|pick up|camioneta)/.test(text)) return "vehiculo";
  if (/(personal|consumo|libre inversion|gastos personales)/.test(text)) return "personal";
  return "";
}

function bodyHasYearHint(body) {
  return /(\d{1,2})\s*(?:anos|ano|anios|años|año|plazo)|plazo.{0,24}\d{1,2}/.test(normalizeForIntent(body));
}

function defaultYearsForProduct(product) {
  return product === "hipoteca" ? 30 : product === "vehiculo" ? 6 : 5;
}

function toInternalAmount(value, country, currency) {
  const number = Number(value) || 0;
  return Math.max(0, Math.round(number * currencyScale(country, currency)));
}

function bodyHasDebtZeroHint(body) {
  return /\b(no debo|sin deudas?|deuda cero|deudas? en 0)\b/.test(normalizeForIntent(body));
}

function bodyHasDebtClearedHint(body) {
  return /\b(termino de pagar|terminarla de pagar|la termino de pagar|la pago este mes|la cancelo este mes|quedo libre de deuda|salgo de esa deuda|ya no pagaria esa deuda)\b/.test(normalizeForIntent(body));
}

function bodyAddsCoBorrower(body) {
  return /\b(sumamos|agregamos|metemos|incluimos|mi esposa|mi esposa gana|mi esposo|mi pareja|co-deudor|co deudor|copropietario|co-propietario|entre los dos|adicionales)\b/.test(normalizeForIntent(body));
}

function bodyAsksApplicationAdvice(body) {
  const text = normalizeForIntent(body);
  return /(deberia|debo|conviene|recomiendas|recomendarias|vale la pena|seria bueno|seria mejor).{0,50}aplicar|aplicar a.+\?/.test(text);
}

function bodyIsDirectApplicationCommand(body) {
  const text = normalizeForIntent(body);
  if (bodyAsksApplicationAdvice(body)) return false;
  if (/(gano|ingreso|salario|sueldo|neto|debo|deuda|prima|enganche|monto|valor)/.test(text)) return false;
  return /\b(aplicar|solicitar|me interesa|quiero esa|enviar|mandar)\b/.test(text);
}

function bodyNeedsAdvisorReply(body) {
  const text = normalizeForIntent(body);
  return bodyAsksApplicationAdvice(body) ||
    /\?/.test(String(body || "")) ||
    /\b(cual|mejor|conviene|recomiendas|recomendarias|por que|porque|duda|explicame|incluye|seguro|seguros|cuota|tasa|aplicar)\b/.test(text);
}

function mergeDocumentAndMessageProfile(documentProfile, body, defaultCountry) {
  const doc = documentProfile || {};
  const productHint = explicitProductFromBody(body);
  const countryHint = explicitCountryFromBody(body);
  const country = countryHint || defaultCountry || doc.country || "CR";
  const currencyHint = explicitCurrencyFromBody(body, country);
  const currency = currencyHint || doc.currency || defaultCurrencyForCountry(country);
  const bodyProfile = parseProfile(body || "", { defaultCountry: country, defaultCurrency: currency });
  const notes = [];

  const merged = {
    country,
    currency: currencyHint || bodyProfile.currency || currency,
    product: productHint || doc.product || bodyProfile.product || "personal",
    income: Number(doc.income) || Number(bodyProfile.income) || 0,
    debt: Math.max(Number(doc.debt) || 0, bodyProfile.debt >= 10000 ? Number(bodyProfile.debt) || 0 : 0),
    downPayment: bodyProfile.downPayment >= 10000 ? bodyProfile.downPayment : Number(doc.downPayment) || 0,
    assetValue: bodyProfile.assetValue >= 100000 ? bodyProfile.assetValue : Number(doc.assetValue) || 0,
    requestedYears: bodyHasYearHint(body) ? bodyProfile.requestedYears : doc.requestedYears,
  };

  if (productHint && productHint !== doc.product) notes.push("producto");
  if (bodyHasYearHint(body)) notes.push("plazo");
  if (bodyProfile.assetValue >= 100000) notes.push("monto");
  if (bodyProfile.downPayment >= 10000) notes.push("prima");
  if (bodyProfile.debt >= 10000) notes.push("deudas");

  return { profile: merged, usedMessageHints: notes };
}

function aiDocumentProfile(ai) {
  const profile = (ai && ai.profile) || {};
  const document = (ai && ai.document) || {};
  return {
    country: profile.country || "",
    currency: profile.currency || "",
    product: profile.product || "personal",
    income: Number(profile.income) || Number(document.netIncome) || Number(document.grossIncome) || 0,
    debt: Number(profile.debt) || 0,
    downPayment: Number(profile.downPayment) || 0,
    assetValue: Number(profile.assetValue) || 0,
    requestedYears: Number(profile.requestedYears) || undefined,
  };
}

function aiDocumentPrefix(ai) {
  const document = (ai && ai.document) || {};
  const lines = ["Ya analicé tu documento con IA."];
  const detected = [];
  if (document.name) detected.push("Nombre: " + document.name);
  if (document.idNumber) detected.push("Cedula: " + document.idNumber);
  if (document.employer) detected.push("Patrono: " + document.employer);
  if (document.netIncome) detected.push("Ingreso neto detectado: " + money(document.netIncome, { country: "CR", currency: "CRC" }));
  if (!document.netIncome && document.grossIncome) detected.push("Ingreso bruto detectado: " + money(document.grossIncome, { country: "CR", currency: "CRC" }));
  if (detected.length) lines.push(detected.join(" | "));
  if (ai && ai.notes) lines.push("Nota IA: " + String(ai.notes).slice(0, 240));
  return lines;
}

function localDocumentFallbackMessage(documentResult) {
  const base = [
    "Recibi tu documento, pero el lector local de PreCali no pudo sacar suficientes datos para calcular.",
  ];

  if (documentResult && documentResult.reason === "image_ocr_pending") {
    base.push("Por ahora leo PDF/DOCX/CSV con texto. Las fotos escaneadas ocupan OCR local, que es el siguiente paso.");
  } else if (documentResult && documentResult.reason === "legacy_doc_unsupported") {
    base.push("El archivo parece ser .doc antiguo. Guardalo como .docx o PDF con texto y mandamelo otra vez.");
  } else if (documentResult && documentResult.message) {
    base.push(documentResult.message);
  }

  base.push("");
  base.push("Tambien podes escribirme algo asi:");
  base.push("Gano 1500000, debo 250000, quiero vehiculo de 15000000, tengo 2000000 de prima, a 6 anos.");
  return base.join("\n");
}

function buildContextBody(input) {
  const current = String((input && input.body) || "").trim();
  const rememberedMessages = readRecentMessages(input && input.from);
  const remembered = rememberedMessages.join("\n");
  if (current && remembered) {
    const lastRemembered = rememberedMessages[rememberedMessages.length - 1] || "";
    if (normalizeForIntent(current) !== normalizeForIntent(lastRemembered)) {
      return remembered + "\n" + current;
    }
  }
  return current || remembered || "";
}

function shouldUseRememberedProfile(input, rememberedProfile) {
  if (!rememberedProfile || !rememberedProfile.income || Number(input && input.numMedia ? input.numMedia : 0) > 0) return false;
  const body = String((input && input.body) || "").trim();
  if (!body) return false;
  const normalized = normalizeForIntent(body);
  const hasFollowUpCue = /^(y|si|y si)\b/.test(normalized) || /\b(ahora|mas bien|mejor|entonces)\b/.test(normalized);
  const hasValidationQuestion = /\?|\b(tanto|esa prima|ese monto|ese maximo|la cuota|incluye seguros|incluye seguro|puedo bajar|puedo subir|plazo|anos|anios|modelo|version)\b/.test(normalized);

  if (/(^|\b)(hola|buenas|menu|ayuda|inicio|empezar|hey|ola|estado|aprobado|rechazado|seguimiento)\b/.test(normalized)) {
    return false;
  }

  if (bodyIsDirectApplicationCommand(body)) return true;

  if (/(^|\b)(aplicar|solicitar|me interesa|quiero esa|enviar|mandar)\b/.test(normalized) && !bodyAsksApplicationAdvice(body)) {
    return false;
  }

  const current = parseProfile(body, { defaultCountry: rememberedProfile.country, defaultCurrency: rememberedProfile.currency });
  if (current.income) return hasFollowUpCue || hasValidationQuestion;
  if (current.downPayment >= 10000 || current.assetValue >= 100000 || current.debt >= 10000) return true;
  if (bodyHasDebtZeroHint(body)) return true;
  if (bodyHasDebtClearedHint(body)) return true;
  if (explicitProductFromBody(body)) return true;
  if (bodyHasYearHint(body)) return true;
  return hasFollowUpCue || hasValidationQuestion || /\b(con|para|prima|monto|valor|plazo|anos|ano|carro|casa|vehiculo|hipoteca|deuda|deudas|cuota)\b/.test(normalized);
}

function mergeRememberedProfileWithBody(rememberedProfile, body) {
  const remembered = coerceProfile(rememberedProfile);
  const explicitProduct = explicitProductFromBody(body);
  const explicitCountry = explicitCountryFromBody(body);
  const country = explicitCountry || remembered.country || "CR";
  const explicitCurrency = explicitCurrencyFromBody(body, country);
  const currency = explicitCurrency || remembered.currency || defaultCurrencyForCountry(country);
  const current = parseProfile(body || "", { defaultCountry: country, defaultCurrency: currency });
  const product = explicitProduct || remembered.product || current.product || "personal";
  const productChanged = product !== remembered.product;
  const debtCleared = bodyHasDebtZeroHint(body) || bodyHasDebtClearedHint(body);
  const addCoBorrower = bodyAddsCoBorrower(body) && current.income;
  const notes = [];

  const merged = {
    country,
    currency: explicitCurrency || current.currency || currency,
    product,
    income: addCoBorrower ? (remembered.income || 0) + current.income : current.income || remembered.income || 0,
    debt: debtCleared ? 0 : current.debt >= 10000 ? current.debt : remembered.debt || 0,
    downPayment: current.downPayment >= 10000 ? current.downPayment : remembered.downPayment || 0,
    assetValue: current.assetValue >= 100000 ? current.assetValue : productChanged ? 0 : remembered.assetValue || 0,
    requestedYears: bodyHasYearHint(body) ? current.requestedYears : productChanged ? defaultYearsForProduct(product) : remembered.requestedYears || defaultYearsForProduct(product),
  };

  if (productChanged) notes.push("producto");
  if (addCoBorrower) {
    notes.push("ingreso mancomunado");
  } else if (current.income) {
    notes.push("ingreso");
  }
  if (current.assetValue >= 100000) notes.push("monto");
  if (current.downPayment >= 10000) notes.push("prima");
  if (current.debt >= 10000 || debtCleared) notes.push("deudas");
  if (explicitCurrency) notes.push("moneda");
  if (bodyHasYearHint(body)) notes.push("plazo");

  return { profile: merged, usedMessageHints: notes };
}

function mergeAiProfileWithBody(aiProfile, body, defaultCountry) {
  const ai = aiProfile || {};
  const countryHint = explicitCountryFromBody(body);
  const productHint = explicitProductFromBody(body);
  const country = countryHint || defaultCountry || ai.country || "CR";
  const currencyHint = explicitCurrencyFromBody(body, country);
  const currency = currencyHint || ai.currency || defaultCurrencyForCountry(country);
  const current = parseProfile(body || "", { defaultCountry: country, defaultCurrency: currency });

  return {
    country,
    currency: currencyHint || current.currency || currency,
    product: productHint || ai.product || current.product || "personal",
    income: current.income || toInternalAmount(ai.income, country, currency),
    debt: current.debt >= 10000 ? current.debt : toInternalAmount(ai.debt, country, currency),
    downPayment: current.downPayment >= 10000 ? current.downPayment : toInternalAmount(ai.downPayment, country, currency),
    assetValue: current.assetValue >= 100000 ? current.assetValue : toInternalAmount(ai.assetValue, country, currency),
    requestedYears: Number(ai.requestedYears) || (bodyHasYearHint(body) ? current.requestedYears : defaultYearsForProduct(productHint || ai.product || current.product)),
  };
}

async function buildReplyFromLocalDocument(input) {
  if (Number(input.numMedia || 0) <= 0 || !input.mediaUrl) return null;

  const media = await fetchTwilioMedia(input.mediaUrl);
  const documentResult = readPreCaliDocument(media.buffer, input.mediaType || media.contentType);

  if (documentResult.ok && documentResult.profile && documentResult.profile.income) {
    const contextBody = buildContextBody(input);
    const merged = mergeDocumentAndMessageProfile(documentResult.profile, contextBody, input.defaultCountry);
    const prefixLines = ["Ya leí tu documento."];
    const detected = [];
    for (const note of documentResult.notes || []) {
      if (merged.usedMessageHints.includes("producto") && /^Producto detectado:/i.test(note)) continue;
      detected.push(note);
    }
    if (merged.usedMessageHints.length) detected.push("Tomé en cuenta tu mensaje para: " + merged.usedMessageHints.join(", "));
    if (contextBody && !String(input.body || "").trim() && readRecentText(input.from)) {
      detected.push("También tomé en cuenta tu mensaje anterior.");
    }
    if (merged.usedMessageHints.includes("producto")) detected.push("Producto final: " + productLabel(merged.profile.product));
    if (documentResult.document && documentResult.document.strongObligations) {
      detected.push("Obligaciones fuertes detectadas: " + money(documentResult.document.strongObligations, merged.profile));
    }
    if (detected.length) prefixLines.push(detected.join(" | "));
    for (const warning of documentResult.warnings || []) prefixLines.push("Nota: " + warning);
    rememberRecentProfile(input.from, merged.profile, contextBody);
    return buildReplyFromProfile(merged.profile, { prefixLines });
  }

  if (process.env.PRECALI_AI_DOCUMENT_FALLBACK === "1" && documentResult.extractedText && documentResult.extractedText.length >= 25) {
    const ai = await analyzeWithPreCaliAi({
      ...input,
      documentText: documentResult.extractedText,
      recentMessages: readRecentMessages(input.from),
    });

    if (ai && ai.confidence >= 0.45) {
      const contextBody = buildContextBody(input);
      const merged = mergeDocumentAndMessageProfile(aiDocumentProfile(ai), contextBody, input.defaultCountry);
      const prefixLines = aiDocumentPrefix(ai);
      if (merged.usedMessageHints.length) {
        prefixLines.push("Tomé en cuenta tu mensaje para: " + merged.usedMessageHints.join(", "));
      }
      rememberRecentProfile(input.from, merged.profile, contextBody);
      return buildReplyFromProfile(merged.profile, { prefixLines });
    }
  }

  return { message: localDocumentFallbackMessage(documentResult) };
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, name: "PreCali WhatsApp MVP" }));
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
      to: params.To,
      numMedia: params.NumMedia,
      mediaUrl: params.MediaUrl0,
      mediaType: params.MediaContentType0,
      defaultCountry: explicitCountryFromPhone(params.From),
    };
    input.defaultCurrency = defaultCurrencyForCountry(input.defaultCountry || "CR");

    if (hasUsefulBodyText(input.body) && Number(input.numMedia || 0) <= 0) {
      rememberRecentText(input.from, input.body);
    }

    let reply;
    let usedRememberedProfile = false;
    if (Number(input.numMedia || 0) > 0 && input.mediaUrl) {
      try {
        reply = await buildReplyFromLocalDocument(input);
      } catch (documentError) {
        if (process.env.PRECALI_AI_DOCUMENT_FALLBACK !== "1") {
          reply = {
            message:
              "Recibi tu documento, pero no pude descargarlo desde Twilio para leerlo localmente. Revisa que TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN esten configurados, o escribime ingreso, deudas, monto, prima y plazo.",
          };
        }
      }
    }

    const rememberedProfile = readRecentProfile(input.from);
    if (!reply && bodyIsDirectApplicationCommand(input.body) && !rememberedProfile) {
      reply = buildReply(input);
    }

    if (!reply && shouldUseRememberedProfile(input, rememberedProfile)) {
      const merged = mergeRememberedProfileWithBody(rememberedProfile, input.body);
      const prefixLines = [];
      if (!bodyAsksApplicationAdvice(input.body) && merged.usedMessageHints.length) {
        prefixLines.push("Actualice tu escenario con lo nuevo.");
      }
      if (merged.usedMessageHints.length) {
        prefixLines.push("Actualicé: " + merged.usedMessageHints.join(", ") + ".");
      }
      rememberRecentProfile(input.from, merged.profile, buildContextBody(input));
      usedRememberedProfile = true;
      let advisorReply = null;
      if (bodyNeedsAdvisorReply(input.body)) {
        try {
          advisorReply = await writeAdvisorReplyWithPreCaliAi({
            ...input,
            profile: merged.profile,
            results: simulate(merged.profile),
            recentMessages: readRecentMessages(input.from),
          });
        } catch (advisorError) {
          advisorReply = null;
        }
      }

      reply = advisorReply && advisorReply.confidence >= 0.55
        ? { message: advisorReply.message }
        : buildReplyFromProfile(merged.profile, {
            prefixLines,
            followUpBody: input.body,
            allowEstimateWithoutDownPayment: true,
          });
    }

    if (!reply && shouldUseAiForMessage(input)) {
      try {
        const ai = await analyzeWithPreCaliAi({
          ...input,
          recentMessages: readRecentMessages(input.from),
        });
        const prefixLines = [];

        if (ai && ai.confidence >= 0.45) {
          prefixLines.push("Ya entendí tu mensaje" + (Number(input.numMedia || 0) > 0 ? " y el documento" : "") + ".");

          if (ai.document && (ai.document.name || ai.document.idNumber || ai.document.employer || ai.document.netIncome)) {
            const detected = [];
            if (ai.document.name) detected.push("Nombre: " + ai.document.name);
            if (ai.document.idNumber) detected.push("Cedula: " + ai.document.idNumber);
            if (ai.document.employer) detected.push("Patrono: " + ai.document.employer);
            if (ai.document.netIncome) detected.push("Ingreso neto detectado: CRC " + ai.document.netIncome.toLocaleString("es-CR"));
            prefixLines.push(detected.join(" | "));
          }

          const aiProfile = mergeAiProfileWithBody(ai.profile, input.body, input.defaultCountry);
          reply = buildReplyFromProfile(aiProfile, { prefixLines });
        }
      } catch (aiError) {
        reply = null;
      }
    }

    if (!reply) {
      reply = buildReply(input);
    }

    if (!usedRememberedProfile && hasUsefulBodyText(input.body) && Number(input.numMedia || 0) <= 0) {
      const parsed = parseProfile(input.body, { defaultCountry: input.defaultCountry, defaultCurrency: input.defaultCurrency });
      if (parsed.income) {
        rememberRecentProfile(input.from, parsed, input.body);
      }
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    res.end(twiml(reply.message));
  } catch (error) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    res.end(twiml("PreCali tuvo un problema leyendo el mensaje. Probemos de nuevo con ingreso, deudas, monto, prima y plazo."));
  }
};
