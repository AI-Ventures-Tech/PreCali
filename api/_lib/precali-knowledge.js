const fs = require("fs");
const path = require("path");
const vm = require("vm");

const COUNTRY_NAMES = {
  CR: "Costa Rica",
};

const PRODUCT_LABELS = {
  personal: "prestamo personal",
  vehiculo: "credito vehicular",
  hipoteca: "credito hipotecario",
};

function normalizeCountry(country) {
  return "CR";
}

function readRootFile(filename) {
  const candidates = [
    path.join(process.cwd(), filename),
    path.join(__dirname, "..", "..", filename),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found ? fs.readFileSync(found, "utf8") : "";
}

function loadDataSource() {
  const code = readRootFile("data.js");
  if (!code) return { PAISES: [], BANCOS: [] };
  return vm.runInNewContext(code + "\n;({ PAISES, BANCOS });", {}, { filename: "data.js", timeout: 1000 });
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&aacute;/g, "a")
    .replace(/&eacute;/g, "e")
    .replace(/&iacute;/g, "i")
    .replace(/&oacute;/g, "o")
    .replace(/&uacute;/g, "u")
    .replace(/&ntilde;/g, "n")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function relevantSentences(text, patterns, limit) {
  const normalized = stripHtml(text);
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const matches = [];
  for (const sentence of sentences) {
    if (patterns.some((pattern) => pattern.test(sentence))) matches.push(sentence);
    if (matches.length >= limit) break;
  }
  return matches;
}

function siteKnowledgeLines() {
  const index = readRootFile("index.html");
  const terms = readRootFile("terminos.html");
  const privacy = readRootFile("privacidad.html");
  const lines = [
    "PreCali compara opciones de bancos y aseguradoras de Costa Rica para mostrar tasas, requisitos y proximos pasos con claridad.",
    "La calculadora procesa la situacion financiera y usa sistema frances de amortizacion.",
    "Cada banco define capacidad de pago, tasa, plazo maximo y porcentaje de financiamiento.",
    "PreCali no es banco, no otorga prestamos y las precalificaciones son estimaciones referenciales no vinculantes.",
    "La aprobacion final depende del analisis crediticio de cada entidad: historial, antiguedad laboral, sector, score interno, productos vigentes y garantias.",
    "Los datos se basan en informacion publica de bancos, folletos publicos y reportes regulatorios; pueden variar entre actualizaciones.",
    "PreCali usa consentimiento para tratamiento y posible comparticion de datos con asesores o socios aliados cuando pueda derivar en una oferta util.",
    "PreCali debe presentar la primera etapa como consulta blanda/precalificacion: no es el Hard Pull formal del banco. El Hard Pull se autoriza aparte si el usuario decide aplicar.",
    "PreCali es gratuito para el usuario al comparar y arrancar el tramite digital.",
    "Seguridad: HTTPS, servidores con estandares reconocidos, acceso restringido y auditorias periodicas; ningun sistema digital es 100% seguro.",
    "Derechos de datos: acceso, rectificacion, cancelacion, oposicion, revocacion y portabilidad; privacidad@precali.net.",
  ];

  relevantSentences(index, [/datos publicos/i, /sistema frances/i, /analisis inteligente/i, /factores no consideramos/i], 4).forEach((line) => lines.push(line));
  relevantSentences(terms, [/NO es una entidad bancaria/i, /estimaciones/i, /aprobaci/i, /informativos/i], 4).forEach((line) => lines.push(line));
  relevantSentences(privacy, [/HTTPS/i, /consentimiento/i, /socios comerciales/i, /derechos/i], 4).forEach((line) => lines.push(line));
  return Array.from(new Set(lines)).slice(0, 16);
}

function conditionRate(condition, currency) {
  if (!condition) return null;
  if (currency === "USD" && Number.isFinite(Number(condition.tasaUSD))) return Number(condition.tasaUSD);
  if (Number.isFinite(Number(condition.tasaCRC))) return Number(condition.tasaCRC);
  if (Number.isFinite(Number(condition.tasaLocal))) return Number(condition.tasaLocal);
  if (Number.isFinite(Number(condition.tasaUSD))) return Number(condition.tasaUSD);
  return null;
}

function conditionLine(bank, product, currency) {
  const condition = bank && bank[product];
  if (!condition) return "";
  const rate = conditionRate(condition, currency);
  const parts = [
    bank.nombre,
    rate !== null ? `tasa ${rate}%` : "",
    condition.plazoMax ? `plazo max ${condition.plazoMax} anos` : "",
    condition.ratioMax ? `DTI ${Math.round(Number(condition.ratioMax) * 100)}%` : "",
    condition.financia ? `financia hasta ${Math.round(Number(condition.financia) * 100)}%` : "",
    condition.ingresoMin ? `ingreso min ${condition.ingresoMin}` : "",
    condition.montoMin ? `monto min ${condition.montoMin}` : "",
    condition.garantia ? `garantia: ${condition.garantia}` : "",
    condition.url ? `fuente: ${condition.url}` : bank.web ? `fuente: ${bank.web}` : "",
  ].filter(Boolean);
  return parts.join(" | ");
}

function bankKnowledgeLines(profile) {
  const source = loadDataSource();
  const country = normalizeCountry(profile && profile.country);
  const currency = profile && profile.currency ? profile.currency : "";
  const product = profile && profile.product ? profile.product : "";
  const banks = Array.isArray(source.BANCOS) ? source.BANCOS : [];
  const countryBanks = banks.filter((bank) => normalizeCountry(bank.pais || "CR") === country);
  const products = product && PRODUCT_LABELS[product] ? [product] : ["personal", "vehiculo", "hipoteca"];
  const lines = [];

  for (const item of countryBanks.slice(0, 12)) {
    for (const currentProduct of products) {
      const line = conditionLine(item, currentProduct, currency);
      if (line) lines.push(`${PRODUCT_LABELS[currentProduct]}: ${line}`);
    }
    if (product && lines.length >= 12) break;
    if (!product && lines.length >= 18) break;
  }

  return lines;
}

function shouldUseLiveWeb(body) {
  return /(requisitos?|documentos?|tasa|tasas|actual|hoy|oficial|pagina|web|sitio|banco|bac|bcr|nacional|popular|promerica|davi|davivienda|lafise|bbva|scotiabank|banrural|banpro|ficohsa)/i.test(String(body || ""));
}

function bankMentioned(bank, body) {
  const text = String(body || "").toLowerCase();
  const name = String(bank.nombre || "").toLowerCase();
  const id = String(bank.id || "").toLowerCase();
  if (name && text.includes(name)) return true;
  if (id && text.includes(id)) return true;
  if (/bac/.test(text) && /bac/.test(name)) return true;
  if (/davi/.test(text) && /davi/.test(name)) return true;
  if (/\bbn\b|nacional/.test(text) && /nacional/.test(name)) return true;
  if (/bcr/.test(text) && /costa rica/.test(name)) return true;
  return false;
}

function liveBankUrls(profile, body) {
  const source = loadDataSource();
  const country = normalizeCountry(profile && profile.country);
  const product = profile && PRODUCT_LABELS[profile.product] ? profile.product : "";
  const banks = Array.isArray(source.BANCOS) ? source.BANCOS : [];
  const countryBanks = banks.filter((bank) => normalizeCountry(bank.pais || "CR") === country);
  const mentioned = countryBanks.filter((bank) => bankMentioned(bank, body));
  const selected = (mentioned.length ? mentioned : countryBanks).slice(0, mentioned.length ? 2 : 1);
  const urls = [];
  for (const bank of selected) {
    const condition = product ? bank[product] : null;
    const url = condition && condition.url ? condition.url : bank.web;
    if (url && /^https?:\/\//i.test(url) && !urls.some((item) => item.url === url)) {
      urls.push({ bank: bank.nombre, url });
    }
  }
  return urls;
}

function relevantLiveText(text) {
  const clean = stripHtml(text).slice(0, 18000);
  const sentences = clean.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const picked = sentences.filter((line) => /(credito|prestamo|hipotec|vehicul|personal|tasa|plazo|requisit|ingreso|prima|enganche|financia|cuota|solicitud)/i.test(line));
  return picked.slice(0, 3).join(" ").slice(0, 700);
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "PreCaliBot/1.0 (+https://precali.vercel.app)",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
      },
    });
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") || "";
    if (!/text|html|xml/i.test(contentType)) return "";
    return await response.text();
  } catch (_) {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLiveBankKnowledge(input) {
  if (process.env.PRECALI_LIVE_WEB_DISABLED === "1") return [];
  if (!shouldUseLiveWeb(input && input.body)) return [];
  const profile = input && input.profile ? input.profile : {};
  const urls = liveBankUrls(profile, input && input.body).slice(0, 2);
  const lines = [];
  for (const item of urls) {
    const html = await fetchWithTimeout(item.url, 1400);
    const snippet = html ? relevantLiveText(html) : "";
    if (snippet) {
      lines.push(`Fuente web oficial ${item.bank}: ${snippet} (${item.url})`);
    } else {
      lines.push(`Fuente oficial disponible para ${item.bank}: ${item.url}`);
    }
  }
  return lines;
}

function buildPreCaliKnowledge(input) {
  const profile = input && input.profile ? input.profile : {};
  const country = normalizeCountry(profile.country || input.defaultCountry || "CR");
  const product = PRODUCT_LABELS[profile.product] || "credito";
  const header = [
    `Pais detectado: ${COUNTRY_NAMES[country] || country}.`,
    `Producto contextual: ${product}.`,
    "Usa esta base como conocimiento interno. Si algo no esta aqui, no lo inventes.",
  ];

  return {
    country,
    product,
    lines: header.concat(siteKnowledgeLines(), bankKnowledgeLines({ ...profile, country })).slice(0, 34),
  };
}

module.exports = {
  buildPreCaliKnowledge,
  fetchLiveBankKnowledge,
};
