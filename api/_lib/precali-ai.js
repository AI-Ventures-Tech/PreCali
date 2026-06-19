const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_MEDIA_BYTES = 7 * 1024 * 1024;

function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function hasGroqKey() {
  return Boolean(process.env.GROQ_API_KEY);
}

function activeAiProvider(input) {
  const forced = String(process.env.PRECALI_AI_PROVIDER || "").trim().toLowerCase();
  const numMedia = Number(input && input.numMedia ? input.numMedia : 0);
  const hasDocumentText = Boolean(input && input.documentText);

  if (forced === "openai") return hasOpenAiKey() ? "openai" : "";
  if (forced === "groq") {
    if (numMedia > 0 && !hasDocumentText) return hasOpenAiKey() ? "openai" : "";
    return hasGroqKey() ? "groq" : "";
  }

  if (numMedia > 0 && !hasDocumentText) return hasOpenAiKey() ? "openai" : "";
  if (hasGroqKey()) return "groq";
  if (hasOpenAiKey()) return "openai";
  return "";
}

function aiEnabled(input) {
  return Boolean(activeAiProvider(input)) && process.env.PRECALI_AI_DISABLED !== "1";
}

function shouldUseAiForMessage(input) {
  if (!aiEnabled(input)) return false;

  const numMedia = Number(input && input.numMedia ? input.numMedia : 0);
  if (numMedia > 0) {
    if (process.env.PRECALI_AI_DOCUMENT_FALLBACK !== "1") return false;
    if (input && input.documentText && activeAiProvider(input) === "groq") return true;
    return activeAiProvider(input) === "openai";
  }

  if (process.env.PRECALI_AI_TEXT !== "1") return false;

  const body = String(input && input.body ? input.body : "").trim();
  if (body.length < 18) return false;
  if (/^(hola|buenas|menu|ayuda|inicio|empezar|hey|ola)$/i.test(body)) return false;

  return true;
}

function safeJsonParse(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (_) {
    const match = String(value).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (error) {
      return null;
    }
  }
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
}

function normalizeProduct(value) {
  const product = String(value || "").toLowerCase();
  if (product === "vehiculo" || product === "personal" || product === "hipoteca") return product;
  return null;
}

function normalizeAiResult(result) {
  const profile = result && result.profile ? result.profile : {};
  const document = result && result.document ? result.document : {};

  return {
    profile: {
      product: normalizeProduct(profile.product),
      income: normalizeNumber(profile.income),
      debt: normalizeNumber(profile.debt),
      downPayment: normalizeNumber(profile.downPayment),
      assetValue: normalizeNumber(profile.assetValue),
      requestedYears: normalizeNumber(profile.requestedYears),
    },
    document: {
      type: document.type ? String(document.type) : null,
      name: document.name ? String(document.name) : null,
      idNumber: document.idNumber ? String(document.idNumber) : null,
      employer: document.employer ? String(document.employer) : null,
      grossIncome: normalizeNumber(document.grossIncome),
      netIncome: normalizeNumber(document.netIncome),
    },
    confidence: Math.max(0, Math.min(1, Number(result && result.confidence ? result.confidence : 0))),
    missing: Array.isArray(result && result.missing) ? result.missing.map(String).slice(0, 8) : [],
    notes: result && result.notes ? String(result.notes).slice(0, 500) : "",
  };
}

function buildSchema() {
  const nullableNumber = {
    anyOf: [{ type: "number" }, { type: "null" }],
  };
  const nullableString = {
    anyOf: [{ type: "string" }, { type: "null" }],
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["profile", "document", "confidence", "missing", "notes"],
    properties: {
      profile: {
        type: "object",
        additionalProperties: false,
        required: ["product", "income", "debt", "downPayment", "assetValue", "requestedYears"],
        properties: {
          product: {
            anyOf: [{ type: "string", enum: ["personal", "vehiculo", "hipoteca"] }, { type: "null" }],
          },
          income: nullableNumber,
          debt: nullableNumber,
          downPayment: nullableNumber,
          assetValue: nullableNumber,
          requestedYears: nullableNumber,
        },
      },
      document: {
        type: "object",
        additionalProperties: false,
        required: ["type", "name", "idNumber", "employer", "grossIncome", "netIncome"],
        properties: {
          type: nullableString,
          name: nullableString,
          idNumber: nullableString,
          employer: nullableString,
          grossIncome: nullableNumber,
          netIncome: nullableNumber,
        },
      },
      confidence: { type: "number" },
      missing: {
        type: "array",
        items: { type: "string" },
      },
      notes: { type: "string" },
    },
  };
}

function buildExtractionPrompt(body, mediaType) {
  return [
    "Sos el extractor de datos de PreCali para pre-calificacion financiera en Latinoamerica.",
    "Extrae solamente datos que aparezcan en el mensaje o documento. No inventes montos.",
    "Puede venir texto desordenado, con faltas de ortografia, orden patronal, boleta de pago, colilla, estado de cuenta, proforma, foto o PDF.",
    "Usa salario/ingreso NETO si existe. Si solo existe salario bruto, ponlo en grossIncome y usa income solo si el documento indica neto o liquido.",
    "No trates rebajos legales de planilla como deudas mensuales, excepto si aparecen como prestamos, cuotas, embargos, pension u obligaciones recurrentes.",
    "Producto: hipoteca para casa/vivienda/lote/terreno/propiedad; vehiculo para carro/auto/moto; personal para prestamo personal o si no hay garantia.",
    "Moneda base para este MVP: CRC. Devuelve numeros puros, sin simbolos ni separadores.",
    "Si hay documento adjunto, clasificalo y extrae nombre, cedula, patrono, ingreso bruto y neto cuando se pueda.",
    "",
    "Mensaje de WhatsApp:",
    body || "(sin texto)",
    "",
    "Tipo de archivo adjunto:",
    mediaType || "(sin adjunto)",
  ].join("\n");
}

function buildGroqExtractionPrompt(body, recentMessages) {
  const historyLines = Array.isArray(recentMessages) && recentMessages.length
    ? recentMessages.slice(-5).map((item, index) => `${index + 1}. ${String(item)}`).join("\n")
    : "(sin contexto previo)";

  return [
    "Sos el extractor conversacional de PreCali para pre-calificacion financiera en Latinoamerica.",
    "Entende texto desordenado de WhatsApp y devolve SOLO JSON valido.",
    "No inventes montos. Si no sabes algo, usa null o array vacio.",
    "Usa producto: personal, vehiculo o hipoteca.",
    "Si el usuario hace una pregunta de seguimiento, usa el contexto reciente para inferir a que se refiere.",
    "Moneda base: devuelve numeros puros en la moneda detectada del mensaje. No uses simbolos ni separadores.",
    "",
    "Contexto reciente del chat:",
    historyLines,
    "",
    "Mensaje actual:",
    body || "(sin texto)",
    "",
    'Devuelve un objeto JSON con esta forma exacta: {"profile":{"product":string|null,"income":number|null,"debt":number|null,"downPayment":number|null,"assetValue":number|null,"requestedYears":number|null},"document":{"type":null,"name":null,"idNumber":null,"employer":null,"grossIncome":null,"netIncome":null},"confidence":number,"missing":[string],"notes":string}',
  ].join("\n");
}

function buildGroqDocumentPrompt(body, recentMessages, documentText) {
  const historyLines = Array.isArray(recentMessages) && recentMessages.length
    ? recentMessages.slice(-5).map((item, index) => `${index + 1}. ${String(item)}`).join("\n")
    : "(sin contexto previo)";

  return [
    "Sos el extractor documental de PreCali.",
    "Analiza texto crudo de una orden patronal, colilla, constancia, estado de cuenta o PDF financiero.",
    "Devuelve SOLO JSON valido. No inventes montos.",
    "Si el salario es quincenal, conviertelo a mensual multiplicando por 2.",
    "Usa ingreso neto/liquido si aparece. Si solo hay bruto, colocalo como grossIncome y usa income solo si no hay neto.",
    "No trates deducciones de ley como deuda. Solo usa deuda si dice prestamo, tarjeta, embargo, pension, cuota u obligacion recurrente.",
    "Producto: hipoteca para casa/vivienda/lote/terreno/propiedad; vehiculo para carro/auto/moto; personal si no hay garantia.",
    "",
    "Contexto reciente del chat:",
    historyLines,
    "",
    "Mensaje del usuario:",
    body || "(sin texto)",
    "",
    "Texto extraido del documento:",
    String(documentText || "").slice(0, 12000),
    "",
    'Devuelve un objeto JSON con esta forma exacta: {"profile":{"product":string|null,"income":number|null,"debt":number|null,"downPayment":number|null,"assetValue":number|null,"requestedYears":number|null},"document":{"type":string|null,"name":string|null,"idNumber":string|null,"employer":string|null,"grossIncome":number|null,"netIncome":number|null},"confidence":number,"missing":[string],"notes":string}',
  ].join("\n");
}

const ADVISOR_COUNTRY_CONFIG = {
  CR: { defaultCurrency: "CRC", currencies: { CRC: { scale: 1 }, USD: { scale: 540 } } },
  MX: { defaultCurrency: "MXN", currencies: { MXN: { scale: 29 }, USD: { scale: 540 } } },
  GT: { defaultCurrency: "GTQ", currencies: { GTQ: { scale: 68 }, USD: { scale: 540 } } },
  PA: { defaultCurrency: "USD", currencies: { USD: { scale: 540 } } },
  HN: { defaultCurrency: "HNL", currencies: { HNL: { scale: 22 }, USD: { scale: 540 } } },
  NI: { defaultCurrency: "NIO", currencies: { NIO: { scale: 15 }, USD: { scale: 540 } } },
  SV: { defaultCurrency: "USD", currencies: { USD: { scale: 540 } } },
  US: { defaultCurrency: "USD", currencies: { USD: { scale: 540 } } },
};

function advisorCurrency(profile) {
  const country = profile && profile.country ? profile.country : "CR";
  const config = ADVISOR_COUNTRY_CONFIG[country] || ADVISOR_COUNTRY_CONFIG.CR;
  return profile && profile.currency ? profile.currency : config.defaultCurrency;
}

function advisorCurrencyScale(profile) {
  const country = profile && profile.country ? profile.country : "CR";
  const config = ADVISOR_COUNTRY_CONFIG[country] || ADVISOR_COUNTRY_CONFIG.CR;
  const currency = advisorCurrency(profile);
  const currencyConfig = config.currencies[currency] || config.currencies[config.defaultCurrency];
  return currencyConfig ? currencyConfig.scale : 1;
}

function advisorMoney(value, profile) {
  const amount = Math.max(0, Math.round((Number(value) || 0) / advisorCurrencyScale(profile)));
  return advisorCurrency(profile) + " " + amount.toLocaleString("es-CR");
}

function advisorRecommendedOption(results, profile) {
  if (!Array.isArray(results) || !results.length) return null;
  const netIncome = Math.max(1, Number(profile.income || 0) - Number(profile.debt || 0));
  const affordable = results
    .map((result) => ({ result, burden: Number(result.payment || 0) / netIncome }))
    .filter((item) => item.burden <= 0.35)
    .sort((a, b) => a.burden - b.burden || Number(a.result.rate || 0) - Number(b.result.rate || 0));
  if (affordable.length) return affordable[0].result;
  return results.slice().sort((a, b) => Number(a.payment || 0) - Number(b.payment || 0) || Number(a.rate || 0) - Number(b.rate || 0))[0];
}

async function fetchTwilioMedia(url) {
  if (!url) return null;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("twilio_media_auth_missing");
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

function mediaContentPart(media, fallbackType) {
  if (!media || !media.buffer) return null;

  const contentType = (media.contentType || fallbackType || "application/octet-stream").split(";")[0].toLowerCase();
  const base64 = media.buffer.toString("base64");

  if (contentType.startsWith("image/")) {
    return {
      type: "input_image",
      image_url: `data:${contentType};base64,${base64}`,
    };
  }

  return {
    type: "input_file",
    filename: `precali-document.${extensionForContentType(contentType)}`,
    file_data: `data:${contentType};base64,${base64}`,
  };
}

function extensionForContentType(contentType) {
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("wordprocessingml")) return "docx";
  if (contentType.includes("msword")) return "doc";
  if (contentType.includes("csv")) return "csv";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "bin";
}

function outputTextFromResponse(data) {
  if (typeof data.output_text === "string") return data.output_text;

  const texts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") texts.push(content.text);
    }
  }
  return texts.join("\n");
}

async function callOpenAi({ body, mediaUrl, mediaType, numMedia }) {
  const content = [
    {
      type: "input_text",
      text: buildExtractionPrompt(body, mediaType),
    },
  ];

  if (Number(numMedia || 0) > 0 && mediaUrl) {
    const media = await fetchTwilioMedia(mediaUrl);
    const mediaPart = mediaContentPart(media, mediaType);
    if (mediaPart) content.push(mediaPart);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: "user",
          content,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "precali_extraction",
          strict: true,
          schema: buildSchema(),
        },
      },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`openai_${response.status}`);
    error.status = response.status;
    error.body = raw.slice(0, 1000);
    throw error;
  }

  const data = safeJsonParse(raw);
  const outputText = outputTextFromResponse(data || {});
  const parsed = safeJsonParse(outputText);
  if (!parsed) throw new Error("openai_invalid_json");

  return normalizeAiResult(parsed);
}

async function callGroq({ body, recentMessages, documentText }) {
  const prompt = documentText
    ? buildGroqDocumentPrompt(body, recentMessages, documentText)
    : buildGroqExtractionPrompt(body, recentMessages);

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Sos PreCali IA. Extrae datos financieros con precision y devuelve solo JSON valido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`groq_${response.status}`);
    error.status = response.status;
    error.body = raw.slice(0, 1000);
    throw error;
  }

  const data = safeJsonParse(raw);
  const outputText = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "";
  const parsed = safeJsonParse(outputText);
  if (!parsed) throw new Error("groq_invalid_json");

  return normalizeAiResult(parsed);
}

function buildGroqAdvisorPrompt(input) {
  const historyLines = Array.isArray(input.recentMessages) && input.recentMessages.length
    ? input.recentMessages.slice(-5).map((item, index) => `${index + 1}. ${String(item)}`).join("\n")
    : "(sin contexto previo)";
  const profile = input.profile || {};
  const netIncome = Math.max(1, Number(profile.income || 0) - Number(profile.debt || 0));
  const options = Array.isArray(input.results) ? input.results.slice(0, 8) : [];
  const recommended = advisorRecommendedOption(options, profile);
  const recommendedBurden = recommended ? Math.round((Number(recommended.payment || 0) / netIncome) * 100) : 0;
  const optionLines = options.length
    ? options.map((item, index) => [
        `${index + 1}. ${item.bank}`,
        `tasa ${item.rate}%`,
        `monto ${advisorMoney(item.amount, profile)}`,
        `cuota ${advisorMoney(item.payment, profile)}`,
        `carga ${Math.round((Number(item.payment || 0) / netIncome) * 100)}%`,
        `plazo ${item.years} anos`,
      ].join(" | ")).join("\n")
    : "(sin opciones calculadas)";
  const recommendedLine = recommended
    ? `${recommended.bank} | cuota ${advisorMoney(recommended.payment, profile)} | carga ${recommendedBurden}% | tasa ${recommended.rate}% | monto ${advisorMoney(recommended.amount, profile)}`
    : "(sin recomendacion calculada)";

  return [
    "Sos PreCali IA, asistente experto en originacion digital de creditos para Mexico y Centroamerica.",
    "Tu objetivo es resolver dudas y guiar al usuario a aplicar formalmente al banco elegido por este chat.",
    "Presenta a PreCali como puente digital entre el usuario y los bancos: perfilamos, comparamos y preparamos la aplicacion sin filas ni papeleo fisico.",
    "Responde como humano: claro, directo, empatico, confiable y con modismos suaves del pais detectado.",
    "Usa SOLO los datos del perfil y opciones calculadas abajo. No inventes bancos, tasas, aprobaciones ni requisitos.",
    "Si el usuario menciona un banco que aparece en las opciones calculadas, evalua ese banco; no digas que no existe.",
    "Si el usuario pregunta cual banco conviene, usa la recomendacion calculada por PreCali y explica el criterio.",
    "No elijas solo por tasa. Considera cuota mensual, carga sobre ingreso y lo que el usuario pregunto.",
    "No compares el monto del prestamo contra la prima. La prima se suma al prestamo para estimar valor total del bien.",
    "Si no hay valor del carro/casa, aclara que falta ese dato para afinar la prima real.",
    "Si el usuario pregunta por buro, score, soft pull o hard pull: explica que primero pedimos autorizacion para un estudio crediticio inicial; si decide aplicar, autoriza aparte la revision formal del banco.",
    "Si pregunta por costo: di que la precalificacion por PreCali es sin costo para el usuario y que no cobramos por comparar ni iniciar el proceso digital.",
    "Si pregunta por seguridad: di que usamos sus datos solo para perfilar y preparar la aplicacion al banco elegido, y que antes de enviar documentos pedimos consentimiento. No prometas AES-256 ni destruccion en 30 dias salvo que aparezca en los datos.",
    "Si el usuario pregunta si deberia aplicar, da criterio, aclara que sigue siendo precalificacion y pide autorizacion para iniciar el estudio crediticio.",
    "No mandes una tabla completa si el usuario hizo una duda puntual.",
    "Maximo 4 lineas cortas. Usa montos con moneda. Termina con una pregunta concreta orientada a aplicar o autorizar el estudio inicial.",
    "",
    "Contexto reciente:",
    historyLines,
    "",
    "Mensaje actual:",
    input.body || "(sin texto)",
    "",
    "Perfil calculado:",
    JSON.stringify(profile),
    "",
    "Opciones calculadas:",
    optionLines,
    "",
    "Recomendacion calculada por PreCali:",
    recommendedLine,
    "",
    'Devuelve SOLO JSON valido con esta forma: {"message":"respuesta para WhatsApp","confidence":0.0}',
  ].join("\n");
}

async function writeAdvisorReplyWithPreCaliAi(input) {
  if (!aiEnabled(input) || activeAiProvider(input) !== "groq") return null;
  if (process.env.PRECALI_AI_TEXT !== "1") return null;

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Sos PreCali IA. Redacta respuestas financieras breves usando solo los datos proporcionados.",
        },
        {
          role: "user",
          content: buildGroqAdvisorPrompt(input),
        },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`groq_advisor_${response.status}`);
    error.status = response.status;
    error.body = raw.slice(0, 1000);
    throw error;
  }

  const data = safeJsonParse(raw);
  const outputText = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "";
  const parsed = safeJsonParse(outputText);
  if (!parsed || !parsed.message) throw new Error("groq_advisor_invalid_json");

  const message = String(parsed.message).slice(0, 900);
  if (/(monto|prestamo|credito).{0,40}(inferior|menor).{0,40}prima|prima.{0,40}(supera|mayor).{0,40}(monto|prestamo|credito)/i.test(message)) {
    return null;
  }

  return {
    message,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
  };
}

async function analyzeWithPreCaliAi(input) {
  if (!shouldUseAiForMessage(input)) return null;
  const provider = activeAiProvider(input);
  if (provider === "groq") return callGroq(input);
  return callOpenAi(input);
}

module.exports = {
  aiEnabled,
  activeAiProvider,
  shouldUseAiForMessage,
  analyzeWithPreCaliAi,
  writeAdvisorReplyWithPreCaliAi,
  normalizeAiResult,
};
