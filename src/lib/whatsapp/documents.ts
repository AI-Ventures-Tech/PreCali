// ============================================================
// PreCali AI — Extraccion de texto de documentos (PDF/DOCX/CSV/TXT)
// ============================================================
// Port fiel de `api/_lib/precali-documents.js` (CommonJS -> TypeScript).
//
// Lee el texto de documentos financieros enviados por WhatsApp
// (ordenes patronales, colillas, estados de cuenta, proformas,
// PDFs escaneados con texto, DOCX, CSV) SIN depender de ninguna
// libreria externa de parsing: el parser de PDF y DOCX esta
// implementado a mano leyendo los bytes del buffer.
//
// Tambien extrae estructuralmente los datos financieros relevantes
// (nombre, cedula, patrono, salario bruto/neto, deudas, prima,
// valor del bien, producto, plazo) a partir del texto extraido.
//
// Todo el procesamiento es local (sin IA). El OCR de imagenes
// escaneadas vive en `ocr.ts` (Groq Vision).

import { inflateRawSync, inflateSync } from "node:zlib";
import { createHash } from "node:crypto";

// ---------- Tipos publicos ----------

export interface DocumentData {
  name: string | null;
  idNumber: string | null;
  employer: string | null;
  grossIncome: number | null;
  netIncome: number | null;
  totalDeductions: number | null;
  strongObligations: number | null;
}

export interface DocumentProfileData {
  product: string;
  income: number;
  debt: number;
  downPayment: number;
  assetValue: number;
  requestedYears: number;
}

export interface ParsedDocument {
  ok: boolean;
  confidence: number;
  document: DocumentData;
  profile: DocumentProfileData;
  notes: string[];
  warnings: string[];
}

export interface DocumentResult extends ParsedDocument {
  type?: string;
  reason?: string;
  message: string;
  textLength: number;
  extractedText: string;
  preview: string;
}

// ---------- API publica (espejo del module.exports legado) ----------

export function readPreCaliDocument(buffer: Buffer | null | undefined, contentType: string): DocumentResult {
  const type = detectDocumentType(contentType, buffer ?? null);
  if (!buffer || !buffer.length) {
    return failed("empty_document", "El archivo venia vacio.");
  }

  if (type === "image") {
    return failed(
      "image_ocr_pending",
      "Recibi la imagen, pero el lector local sin IA todavia no hace OCR de fotos. Por ahora mandame PDF/DOCX/CSV con texto, o escribime ingreso y deudas.",
    );
  }

  if (type === "doc") {
    return failed(
      "legacy_doc_unsupported",
      "Recibi un .doc antiguo. Para leerlo sin IA, guardalo como .docx o PDF con texto.",
    );
  }

  let text = "";
  try {
    if (type === "pdf") text = extractPdfText(buffer);
    else if (type === "docx") text = extractDocxText(buffer);
    else text = decodeText(buffer);
  } catch {
    return failed("extract_failed", "No pude extraer texto del archivo. Probemos con PDF/DOCX/CSV con texto.");
  }

  const parsed: ParsedDocument | null =
    type === "text" ? parseCsvFinancialDocument(text) || parseFinancialDocument(text) : parseFinancialDocument(text);
  const result = parsed as ParsedDocument;

  return {
    ok: result.ok,
    type,
    textLength: text.trim().length,
    extractedText: text.trim().slice(0, 12000),
    document: result.document,
    profile: result.profile,
    confidence: result.confidence,
    notes: result.notes,
    warnings: result.warnings,
    preview: text.trim().slice(0, 600),
    message: result.ok ? "" : "Lei poco texto util del documento. Si es una imagen escaneada, el OCR local viene en el siguiente paso.",
  };
}

export function parseFinancialDocument(rawText: string): ParsedDocument {
  const text = normalizeText(rawText);
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const normalizedLines = lines.map(normalizeText);

  const netIncome = findAmountByLabels(lines, normalizedLines, [
    "salario neto",
    "neto a pagar",
    "monto neto",
    "total neto",
    "liquido",
    "salario liquido",
    "pago neto",
    "neto",
  ]);
  const grossIncome = findAmountByLabels(lines, normalizedLines, [
    "salario bruto",
    "salario reportado",
    "salario base",
    "sueldo bruto",
    "bruto",
    "total ingresos",
    "ingreso bruto",
    "total devengado",
    "devengado",
  ]);
  const totalDeductions = findAmountByLabels(lines, normalizedLines, [
    "total deducciones",
    "total descuentos",
    "suma descuentos",
    "total retenciones",
  ]);
  const orderSalary = detectSalaryOrderPatronal(rawText);
  const explicitId = rawText.match(/\b(?:Identificaci[o\u00f3]n|Cedula|C[e\u00e9]dula)\s*:\s*([0-9\-\s]{8,18})/i)?.[1] || null;
  const strongObligations = findAmountByLabels(lines, normalizedLines, [
    "prestamo",
    "prestamos",
    "cuota prestamo",
    "rebajo prestamo",
    "embargo",
    "pension alimentaria",
    "obligacion",
  ]);

  const document: DocumentData = {
    name: cleanName(
      findTextByLabels(lines, normalizedLines, [
        "nombre del trabajador",
        "nombre del asegurado",
        "nombre del empleado",
        "trabajador",
        "asegurado",
        "empleado",
        "nombre",
      ]) || detectName(lines),
    ),
    idNumber: normalizeId(
      explicitId ||
        findTextByLabels(lines, normalizedLines, ["cedula", "identificacion", "identidad", "documento"]) ||
        (rawText.match(/\b\d[-\s]\d{9}\b|\b\d{1,2}[-\s]\d{3,4}[-\s]\d{3,4}\b|\b\d{9,12}\b/) || [])[0],
    ),
    employer: cleanName(
      findTextByLabels(lines, normalizedLines, [
        "nombre del patrono",
        "patrono",
        "empleador",
        "empresa",
        "razon social",
      ]),
    ),
    grossIncome: orderSalary ?? grossIncome,
    netIncome: netIncome ?? ((orderSalary ?? grossIncome) && totalDeductions ? Math.max(0, (orderSalary ?? grossIncome)! - totalDeductions) : null),
    totalDeductions,
    strongObligations,
  };

  const product = detectProduct(text);
  const assetValue = findAmountByLabels(lines, normalizedLines, [
    "valor del bien",
    "valor vehiculo",
    "valor de vehiculo",
    "precio",
    "monto",
    "proforma",
    "valor propiedad",
    "valor vivienda",
  ]);
  const downPayment = findAmountByLabels(lines, normalizedLines, ["prima", "enganche", "aporte"]);
  const requestedYears = findYears(text, product);
  const income = document.netIncome || document.grossIncome || 0;
  const debt = strongObligations || 0;
  const confidence = scoreConfidence({ income, document, assetValue, product });
  const warnings: string[] = [];
  if (!document.netIncome && document.grossIncome) warnings.push("Solo encontre salario bruto; use ese monto como referencia.");
  if (!document.netIncome && !document.grossIncome) warnings.push("No encontre ingreso claro en el documento.");
  if (totalDeductions && !strongObligations) warnings.push("Detecte deducciones, pero no las trate como deuda bancaria sin etiqueta de prestamo/embargo/pension.");

  return {
    ok: rawText.trim().length >= 25 && confidence >= 0.35,
    confidence,
    document,
    profile: {
      product,
      income,
      debt,
      downPayment: downPayment || 0,
      assetValue: assetValue || 0,
      requestedYears,
    },
    notes: buildNotes(document, product),
    warnings,
  };
}

export function extractPdfText(bytes: Buffer): string {
  const streams = getPdfStreams(bytes);
  const cmap = buildPdfCMap(streams);
  const lines: PositionedText[] = [];
  const looseChunks: string[] = [];

  for (const stream of streams) {
    lines.push(...extractPositionedText(stream, cmap));
    looseChunks.push(...extractLooseText(stream, cmap));
  }

  const positioned = renderPositionedLines(lines);
  if (positioned.trim().length >= 28) return positioned.trim();
  const loose = looseChunks.join("\n");
  return `${positioned}\n${loose}`
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractDocxText(buffer: Buffer): string {
  const xmlBuffer = readZipEntry(buffer, "word/document.xml");
  if (!xmlBuffer) return "";
  const xml = xmlBuffer.toString("utf8");
  const chunks: string[] = [];
  for (const match of xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)) {
    chunks.push(decodeXml(match[1] || ""));
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

// ---------- Helpers internos ----------

function failed(reason: string, message: string): DocumentResult {
  return {
    ok: false,
    reason,
    message,
    textLength: 0,
    extractedText: "",
    preview: "",
    confidence: 0,
    document: {
      name: null,
      idNumber: null,
      employer: null,
      grossIncome: null,
      netIncome: null,
      totalDeductions: null,
      strongObligations: null,
    },
    profile: {
      product: "",
      income: 0,
      debt: 0,
      downPayment: 0,
      assetValue: 0,
      requestedYears: 0,
    },
    notes: [],
    warnings: [message],
  };
}

function detectDocumentType(contentType: string, buffer: Buffer | null): string {
  const type = String(contentType || "").split(";")[0].toLowerCase();
  if (type.includes("pdf") || startsWith(buffer, "%PDF")) return "pdf";
  if (type.includes("wordprocessingml") || isZip(buffer)) return "docx";
  if (type.includes("msword")) return "doc";
  if (type.startsWith("image/")) return "image";
  if (type.includes("csv")) return "text";
  if (type.startsWith("text/")) return "text";
  return "text";
}

function startsWith(buffer: Buffer | null, value: string): boolean {
  if (!buffer) return false;
  return buffer.subarray(0, value.length).toString("latin1") === value;
}

function isZip(buffer: Buffer | null): boolean {
  return !!buffer && buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50;
}

function decodeText(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const badChars = (utf8.match(/\uFFFD/g) || []).length;
  if (badChars < 3) return utf8;
  return buffer.toString("latin1");
}

// ---------- ZIP / DOCX ----------

function readZipEntry(buffer: Buffer, wantedName: string): Buffer | null {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) return null;
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  let offset = centralOffset;
  const end = centralOffset + centralSize;

  while (offset < end && offset + 46 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    if (name === wantedName) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      return null;
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66000); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ---------- PDF: streams + cifrado RC4 ----------

function getPdfStreams(bytes: Buffer): string[] {
  const raw = bytes.toString("latin1");
  const streams: string[] = [raw];
  const encryption = getEncryptionContext(raw);

  for (const match of raw.matchAll(/(\d+)\s+(\d+)\s+obj([\s\S]*?)stream\r?\n/g)) {
    const start = (match.index || 0) + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end <= start) continue;

    const declaredLength = Number((match[3] || "").match(/\/Length\s+(\d+)/)?.[1] || 0);
    let chunk = bytes.subarray(start, declaredLength > 0 ? Math.min(start + declaredLength, end) : end);
    if (encryption) chunk = decryptPdfObject(chunk, encryption.key, Number(match[1]), Number(match[2]));

    try {
      streams.push(inflateSync(chunk).toString("latin1"));
    } catch {
      try {
        streams.push(inflateSync(chunk.subarray(0, Math.max(0, chunk.length - 1))).toString("latin1"));
      } catch {
        streams.push(chunk.toString("latin1"));
      }
    }
  }

  return streams;
}

const PASSWORD_PADDING = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

interface EncryptionContext {
  key: Buffer;
}

function getEncryptionContext(raw: string): EncryptionContext | null {
  if (!/\/Encrypt\s+\d+\s+\d+\s+R/.test(raw)) return null;
  const encryptionRef = raw.match(/\/Encrypt\s+(\d+)\s+(\d+)\s+R/);
  if (!encryptionRef) return null;
  const dictMatch = raw.match(new RegExp(`${encryptionRef[1]}\\s+${encryptionRef[2]}\\s+obj([\\s\\S]*?)endobj`));
  const dict = dictMatch?.[1] || "";
  const revision = Number(dict.match(/\/R\s+(\d+)/)?.[1] || 0);
  const version = Number(dict.match(/\/V\s+(\d+)/)?.[1] || 0);
  const lengthBits = Number(dict.match(/\/Length\s+(\d+)/)?.[1] || (version === 1 ? 40 : 128));
  const permissions = Number(dict.match(/\/P\s+(-?\d+)/)?.[1] || 0);
  const owner = readPdfByteString(dict, "/O");
  const firstId = readFirstFileId(raw);
  if (!owner || !firstId || revision < 2 || ![1, 2].includes(version)) return null;

  let digest = md5(Buffer.concat([PASSWORD_PADDING, owner, int32LE(permissions), firstId]));
  const keyLength = Math.max(5, Math.min(16, Math.floor(lengthBits / 8)));
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) digest = md5(digest.subarray(0, keyLength));
  }
  return { key: digest.subarray(0, keyLength) };
}

function decryptPdfObject(value: Buffer, fileKey: Buffer, objectNumber: number, generation: number): Buffer {
  const objectKey = md5(
    Buffer.concat([
      fileKey,
      Buffer.from([
        objectNumber & 0xff,
        (objectNumber >> 8) & 0xff,
        (objectNumber >> 16) & 0xff,
        generation & 0xff,
        (generation >> 8) & 0xff,
      ]),
    ]),
  ).subarray(0, Math.min(fileKey.length + 5, 16));
  return rc4(objectKey, value);
}

function readPdfByteString(source: string, key: string): Buffer | null {
  const start = source.indexOf(key);
  if (start === -1) return null;
  let i = start + key.length;
  while (/\s/.test(source[i] || "")) i++;
  if (source[i] === "<") {
    const end = source.indexOf(">", i + 1);
    if (end === -1) return null;
    return Buffer.from(source.slice(i + 1, end).replace(/\s+/g, ""), "hex");
  }
  if (source[i] !== "(") return null;
  i++;
  const bytes: number[] = [];
  let depth = 1;
  while (i < source.length && depth > 0) {
    const ch = source.charCodeAt(i);
    if (ch === 0x5c) {
      const next = source[i + 1] || "";
      const octal = source.slice(i + 1).match(/^[0-7]{1,3}/)?.[0];
      if (octal) {
        bytes.push(parseInt(octal, 8) & 0xff);
        i += 1 + octal.length;
        continue;
      }
      const mapped: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 };
      if (next === "\r" || next === "\n") {
        i += next === "\r" && source[i + 2] === "\n" ? 3 : 2;
        continue;
      }
      bytes.push(mapped[next] || next.charCodeAt(0));
      i += 2;
      continue;
    }
    if (ch === 0x28) depth++;
    if (ch === 0x29) {
      depth--;
      if (depth === 0) break;
    }
    bytes.push(ch & 0xff);
    i++;
  }
  return Buffer.from(bytes);
}

function readFirstFileId(raw: string): Buffer | null {
  const match = raw.match(/\/ID\s*\[\s*<([\da-fA-F]+)>/);
  return match ? Buffer.from(match[1], "hex") : null;
}

function int32LE(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32LE(value, 0);
  return buffer;
}

function md5(value: Buffer): Buffer {
  return createHash("md5").update(value).digest();
}

function rc4(key: Buffer, input: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const output = Buffer.alloc(input.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < input.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
    output[n] = input[n] ^ s[(s[i] + s[j]) & 0xff];
  }
  return output;
}

// ---------- PDF: CMap + extraccion de texto posicionado ----------

function buildPdfCMap(streams: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const stream of streams) {
    for (const block of stream.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const match of (block[1] || "").matchAll(/<([\da-fA-F]{4,})>\s+<([\da-fA-F]{4,})>/g)) {
        map.set(match[1].toUpperCase(), decodeUnicodeHex(match[2]));
      }
    }
    for (const block of stream.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const match of (block[1] || "").matchAll(/<([\da-fA-F]{4,})>\s+<([\da-fA-F]{4,})>\s+<([\da-fA-F]{4,})>/g)) {
        const start = parseInt(match[1], 16);
        const end = parseInt(match[2], 16);
        const dest = parseInt(match[3], 16);
        for (let code = start; code <= end && code - start < 300; code++) {
          map.set(code.toString(16).toUpperCase().padStart(match[1].length, "0"), String.fromCodePoint(dest + code - start));
        }
      }
    }
  }
  return map;
}

interface PositionedText {
  x: number;
  y: number;
  text: string;
}

function extractPositionedText(stream: string, cmap: Map<string, string>): PositionedText[] {
  const rows: PositionedText[] = [];
  for (const match of stream.matchAll(/BT([\s\S]*?)ET/g)) {
    const block = match[1] || "";
    const text = decodePdfTextTokens(block, cmap).trim();
    if (!text || /ActualText\s*<FEFF200B>/i.test(block)) continue;
    const position = findTextPosition(block);
    rows.push({ x: position.x, y: position.y, text });
  }
  return rows;
}

function extractLooseText(stream: string, cmap: Map<string, string>): string[] {
  const chunks: string[] = [];
  for (const match of stream.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) {
    chunks.push(unescapePdfLiteral(match[0].replace(/\)\s*Tj$/, "").slice(1)));
  }
  for (const match of stream.matchAll(/<([\da-fA-F\s]+)>\s*Tj/g)) {
    chunks.push(decodePdfHex(match[1] || "", cmap));
  }
  for (const match of stream.matchAll(/\[([\s\S]{0,4000}?)\]\s*TJ/g)) {
    chunks.push(decodePdfTextTokens(match[1] || "", cmap));
  }
  return chunks.filter(Boolean);
}

function renderPositionedLines(items: PositionedText[]): string {
  if (items.length === 0) return "";
  const grouped = new Map<number, PositionedText[]>();
  for (const item of items) {
    const key = Math.round(item.y / 2) * 2;
    const current = grouped.get(key) || [];
    current.push(item);
    grouped.set(key, current);
  }
  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ").replace(/\s+([:,.])/g, "$1"))
    .join("\n");
}

function findTextPosition(block: string): { x: number; y: number } {
  const tdMatches = Array.from(block.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Td/g));
  const lastTd = tdMatches[tdMatches.length - 1];
  if (lastTd) return { x: Number(lastTd[1]), y: Math.abs(Number(lastTd[2])) };
  const tm = block.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm/);
  if (tm) return { x: Number(tm[5]), y: Math.abs(Number(tm[6])) };
  return { x: 0, y: 0 };
}

function decodePdfTextTokens(block: string, cmap: Map<string, string>): string {
  const chunks: string[] = [];
  for (const match of block.matchAll(/\((?:\\.|[^\\)])*\)|<([\da-fA-F\s]+)>/g)) {
    const token = match[0];
    if (token.startsWith("(")) chunks.push(unescapePdfLiteral(token.slice(1, -1)));
    else chunks.push(decodePdfHex(match[1] || "", cmap));
  }
  return chunks.join("");
}

function unescapePdfLiteral(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{1,3})/g, (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

function decodePdfHex(value: string, cmap: Map<string, string> = new Map()): string {
  const clean = value.replace(/\s+/g, "");
  if (!clean) return "";
  if (cmap.size > 0 && clean.length % 4 === 0) {
    const mapped: string[] = [];
    for (let i = 0; i < clean.length; i += 4) {
      const code = clean.slice(i, i + 4).toUpperCase();
      mapped.push(cmap.get(code) || "");
    }
    const text = mapped.join("");
    if (text) return text;
  }
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2).padEnd(2, "0"), 16));
  const buffer = Buffer.from(bytes);
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(Math.max(0, buffer.length - 2));
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString("utf16le");
  }
  return buffer.toString("latin1");
}

function decodeUnicodeHex(value: string): string {
  const clean = value.replace(/\s+/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
  const buffer = Buffer.from(bytes);
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString("utf16le");
  }
  if (clean.length <= 6) return String.fromCodePoint(parseInt(clean, 16));
  return buffer.toString("utf8");
}

// ---------- Parsing financiero (texto libre + CSV) ----------

function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u00a2\u20a1]/g, "CRC ")
    .replace(/[ \t]+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseCsvFinancialDocument(rawText: string): ParsedDocument | null {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const delimiter = detectDelimiter(lines[0]);
  if (!delimiter) return null;

  const headers = splitCsvLine(lines[0], delimiter).map(normalizeText);
  const values = splitCsvLine(lines[1], delimiter);
  if (headers.length < 2 || values.length < 2) return null;

  const get = (names: string[]): string => {
    for (const name of names.map(normalizeText)) {
      const index = headers.findIndex((header) => header === name || header.includes(name));
      if (index !== -1 && values[index] !== undefined) return values[index].trim();
    }
    return "";
  };

  const netIncome = parseAmount(get(["salario neto", "neto", "ingreso", "ingreso neto", "sueldo neto"]));
  const grossIncome = parseAmount(get(["salario bruto", "bruto", "sueldo bruto"]));
  const debt = parseAmount(get(["deuda", "deudas", "deuda prestamo", "prestamo", "cuota", "cuotas"]));
  const assetValue = parseAmount(get(["monto", "valor", "valor bien", "valor vehiculo", "precio", "proforma"]));
  const downPayment = parseAmount(get(["prima", "enganche", "aporte"]));
  const rawProduct = normalizeText(get(["producto", "tipo", "prestamo", "credito"]));
  const product = detectProduct(rawProduct || rawText);
  const requestedYears = findYears(normalizeText(get(["plazo", "anos", "a\u00f1os"]) || rawText), product);

  if (!netIncome && !grossIncome && !assetValue) return null;

  const document: DocumentData = {
    name: cleanName(get(["nombre", "cliente", "trabajador", "empleado"])),
    idNumber: normalizeId(get(["cedula", "identificacion", "documento", "id"])),
    employer: cleanName(get(["patrono", "empleador", "empresa"])),
    grossIncome: grossIncome || null,
    netIncome: netIncome || null,
    totalDeductions: null,
    strongObligations: debt || null,
  };

  const income = document.netIncome || document.grossIncome || 0;
  const confidence = scoreConfidence({ income, document, assetValue, product });

  return {
    ok: confidence >= 0.35,
    confidence,
    document,
    profile: {
      product,
      income,
      debt: debt || 0,
      downPayment: downPayment || 0,
      assetValue: assetValue || 0,
      requestedYears,
    },
    notes: buildNotes(document, product),
    warnings: [],
  };
}

function detectDelimiter(headerLine: string): string | null {
  const candidates = [",", ";", "\t"];
  const scored = candidates
    .map((delimiter) => ({ delimiter, count: splitCsvLine(headerLine, delimiter).length }))
    .sort((a, b) => b.count - a.count);
  return scored[0].count > 1 ? scored[0].delimiter : null;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function detectSalaryOrderPatronal(rawText: string): number | null {
  for (const line of rawText.split(/\r?\n/)) {
    if (!/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\s+20\d{2}\b/i.test(line)) continue;
    const amounts = Array.from(line.matchAll(/(?<!\d)\d{1,3}(?:[\s.,']\d{3})+(?:[.,]\d{2})?/g))
      .map((match) => parseAmount(match[0]))
      .filter((value): value is number => value !== null && value >= 100000);
    if (amounts[0]) return amounts[0];
  }
  return null;
}

function findTextByLabels(lines: string[], normalizedLines: string[], labels: string[]): string | null {
  const normalizedLabels = labels.map(normalizeText);
  for (let i = 0; i < normalizedLines.length; i++) {
    for (const label of normalizedLabels) {
      const index = normalizedLines[i].indexOf(label);
      if (index === -1) continue;
      const sameLine = lines[i].slice(index + label.length).replace(/^[:\-\s]+/, "").trim();
      if (sameLine && !looksLikeOnlyAmount(sameLine)) return sameLine;
      const next = lines[i + 1] && lines[i + 1].trim();
      if (next && !looksLikeLabel(next)) return next;
    }
  }
  return null;
}

function findAmountByLabels(lines: string[], normalizedLines: string[], labels: string[]): number | null {
  const text = normalizedLines.join("\n");
  const normalizedLabels = labels.map(normalizeText);
  for (let i = 0; i < normalizedLines.length; i++) {
    for (const label of normalizedLabels) {
      const index = normalizedLines[i].indexOf(label);
      if (index === -1) continue;
      const sameLineAmount = extractAmount(lines[i].slice(index + label.length));
      if (sameLineAmount !== null) return sameLineAmount;
      const next = lines[i + 1] || "";
      if (next && !looksLikeLabel(next)) {
        const nextAmount = extractAmount(next);
        if (nextAmount !== null) return nextAmount;
      }
    }
  }

  for (const label of normalizedLabels) {
    const index = text.indexOf(label);
    if (index === -1) continue;
    const amount = extractAmount(text.slice(index, index + 160));
    if (amount !== null) return amount;
  }

  return null;
}

function extractAmount(value: string): number | null {
  if (!value) return null;
  const match = String(value).match(/(?<!\d)(?:CRC|COLONES|C|USD|\$|\u00a2|\u20a1)?\s*(?:\d{1,3}(?:[\s.,']\d{3})+(?:[.,]\d{2})?|\d{5,}(?:[.,]\d{2})?|\d+(?:[.,]\d+)?\s*(?:millones?|millon|mil))/i);
  if (!match) return null;
  return parseAmount(match[0]);
}

function parseAmount(raw: unknown): number | null {
  let s = String(raw || "")
    .toLowerCase()
    .replace(/crc|colones|usd|c|\u00a2|\u20a1|\$/gi, "")
    .replace(/'/g, "")
    .trim();
  const hasMillion = /millones?|millon/.test(s);
  const hasThousand = /\bmil\b/.test(s);
  s = s.replace(/millones?|millon|mil/g, "").replace(/\s/g, "");
  if (!s) return null;

  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    const parts = s.split(",");
    s = parts.at(-1)?.length === 2 ? `${parts.slice(0, -1).join("")}.${parts.at(-1)}` : s.replace(/,/g, "");
  } else if (s.includes(".")) {
    const parts = s.split(".");
    if (parts.at(-1)?.length !== 2) s = s.replace(/\./g, "");
  }

  const number = Number(s);
  if (!Number.isFinite(number)) return null;
  if (hasMillion) return Math.round(number * 1000000);
  if (hasThousand) return Math.round(number * 1000);
  return Math.round(number);
}

function detectProduct(text: string): string {
  if (/(casa|vivienda|hipoteca|hipotecario|apartamento|lote|terreno|propiedad|inmueble)/.test(text)) return "hipoteca";
  if (/(carro|auto|vehiculo|vehicular|moto|prendario|placa|vin|proforma)/.test(text)) return "vehiculo";
  return "personal";
}

function findYears(text: string, product: string): number {
  const labeled = text.match(/\bplazo\b\D{0,24}(\d{1,2})\s*(?:anos|ano|anios)?\b/);
  const match = labeled || text.match(/\b(\d{1,2})\s*(?:anos|ano|anios)\b/);
  const fallback = product === "hipoteca" ? 30 : product === "vehiculo" ? 6 : 5;
  return Math.max(1, Math.min(Number(match?.[1] || fallback), 30));
}

function scoreConfidence({
  income,
  document,
  assetValue,
  product,
}: {
  income: number;
  document: DocumentData;
  assetValue: number | null;
  product: string;
}): number {
  let score = 0;
  if (income) score += 0.45;
  if (document.name) score += 0.15;
  if (document.idNumber) score += 0.15;
  if (document.employer) score += 0.1;
  if (assetValue) score += 0.05;
  if (product) score += 0.1;
  return Math.max(0, Math.min(1, score));
}

function buildNotes(document: DocumentData, product: string): string[] {
  const notes: string[] = [];
  if (document.name) notes.push("Nombre: " + document.name);
  if (document.idNumber) notes.push("Cedula: " + document.idNumber);
  if (document.employer) notes.push("Patrono: " + document.employer);
  if (document.netIncome) notes.push("Ingreso neto: CRC " + document.netIncome.toLocaleString("es-CR"));
  if (document.grossIncome && !document.netIncome) notes.push("Ingreso bruto: CRC " + document.grossIncome.toLocaleString("es-CR"));
  notes.push("Producto detectado: " + product);
  return notes;
}

function normalizeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const firstStructured = String(raw).match(/\b\d[-\s]\d{9}\b|\b\d{1,2}[-\s]\d{3,4}[-\s]\d{3,4}\b|\b\d{9,12}\b/)?.[0];
  const digits = String(firstStructured || raw).replace(/\D/g, "");
  if (firstStructured && /^\s*\d[-\s]\d{9}\s*$/.test(firstStructured)) return firstStructured.replace(/\s+/g, "");
  if (digits.length === 9) return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5)}`;
  if (digits.length >= 9 && digits.length <= 12) return digits;
  return String(raw).replace(/\s+/g, "-").trim();
}

function cleanName(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = String(raw)
    .split(/\b(?:cedula|identificacion|salario|bruto|neto|patrono|periodo|telefono)\b/i)[0]
    .replace(/\b\d{1,2}[-\s]\d{3,4}[-\s]\d{3,4}\b|\b\d{9,12}\b/g, "")
    .replace(/(?:CRC|COLONES|USD|\u00a2|\u20a1|\$)?\s*\d[\d\s.,']+/gi, "")
    .replace(/[0-9:;|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 4) return null;
  if (looksLikeDocumentLabel(cleaned)) return null;
  return titleCase(cleaned);
}

function looksLikeDocumentLabel(value: unknown): boolean {
  return /numero|n[u\u00fa]mero|patronal|orden|comprobante|constancia|salario|deduccion|deducci[o\u00f3]n|seguro|social|ccss|pagina|fecha|periodo|per[i\u00ed]odo/i.test(
    String(value || ""),
  );
}

function detectName(lines: string[]): string | null {
  const banned = /CAJA|CCSS|SEGURO|SOCIAL|PATRONO|PERIODO|SALARIO|DEDUCCION|CEDULA|ORDEN|COMPROBANTE|CONSTANCIA/i;
  for (const line of lines.slice(0, 16)) {
    if (banned.test(line) || /\d/.test(line)) continue;
    const words = line.trim().split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && words.every((word) => word.length > 1)) return line;
  }
  return null;
}

function looksLikeOnlyAmount(value: string): boolean {
  return extractAmount(value) !== null && !/[a-zA-Z]{3,}/.test(value.replace(/CRC|USD|COLONES/gi, ""));
}

function looksLikeLabel(value: string): boolean {
  return /:/.test(value) || /cedula|nombre|salario|patrono|periodo|total|deduccion/i.test(value);
}

function titleCase(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/\b\p{L}/gu, (match) => match.toUpperCase())
    .trim();
}
