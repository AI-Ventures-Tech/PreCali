const { calcularPrecalificacion, consultarRequisitos } = require("./precali-tools");
const { resolverDuda } = require("./precali-agent");

const DEFAULT_CURRENCY = { CR: "CRC", MX: "MXN", GT: "GTQ", PA: "USD", HN: "HNL", NI: "NIO", SV: "USD" };
const PRODUCT_LABEL = { personal: "credito personal", vehiculo: "credito vehicular", hipoteca: "credito de vivienda" };
const PRODUCT_ASSET_WORD = { vehiculo: "vehiculo", hipoteca: "propiedad" };
const LEAD_EMPTY = { fullName: "", idNumber: "", email: "", incomeSource: "", phoneOverride: "" };

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isResetCommand(text) {
  return /^(menu|reiniciar|empezar de nuevo|otro credito|volver al inicio|inicio)$/i.test(normalize(text));
}

function extractAmount(text) {
  const raw = normalize(text);
  if (!raw) return null;
  if (/^(0|cero|no\s*tengo|nada|ningun[oa]?|sin)$/i.test(raw)) return 0;

  const match = raw.match(/(\d+(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(millones?|mill\b|mil\b|k\b|m\b)?/);
  if (!match || !match[1]) return null;

  let numStr = match[1].replace(/\s/g, "");
  const suffix = match[2] || "";
  const hasDot = numStr.includes(".");
  const hasComma = numStr.includes(",");

  if (suffix) {
    numStr = numStr.replace(",", ".");
  } else if (hasDot && hasComma) {
    numStr = numStr.lastIndexOf(",") > numStr.lastIndexOf(".")
      ? numStr.replace(/\./g, "").replace(",", ".")
      : numStr.replace(/,/g, "");
  } else if (hasComma) {
    const parts = numStr.split(",");
    numStr = parts[parts.length - 1].length === 2 ? parts.join(".") : numStr.replace(/,/g, "");
  } else if (hasDot) {
    const parts = numStr.split(".");
    if (parts.length > 2 || parts[parts.length - 1].length !== 2) numStr = numStr.replace(/\./g, "");
  }

  let value = Number(numStr);
  if (!Number.isFinite(value)) return null;
  if (/^mill/.test(suffix)) value *= 1000000;
  else if (/^mil$/.test(suffix)) value *= 1000;
  else if (/^k$/.test(suffix)) value *= 1000;
  else if (/^m$/.test(suffix)) value *= 1000000;
  return Math.max(0, Math.round(value));
}

function isApproximateAmount(text) {
  return /\b(como|aprox|aproximad|mas o menos|alrededor|cerca de|tipo)\b/i.test(normalize(text));
}

function exactAmountMessage(label) {
  return `Necesito el monto exacto de ${label}. Escribilo solo como numero, por ejemplo: 150000.`;
}

function money(value, currency) {
  return currency + " " + Math.max(0, Math.round(Number(value) || 0)).toLocaleString("es-CR");
}

function visibleOpciones(calc) {
  const opciones = (calc && calc.opciones) || [];
  if (!opciones.length) return [];
  const top = opciones.slice(0, 3);
  const recomendado = calc.recomendacion && calc.recomendacion.banco
    ? opciones.find((o) => o.banco === calc.recomendacion.banco)
    : null;
  if (!recomendado || top.some((o) => o.banco === recomendado.banco)) return top;
  return [recomendado, ...top].slice(0, 3);
}

function topBankOptions(session) {
  return visibleOpciones(session.lastResults)
    .slice(0, 3)
    .map((o, i) => ({ id: "banco_" + i, title: o.banco.slice(0, 20) }));
}

function bankFromSelection(session, buttonPayload, bodyText) {
  const visibles = visibleOpciones(session.lastResults);
  const match = /^banco_(\d+)$/.exec(buttonPayload || "");
  if (match && visibles[Number(match[1])]) return visibles[Number(match[1])].banco;
  if (bodyText) {
    const text = normalize(bodyText);
    const found = visibles.find((o) => text.includes(normalize(o.banco)));
    if (found) return found.banco;
  }
  return "";
}

function parseLeadData(text) {
  const raw = String(text || "").trim();
  const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const idNumber = raw.match(/\b\d[-\s]?\d{3,4}[-\s]?\d{3,5}\b|\b\d{7,15}\b/)?.[0] || "";
  const cleaned = raw
    .replace(email, " ")
    .replace(idNumber, " ")
    .replace(/nombre|cedula|c[eé]dula|identidad|correo|email|e-mail/gi, " ");
  const fullName = cleaned
    .split(/\n|,|;/)
    .map((part) => part.trim())
    .find((part) => /[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ]{2,}\s+[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ]{2,}/.test(part)) || "";
  return { fullName, idNumber, email };
}

function requestedDocuments(session) {
  const docs = [];
  const source = session.lead && session.lead.incomeSource;
  if (source === "asalariado") docs.push("Orden patronal o comprobantes de pago recientes.");
  if (source === "independiente") docs.push("Certificacion de ingresos por CPA o estados de cuenta de los ultimos 6 meses.");
  if (session.profile.product === "vehiculo") docs.push("Proforma del vehiculo.");
  if (session.profile.product === "hipoteca") docs.push("Proforma, opcion de compra o avaluo preliminar de la propiedad.");
  return docs;
}

function extractDocumentSummary(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  const cedula = clean.match(/(?:cedula|c[eé]dula|identidad)[:\s-]*([0-9][0-9\-\s]{6,18})/i)?.[1]?.trim() || "";
  const patrono = clean.match(/(?:patrono|empresa|empleador)[:\s-]*([A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9 .,&-]{3,60}?)(?=\s+(?:salario|ingreso|neto|cedula|c[eé]dula)\b|$)/i)?.[1]?.trim() || "";
  const salario = clean.match(/(?:salario|ingreso|neto|liquido|l[ií]quido)[:\s-]*(?:CRC|₡|USD|\$)?\s*([0-9][0-9.,\s]{3,18})/i)?.[1]?.trim() || "";
  const lines = [];
  if (salario) lines.push(`Ingreso detectado: ${salario}`);
  if (patrono) lines.push(`Patrono detectado: ${patrono}`);
  if (cedula) lines.push(`Cedula detectada: ${cedula}`);
  if (!lines.length) lines.push("Documento recibido. No pude leer todos los campos automaticamente.");
  return lines.join("\n");
}

function formatResultados(calc) {
  if (!calc.opciones.length) {
    const lines = ["Con esos datos, hoy *ningun banco de PreCali* te califica todavia."];
    const aviso = calc.avisos[0];
    if (aviso) lines.push(aviso.detalle);
    lines.push("Quieres que ajustemos algun dato, como deuda, ingreso o prima?");
    return lines.join("\n");
  }

  const lines = [`Comparativa preliminar para ${calc.producto}:`, ""];
  for (const o of visibleOpciones(calc)) {
    lines.push(
      `*${o.banco}*`,
      `- Tasa: ${o.tasa_anual_pct}% anual | Plazo: ${o.plazo_anos} anos`,
      `- Cuota estimada: *${money(o.cuota_mensual, calc.moneda)}/mes*`,
      `- Monto maximo: ${money(o.monto_maximo, calc.moneda)}`,
      ""
    );
  }
  if (calc.calidad_datos && calc.calidad_datos.startsWith("referencial")) {
    lines.push("Datos referenciales para tu pais, en validacion con cada banco.");
  }
  return lines.join("\n").trim();
}

async function manejarDuda({ session, userText }) {
  const result = await resolverDuda({
    aiHistory: session.aiHistory,
    userText,
    context: { country: session.profile.country, step: session.step, profile: session.profile },
  });
  return { message: result.message, aiHistory: result.aiHistory };
}

function actionListaProducto() {
  return actionBotones(
    "Hola. Soy *PreCali IA*, tu asesor de credito. Que queres simular hoy?",
    [
      { id: "personal", title: "Personal" },
      { id: "vehiculo", title: "Vehiculo" },
      { id: "hipoteca", title: "Vivienda" },
    ]
  );
}

function actionBotones(body, options) {
  return { kind: "buttons", body, options };
}

function actionTexto(body) {
  return { kind: "text", body };
}

function start(session) {
  const s = { ...session, step: "pedir_producto" };
  return { actions: [actionListaProducto()], session: s };
}

function detectProductFromText(text) {
  const t = normalize(text);
  if (/^1$/.test(t) || /personal|consumo|libre inversion/.test(t)) return "personal";
  if (/^2$/.test(t) || /carro|auto|vehicul|moto|pickup|camioneta/.test(t)) return "vehiculo";
  if (/^3$/.test(t) || /casa|vivienda|hipotec|apto|apartamento|terreno|lote|propiedad/.test(t)) return "hipoteca";
  return null;
}

async function stepPedirProducto({ session, buttonPayload, bodyText, defaultCountry }) {
  let product = null;
  if (["personal", "vehiculo", "hipoteca"].includes(buttonPayload)) product = buttonPayload;
  else if (bodyText) product = detectProductFromText(bodyText);

  if (!product) {
    return { actions: [actionListaProducto()], session };
  }

  const country = session.profile.country || defaultCountry || "CR";
  const currency = DEFAULT_CURRENCY[country] || "CRC";
  const s = {
    ...session,
    step: "pedir_ingreso",
    lead: session.lead || { ...LEAD_EMPTY },
    profile: { ...session.profile, product, country, currency },
  };

  return {
    actions: [actionTexto(
      `Perfecto, *${PRODUCT_LABEL[product]}*.\nNecesito tu ingreso neto mensual exacto.\nEscribilo solo como numero, por ejemplo: 850000.`
    )],
    session: s,
  };
}

async function stepPedirIngreso({ session, bodyText }) {
  const amount = extractAmount(bodyText);
  if (amount === null || amount <= 0 || isApproximateAmount(bodyText)) {
    return { actions: [actionTexto(exactAmountMessage("ingreso neto mensual"))], session };
  }

  const s = { ...session, step: "pedir_deudas", profile: { ...session.profile, income: amount } };
  return {
    actions: [actionTexto("Ahora necesito el total exacto de tus deudas mensuales.\nInclui tarjetas, prestamos u otras cuotas.\nSi no tenes deudas, escribi 0.")],
    session: s,
  };
}

async function stepPedirDeudas({ session, bodyText }) {
  const amount = extractAmount(bodyText);
  if (amount === null || isApproximateAmount(bodyText)) {
    return { actions: [actionTexto(exactAmountMessage("deudas mensuales"))], session };
  }

  const profile = { ...session.profile, debt: amount };
  if (profile.product === "personal") {
    return calcularYMostrar({ ...session, profile });
  }

  const s = { ...session, step: "pedir_prima", profile };
  const bien = PRODUCT_ASSET_WORD[profile.product] || "bien";
  return {
    actions: [actionTexto(`Bien. Ahora necesito la prima o enganche exacto para ${bien === "propiedad" ? "la" : "el"} ${bien}.\nSi no tenes prima, escribi 0.`)],
    session: s,
  };
}

async function stepPedirPrima({ session, bodyText }) {
  const amount = extractAmount(bodyText);
  if (amount === null || isApproximateAmount(bodyText)) {
    return { actions: [actionTexto(exactAmountMessage("prima o enganche"))], session };
  }

  const profile = { ...session.profile, downPayment: amount };
  return calcularYMostrar({ ...session, profile });
}

function postResultActions() {
  return actionBotones("Que queres hacer?", [
    { id: "aplicar", title: "Aplicar" },
    { id: "requisitos", title: "Requisitos" },
    { id: "ahora_no", title: "Ahora no" },
  ]);
}

async function calcularYMostrar(session) {
  const calc = calcularPrecalificacion(session.profile);
  const s = { ...session, step: "post_resultado", lastResults: calc };
  if (!s.lead) s.lead = { ...LEAD_EMPTY };

  const texto = formatResultados(calc);
  if (!calc.opciones.length) {
    return {
      actions: [actionTexto(texto), actionBotones("Que queres hacer?", [
        { id: "otro_dato", title: "Cambiar dato" },
        { id: "menu", title: "Nuevo credito" },
        { id: "ahora_no", title: "Ahora no" },
      ])],
      session: s,
    };
  }

  return { actions: [actionTexto(texto), postResultActions()], session: s };
}

async function stepPostResultado({ session, buttonPayload, bodyText }) {
  if (buttonPayload === "aplicar") {
    const s = { ...session, step: "elegir_banco_aplicar" };
    return { actions: [actionBotones("A que banco queres aplicar?", topBankOptions(session))], session: s };
  }

  if (buttonPayload === "requisitos") {
    const s = { ...session, step: "elegir_banco_requisitos" };
    return { actions: [actionBotones("De que banco queres ver requisitos?", topBankOptions(session))], session: s };
  }

  if (buttonPayload === "ahora_no") {
    const s = { ...session, step: "pausado" };
    return { actions: [actionTexto("De acuerdo. El chat conserva tu avance por aproximadamente un mes. Cuando quieras retomar, escribi menu.")], session: s };
  }

  if (buttonPayload === "menu" || isResetCommand(bodyText)) return start({ ...session, step: "inicio" });

  if (buttonPayload === "otro_dato") {
    const s = { ...session, step: "pedir_ingreso" };
    return { actions: [actionTexto("Empecemos de nuevo con tu ingreso neto mensual exacto.")], session: s };
  }

  const bank = bankFromSelection(session, buttonPayload, bodyText);
  if (bank) return goToLeadCapture(session, bank);

  const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
  return { actions: [actionTexto(message), postResultActions()], session: { ...session, aiHistory } };
}

async function stepElegirBancoAplicar({ session, buttonPayload, bodyText }) {
  const bank = bankFromSelection(session, buttonPayload, bodyText);
  if (!bank) {
    return { actions: [actionBotones("Selecciona el banco para aplicar.", topBankOptions(session))], session };
  }
  return goToLeadCapture(session, bank);
}

async function stepElegirBancoRequisitos({ session, buttonPayload, bodyText }) {
  const bank = bankFromSelection(session, buttonPayload, bodyText);
  if (!bank) {
    return { actions: [actionBotones("Selecciona el banco para ver requisitos.", topBankOptions(session))], session };
  }

  const result = consultarRequisitos({ banco: bank, producto: session.profile.product, pais: session.profile.country });
  const lines = result.encontrado
    ? [`Requisitos para *${result.banco}*:`]
    : [`No encontre requisitos cargados para *${bank}*.`];
  if (result.encontrado) {
    for (const group of result.requisitos || []) {
      lines.push(`*${group.categoria || "Documento"}*`);
      for (const item of group.items || []) lines.push(`- ${item}`);
    }
  }
  return { actions: [actionTexto(lines.join("\n")), postResultActions()], session: { ...session, step: "post_resultado" } };
}

function goToLeadCapture(session, bankName) {
  const s = {
    ...session,
    step: "lead_datos",
    targetBank: bankName,
    lead: session.lead || { ...LEAD_EMPTY },
  };
  return {
    actions: [actionTexto(
      `Para preparar tu expediente para *${bankName}*, necesito estos datos en un solo mensaje:\n` +
      "Nombre completo\nCedula o identificacion\nCorreo electronico\n\n" +
      "El telefono sera el mismo desde el que escribiste, salvo que indiques otro."
    )],
    session: s,
  };
}

async function stepLeadDatos({ session, bodyText }) {
  const parsed = parseLeadData(bodyText);
  const missing = [];
  if (!parsed.fullName) missing.push("nombre completo");
  if (!parsed.idNumber) missing.push("cedula o identificacion");
  if (!parsed.email) missing.push("correo electronico");
  if (missing.length) {
    return { actions: [actionTexto(`Me falta: ${missing.join(", ")}.\nEnviamelo en un solo mensaje para continuar.`)], session };
  }

  const s = {
    ...session,
    step: "lead_fuente_ingresos",
    lead: { ...(session.lead || LEAD_EMPTY), ...parsed },
  };
  return {
    actions: [actionBotones("Cual es tu fuente principal de ingresos?", [
      { id: "asalariado", title: "Asalariado" },
      { id: "independiente", title: "Independiente" },
      { id: "duda", title: "Tengo duda" },
    ])],
    session: s,
  };
}

async function stepLeadFuenteIngresos({ session, buttonPayload, bodyText }) {
  let source = "";
  const text = normalize(bodyText);
  if (buttonPayload === "asalariado" || /asalariad|emplead|planilla/.test(text)) source = "asalariado";
  if (buttonPayload === "independiente" || /independ|negocio|freelance|propio/.test(text)) source = "independiente";
  if (!source) {
    return { actions: [actionBotones("Selecciona tu fuente principal de ingresos.", [
      { id: "asalariado", title: "Asalariado" },
      { id: "independiente", title: "Independiente" },
      { id: "duda", title: "Tengo duda" },
    ])], session };
  }

  const s = {
    ...session,
    step: "esperar_documentos",
    lead: { ...(session.lead || LEAD_EMPTY), incomeSource: source },
  };
  const docs = requestedDocuments(s).map((doc) => `- ${doc}`).join("\n");
  return {
    actions: [actionTexto(
      `Para enviar tu expediente a *${session.targetBank}*, subi por este chat:\n${docs}\n\n` +
      "Cuando los recibamos, te pedire autorizacion para el estudio inicial gratuito de PreCali."
    )],
    session: s,
  };
}

async function stepEsperarDocumentos({ session, bodyText }) {
  if (!String(bodyText || "").startsWith("[DOCUMENTO_RECIBIDO]")) {
    const docs = requestedDocuments(session).map((doc) => `- ${doc}`).join("\n");
    return { actions: [actionTexto(`Aun necesito que subas los documentos por este chat:\n${docs}`)], session };
  }

  const documentText = String(bodyText).replace("[DOCUMENTO_RECIBIDO]", "").trim();
  const s = { ...session, step: "autorizar_soft_precali", documentText };
  return {
    actions: [actionBotones(
      "Recibi tus documentos. Para que PreCali realice el estudio crediticio inicial gratuito y cruce los datos, necesito tu autorizacion. Autorizas?",
      [
        { id: "soft_precali_si", title: "Si autorizo" },
        { id: "duda", title: "Tengo duda" },
        { id: "soft_precali_no", title: "Ahora no" },
      ]
    )],
    session: s,
  };
}

async function stepAutorizarSoftPreCali({ session, buttonPayload, bodyText }) {
  if (buttonPayload === "soft_precali_si" || /^(si|autorizo|acepto|dale)$/i.test(normalize(bodyText))) {
    const summary = extractDocumentSummary(session.documentText);
    const s = { ...session, step: "confirmar_datos_extraidos", extractedSummary: summary };
    return {
      actions: [actionBotones(
        `Estudio inicial PreCali listo.\n${summary}\n\nConfirmas que estos datos son correctos?`,
        [
          { id: "datos_ok", title: "Correcto" },
          { id: "datos_corregir", title: "Corregir" },
          { id: "duda", title: "Tengo duda" },
        ]
      )],
      session: s,
    };
  }
  if (buttonPayload === "soft_precali_no" || /^(no|ahora no|luego)$/i.test(normalize(bodyText))) {
    return { actions: [actionTexto("De acuerdo. No realizaremos el estudio inicial sin tu autorizacion.")], session: { ...session, step: "pausado" } };
  }
  const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
  return { actions: [actionTexto(message), redisplayStep(session)[0]], session: { ...session, aiHistory } };
}

async function stepConfirmarDatosExtraidos({ session, buttonPayload, bodyText }) {
  if (buttonPayload === "datos_ok" || /^(si|correcto|ok|esta bien)$/i.test(normalize(bodyText))) {
    return goToHardPull(session, session.targetBank);
  }
  if (buttonPayload === "datos_corregir") {
    return { actions: [actionTexto("Indica la correccion en un solo mensaje. La agregare como nota antes de enviarlo al banco.")], session: { ...session, step: "corregir_datos_extraidos" } };
  }
  const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
  return { actions: [actionTexto(message), redisplayStep(session)[0]], session: { ...session, aiHistory } };
}

async function stepCorregirDatosExtraidos({ session, bodyText }) {
  const s = { ...session, correctionNote: String(bodyText || "").trim(), step: "confirmar_datos_extraidos" };
  return {
    actions: [actionBotones("Correccion registrada. Confirmas que ya podemos continuar con la autorizacion bancaria?", [
      { id: "datos_ok", title: "Continuar" },
      { id: "datos_corregir", title: "Corregir mas" },
      { id: "duda", title: "Tengo duda" },
    ])],
    session: s,
  };
}

function goToHardPull(session, bankName) {
  const s = { ...session, step: "confirmar_hard_pull", targetBank: bankName };
  const body =
    `Para enviar tu expediente completo a *${bankName}* y que ellos realicen el estudio oficial de aprobacion, ` +
    `responde *Autorizo al banco*.`;
  return {
    actions: [actionBotones(body, [
      { id: "hard_si", title: "Autorizo banco" },
      { id: "duda", title: "Tengo duda" },
      { id: "hard_no", title: "Ahora no" },
    ])],
    session: s,
  };
}

async function stepConfirmarHardPull({ session, buttonPayload, bodyText }) {
  if (buttonPayload === "hard_si" || /autorizo al banco|autorizo banco|si autorizo|acepto/i.test(normalize(bodyText))) {
    const s = { ...session, step: "aplicado" };
    return {
      actions: [actionTexto(
        `Listo. Tu expediente quedo autorizado para *${session.targetBank}*.\n` +
        "Te mantendremos actualizado por este chat sobre la solicitud."
      )],
      session: s,
    };
  }
  if (buttonPayload === "hard_no" || /^(no|ahora no|luego)$/i.test(normalize(bodyText))) {
    return { actions: [actionTexto("Entendido. No enviaremos tu expediente al banco sin autorizacion.")], session: { ...session, step: "pausado" } };
  }
  const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
  return { actions: [actionTexto(message), redisplayStep(session)[0]], session: { ...session, aiHistory } };
}

async function stepLibre({ session, bodyText }) {
  if (isResetCommand(bodyText)) return start({ ...session, step: "inicio" });
  const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
  return { actions: [actionTexto(message)], session: { ...session, aiHistory } };
}

function redisplayStep(session) {
  switch (session.step) {
    case "pedir_producto":
      return [actionListaProducto()];
    case "pedir_ingreso":
      return [actionTexto("Necesito tu ingreso neto mensual exacto.")];
    case "pedir_deudas":
      return [actionTexto("Necesito el total exacto de tus deudas mensuales. Si no tenes, escribi 0.")];
    case "pedir_prima":
      return [actionTexto("Necesito la prima o enganche exacto. Si no tenes, escribi 0.")];
    case "post_resultado":
      return [postResultActions()];
    case "elegir_banco_aplicar":
      return [actionBotones("A que banco queres aplicar?", topBankOptions(session))];
    case "elegir_banco_requisitos":
      return [actionBotones("De que banco queres ver requisitos?", topBankOptions(session))];
    case "lead_datos":
      return [actionTexto("Enviame nombre completo, cedula o identificacion y correo electronico en un solo mensaje.")];
    case "lead_fuente_ingresos":
      return [actionBotones("Cual es tu fuente principal de ingresos?", [
        { id: "asalariado", title: "Asalariado" },
        { id: "independiente", title: "Independiente" },
        { id: "duda", title: "Tengo duda" },
      ])];
    case "esperar_documentos":
      return [actionTexto("Subi los documentos solicitados por este chat para continuar.")];
    case "autorizar_soft_precali":
      return [actionBotones("Autorizas el estudio crediticio inicial gratuito de PreCali?", [
        { id: "soft_precali_si", title: "Si autorizo" },
        { id: "duda", title: "Tengo duda" },
        { id: "soft_precali_no", title: "Ahora no" },
      ])];
    case "confirmar_datos_extraidos":
      return [actionBotones("Confirmas que los datos extraidos son correctos?", [
        { id: "datos_ok", title: "Correcto" },
        { id: "datos_corregir", title: "Corregir" },
        { id: "duda", title: "Tengo duda" },
      ])];
    case "confirmar_hard_pull":
      return [actionBotones(`Para enviar tu expediente a *${session.targetBank}*, responde *Autorizo al banco*.`, [
        { id: "hard_si", title: "Autorizo banco" },
        { id: "duda", title: "Tengo duda" },
        { id: "hard_no", title: "Ahora no" },
      ])];
    default:
      return [actionListaProducto()];
  }
}

async function handleIncoming({ session, bodyText, buttonPayload, buttonText, defaultCountry }) {
  const s = session || {};
  if (isResetCommand(bodyText) && !buttonPayload && s.step !== "inicio") {
    return start({ ...s, step: "inicio" });
  }

  switch (s.step) {
    case "inicio":
      return start(s);
    case "pedir_producto":
      return stepPedirProducto({ session: s, buttonPayload, bodyText, defaultCountry });
    case "pedir_ingreso":
      return stepPedirIngreso({ session: s, bodyText });
    case "pedir_deudas":
      return stepPedirDeudas({ session: s, bodyText });
    case "pedir_prima":
      return stepPedirPrima({ session: s, bodyText });
    case "post_resultado":
      return stepPostResultado({ session: s, buttonPayload, bodyText });
    case "elegir_banco_aplicar":
      return stepElegirBancoAplicar({ session: s, buttonPayload, bodyText });
    case "elegir_banco_requisitos":
      return stepElegirBancoRequisitos({ session: s, buttonPayload, bodyText });
    case "lead_datos":
      return stepLeadDatos({ session: s, bodyText });
    case "lead_fuente_ingresos":
      return stepLeadFuenteIngresos({ session: s, buttonPayload, bodyText });
    case "esperar_documentos":
      return stepEsperarDocumentos({ session: s, bodyText });
    case "autorizar_soft_precali":
      return stepAutorizarSoftPreCali({ session: s, buttonPayload, bodyText });
    case "confirmar_datos_extraidos":
      return stepConfirmarDatosExtraidos({ session: s, buttonPayload, bodyText });
    case "corregir_datos_extraidos":
      return stepCorregirDatosExtraidos({ session: s, bodyText });
    case "confirmar_hard_pull":
      return stepConfirmarHardPull({ session: s, buttonPayload, bodyText });
    case "aplicado":
    case "pausado":
      return stepLibre({ session: s, bodyText });
    default:
      return start(s);
  }
}

module.exports = {
  handleIncoming,
  redisplayStep,
  manejarDuda,
};
