const { calcularPrecalificacion } = require("./precali-tools");
const { resolverDuda } = require("./precali-agent");

// ============================================================
// PreCali AI — Flujo guiado (la maquina de estados)
// ============================================================
// Este modulo reemplaza la idea de "todo es conversacional". Cada
// paso sabe exactamente que pregunta y como mostrar las opciones.
// La IA (precali-agent.js) solo entra cuando la persona se sale
// del guion (pregunta algo en vez de responder lo esperado).
//
// Cada funcion de paso recibe la sesion actual + el mensaje
// entrante, y devuelve { actions, session }.
// actions es un arreglo de:
//   { kind: "text", body }
//   { kind: "list" }                          (la lista de producto)
//   { kind: "buttons", body, options }        (menu de 3 botones)

const DEFAULT_CURRENCY = { CR: "CRC", MX: "MXN", GT: "GTQ", PA: "USD", HN: "HNL", NI: "NIO", SV: "USD" };
const PRODUCT_LABEL = { personal: "crédito personal", vehiculo: "crédito vehicular", hipoteca: "crédito de vivienda" };
const PRODUCT_ASSET_WORD = { vehiculo: "vehículo", hipoteca: "propiedad" };

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

// ---------- Parseo de montos en texto libre (con contexto ya conocido) ----------

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

// ---------- Helpers de formato ----------

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

function formatResultados(calc) {
  if (!calc.opciones.length) {
    const lines = [
      `Con esos datos, hoy *ningún banco de PreCali* te califica todavía.`,
    ];
    const aviso = calc.avisos[0];
    if (aviso) lines.push(aviso.detalle);
    lines.push("¿Querés que ajustemos algún dato (por ejemplo, bajar el monto o sumar una prima)?");
    return lines.join("\n");
  }

  const top = visibleOpciones(calc);
  const lines = [`Listo, esto es lo que encontré para vos (${calc.producto}):`, ""];
  for (const o of top) {
    lines.push(
      `🏦 *${o.banco}*`,
      `• Tasa: ${o.tasa_anual_pct}% anual | Plazo: ${o.plazo_anos} años`,
      `• Cuota estimada: *${money(o.cuota_mensual, calc.moneda)}/mes*`,
      `• Monto máximo: ${money(o.monto_maximo, calc.moneda)}`,
      ""
    );
  }
  if (calc.calidad_datos && calc.calidad_datos.startsWith("referencial")) {
    lines.push("_(Datos referenciales para tu país, en validación con cada banco.)_");
  }
  return lines.join("\n").trim();
}

// ---------- Paso: duda / fuera de guion ----------

async function manejarDuda({ session, userText }) {
  const result = await resolverDuda({
    aiHistory: session.aiHistory,
    userText,
    context: { country: session.profile.country, step: session.step, profile: session.profile },
  });
  return { message: result.message, aiHistory: result.aiHistory };
}

// ---------- Construcción de acciones reutilizables ----------

function actionListaProducto() {
  return { kind: "list" };
}

function actionBotones(body, options) {
  return { kind: "buttons", body, options };
}

function actionTexto(body) {
  return { kind: "text", body };
}

// ---------- Paso: inicio ----------

function start(session) {
  const s = { ...session, step: "pedir_producto" };
  return { actions: [actionListaProducto()], session: s };
}

// ---------- Paso: pedir_producto ----------

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
    const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
    const s = { ...session, aiHistory };
    return {
      actions: [actionTexto(message), actionListaProducto()],
      session: s,
    };
  }

  const country = session.profile.country || defaultCountry || "CR";
  const currency = DEFAULT_CURRENCY[country] || "CRC";
  const s = {
    ...session,
    step: "confirmar_soft_pull",
    profile: { ...session.profile, product, country, currency },
  };

  const body =
    `Perfecto, *${PRODUCT_LABEL[product]}*. Para armar tu comparación te voy a pedir tu ingreso, tus deudas` +
    (product !== "personal" ? " y la prima que podrías aportar" : "") +
    `. Es una *consulta blanda*: no afecta tu historial crediticio. ¿Seguimos?`;

  return {
    actions: [actionBotones(body, [
      { id: "soft_si", title: "Sí, dale" },
      { id: "duda", title: "Tengo una duda" },
      { id: "soft_no", title: "Ahora no" },
    ])],
    session: s,
  };
}

// ---------- Paso: confirmar_soft_pull ----------

async function stepConfirmarSoftPull({ session, buttonPayload, bodyText }) {
  if (buttonPayload === "soft_si" || /^(si|sí|dale|ok|de acuerdo|claro)$/i.test(normalize(bodyText))) {
    const s = { ...session, step: "pedir_ingreso" };
    return {
      actions: [actionTexto(
        "Dale 👍 *(1/" + (s.profile.product === "personal" ? "2" : "3") + ")*\n" +
        "¿Cuánto es tu ingreso mensual neto (lo que te queda libre después de descuentos)? Podés escribirlo como número, por ejemplo: 850000 o 1.2 millones."
      )],
      session: s,
    };
  }

  if (buttonPayload === "soft_no" || /^(no|ahora no|despues|luego)$/i.test(normalize(bodyText))) {
    const s = { ...session, step: "pausado" };
    return {
      actions: [actionTexto(
        "Sin problema, quedo por acá. Cuando quieras retomar, escribime *menú* y arrancamos de nuevo."
      )],
      session: s,
    };
  }

  const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
  const s = { ...session, aiHistory };
  return {
    actions: [actionTexto(message), actionBotones(
      "¿Seguimos con la comparación?",
      [
        { id: "soft_si", title: "Sí, dale" },
        { id: "duda", title: "Tengo otra duda" },
        { id: "soft_no", title: "Ahora no" },
      ]
    )],
    session: s,
  };
}

// ---------- Paso: pedir_ingreso ----------

async function stepPedirIngreso({ session, bodyText }) {
  const amount = extractAmount(bodyText);
  if (amount === null || amount <= 0) {
    const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
    const s = { ...session, aiHistory };
    return {
      actions: [actionTexto(message), actionTexto("¿Cuánto es tu ingreso mensual neto? Por ejemplo: 850000.")],
      session: s,
    };
  }

  const s = { ...session, step: "pedir_deudas", profile: { ...session.profile, income: amount } };
  const step = s.profile.product === "personal" ? "2/2" : "2/3";
  return {
    actions: [actionTexto(
      `Anotado ✅ *(${step})*\n¿Tenés alguna deuda mensual actual (tarjetas, otros préstamos)? Si no tenés, escribí *0*.`
    )],
    session: s,
  };
}

// ---------- Paso: pedir_deudas ----------

async function stepPedirDeudas({ session, bodyText }) {
  const amount = extractAmount(bodyText);
  if (amount === null) {
    const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
    const s = { ...session, aiHistory };
    return {
      actions: [actionTexto(message), actionTexto("¿Cuánto pagás en deudas mensuales? Si no tenés, escribí *0*.")],
      session: s,
    };
  }

  const profile = { ...session.profile, debt: amount };

  if (profile.product === "personal") {
    return await calcularYMostrar({ ...session, profile });
  }

  const s = { ...session, step: "pedir_prima", profile };
  const bien = PRODUCT_ASSET_WORD[profile.product] || "bien";
  return {
    actions: [actionTexto(
      `Bien *(3/3)*\n¿Con cuánto de prima o enganche contás para ${bien === "propiedad" ? "la" : "el"} ${bien}? Si todavía no tenés nada ahorrado, escribí *0*.`
    )],
    session: s,
  };
}

// ---------- Paso: pedir_prima ----------

async function stepPedirPrima({ session, bodyText }) {
  const amount = extractAmount(bodyText);
  if (amount === null) {
    const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
    const s = { ...session, aiHistory };
    return {
      actions: [actionTexto(message), actionTexto("¿Con cuánto de prima contás? Si no tenés nada todavía, escribí *0*.")],
      session: s,
    };
  }

  const profile = { ...session.profile, downPayment: amount };
  return await calcularYMostrar({ ...session, profile });
}

// ---------- Calculo + mostrar resultados ----------

async function calcularYMostrar(session) {
  const calc = calcularPrecalificacion(session.profile);
  const s = { ...session, step: "post_resultado", lastResults: calc };
  const texto = formatResultados(calc);

  if (!calc.opciones.length) {
    return {
      actions: [actionTexto(texto), actionBotones(
        "¿Qué querés hacer?",
        [
          { id: "duda", title: "Tengo una duda" },
          { id: "otro_dato", title: "Cambiar un dato" },
          { id: "menu", title: "Empezar de nuevo" },
        ]
      )],
      session: s,
    };
  }

  const visibles = visibleOpciones(calc);
  const recomendado = visibles[0] ? visibles[0].banco : calc.opciones[0].banco;
  s.targetBank = recomendado;

  return {
    actions: [actionTexto(texto), actionBotones(
      `¿Querés aplicar con *${recomendado}*?`,
      [
        { id: "aplicar", title: "Sí, aplicar" },
        { id: "duda", title: "Tengo una duda" },
        { id: "otro", title: "Ver otro banco" },
      ]
    )],
    session: s,
  };
}

// ---------- Paso: post_resultado ----------

async function stepPostResultado({ session, buttonPayload, bodyText }) {
  if (buttonPayload === "aplicar") {
    return goToHardPull(session, session.targetBank);
  }

  if (buttonPayload === "otro") {
    const calc = session.lastResults;
    const opciones = (calc && calc.opciones) || [];
    const otros = opciones.filter((o) => o.banco !== session.targetBank);
    if (!otros.length) {
      return {
        actions: [actionTexto("No tengo más bancos alternativos calculados con estos datos. ¿Querés aplicar con la opción que ya viste?")],
        session,
      };
    }
    const buttons = otros.slice(0, 3).map((o, i) => ({ id: "banco_" + i, title: o.banco.slice(0, 20) }));
    const s = { ...session, step: "elegir_banco_alterno", alternativas: otros.slice(0, 3) };
    return {
      actions: [actionBotones("¿Con cuál de estos te gustaría seguir?", buttons)],
      session: s,
    };
  }

  if (buttonPayload === "menu" || isResetCommand(bodyText)) {
    return start({ ...session, profile: { ...session.profile }, step: "inicio" });
  }

  if (buttonPayload === "otro_dato") {
    const s = { ...session, step: "pedir_ingreso" };
    return {
      actions: [actionTexto("Sin problema. Empecemos de nuevo con tu ingreso mensual neto:")],
      session: s,
    };
  }

  // Intento: ¿el texto libre menciona uno de los bancos ya mostrados?
  const calc = session.lastResults;
  if (calc && bodyText) {
    const mention = (calc.opciones || []).find((o) => normalize(bodyText).includes(normalize(o.banco)));
    if (mention) {
      return goToHardPull(session, mention.banco);
    }
  }

  const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
  const s = { ...session, aiHistory };
  return {
    actions: [actionTexto(message), actionBotones(
      `¿Querés aplicar con *${session.targetBank}*?`,
      [
        { id: "aplicar", title: "Sí, aplicar" },
        { id: "duda", title: "Tengo otra duda" },
        { id: "otro", title: "Ver otro banco" },
      ]
    )],
    session: s,
  };
}

// ---------- Paso: elegir_banco_alterno ----------

async function stepElegirBancoAlterno({ session, buttonPayload, bodyText }) {
  const alternativas = session.alternativas || [];
  const match = /^banco_(\d+)$/.exec(buttonPayload || "");
  if (match && alternativas[Number(match[1])]) {
    return goToHardPull(session, alternativas[Number(match[1])].banco);
  }

  if (bodyText) {
    const mention = alternativas.find((o) => normalize(bodyText).includes(normalize(o.banco)));
    if (mention) return goToHardPull(session, mention.banco);
  }

  const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
  const s = { ...session, aiHistory };
  const buttons = alternativas.slice(0, 3).map((o, i) => ({ id: "banco_" + i, title: o.banco.slice(0, 20) }));
  return {
    actions: [actionTexto(message), actionBotones("¿Con cuál de estos te gustaría seguir?", buttons)],
    session: s,
  };
}

function goToHardPull(session, bankName) {
  const s = { ...session, step: "confirmar_hard_pull", targetBank: bankName };
  const body =
    `Para enviar tu perfil ya armado a *${bankName}* y que te den una respuesta, necesito tu autorización para iniciar el ` +
    `*estudio crediticio formal* con ellos (esto sí queda registrado). ¿Autorizás?`;
  return {
    actions: [actionBotones(body, [
      { id: "hard_si", title: "Sí, autorizo" },
      { id: "duda", title: "Tengo una duda" },
      { id: "hard_no", title: "Mejor no" },
    ])],
    session: s,
  };
}

// ---------- Paso: confirmar_hard_pull ----------

async function stepConfirmarHardPull({ session, buttonPayload, bodyText }) {
  if (buttonPayload === "hard_si" || /^(si|sí|autorizo|acepto|dale)$/i.test(normalize(bodyText))) {
    const s = { ...session, step: "aplicado" };
    return {
      actions: [actionTexto(
        `Listo 🎉 Tu perfil ya quedó *autorizado y armado* para *${session.targetBank}*. ` +
        `El siguiente paso lo da la entidad: te va a contactar o te avisamos por acá apenas tengamos una respuesta. ` +
        `Si tenés alguna duda mientras tanto, podés escribirme.`
      )],
      session: s,
    };
  }

  if (buttonPayload === "hard_no" || /^(no|mejor no)$/i.test(normalize(bodyText))) {
    const s = { ...session, step: "post_resultado" };
    return {
      actions: [actionTexto("Entendido, no se envía nada todavía."), actionBotones(
        "¿Qué querés hacer?",
        [
          { id: "aplicar", title: "Sí, aplicar igual" },
          { id: "duda", title: "Tengo una duda" },
          { id: "otro", title: "Ver otro banco" },
        ]
      )],
      session: s,
    };
  }

  const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
  const s = { ...session, aiHistory };
  return {
    actions: [actionTexto(message), actionBotones(
      `¿Autorizás iniciar el estudio crediticio formal con *${session.targetBank}*?`,
      [
        { id: "hard_si", title: "Sí, autorizo" },
        { id: "duda", title: "Tengo otra duda" },
        { id: "hard_no", title: "Mejor no" },
      ]
    )],
    session: s,
  };
}

// ---------- Paso: aplicado / pausado (conversacion libre) ----------

async function stepLibre({ session, bodyText }) {
  if (isResetCommand(bodyText)) {
    return start({ ...session, step: "inicio" });
  }
  const { message, aiHistory } = await manejarDuda({ session, userText: bodyText || "(sin texto)" });
  const s = { ...session, aiHistory };
  return { actions: [actionTexto(message)], session: s };
}

// ---------- Re-mostrar el paso actual (ej: despues de leer un documento) ----------

function redisplayStep(session) {
  switch (session.step) {
    case "pedir_producto":
      return [actionListaProducto()];
    case "confirmar_soft_pull":
      return [actionBotones("¿Seguimos con la comparación?", [
        { id: "soft_si", title: "Sí, dale" },
        { id: "duda", title: "Tengo una duda" },
        { id: "soft_no", title: "Ahora no" },
      ])];
    case "pedir_ingreso":
      return [actionTexto("¿Cuánto es tu ingreso mensual neto? Por ejemplo: 850000.")];
    case "pedir_deudas":
      return [actionTexto("¿Cuánto pagás en deudas mensuales? Si no tenés, escribí *0*.")];
    case "pedir_prima":
      return [actionTexto("¿Con cuánto de prima contás? Si no tenés nada todavía, escribí *0*.")];
    case "post_resultado":
      return [actionBotones(`¿Querés aplicar con *${session.targetBank}*?`, [
        { id: "aplicar", title: "Sí, aplicar" },
        { id: "duda", title: "Tengo una duda" },
        { id: "otro", title: "Ver otro banco" },
      ])];
    case "confirmar_hard_pull":
      return [actionBotones(`¿Autorizás iniciar el estudio crediticio con *${session.targetBank}*?`, [
        { id: "hard_si", title: "Sí, autorizo" },
        { id: "duda", title: "Tengo una duda" },
        { id: "hard_no", title: "Mejor no" },
      ])];
    default:
      return [actionListaProducto()];
  }
}

// ---------- Entrada principal ----------

async function handleIncoming({ session, bodyText, buttonPayload, buttonText, defaultCountry }) {
  const s = session || {};

  if (isResetCommand(bodyText) && !buttonPayload && s.step !== "inicio") {
    return start({ ...s, step: "inicio" });
  }

  switch (s.step) {
    case "inicio":
      return start(s);
    case "pedir_producto":
      return await stepPedirProducto({ session: s, buttonPayload, bodyText, defaultCountry });
    case "confirmar_soft_pull":
      return await stepConfirmarSoftPull({ session: s, buttonPayload, bodyText });
    case "pedir_ingreso":
      return await stepPedirIngreso({ session: s, bodyText });
    case "pedir_deudas":
      return await stepPedirDeudas({ session: s, bodyText });
    case "pedir_prima":
      return await stepPedirPrima({ session: s, bodyText });
    case "post_resultado":
      return await stepPostResultado({ session: s, buttonPayload, bodyText });
    case "elegir_banco_alterno":
      return await stepElegirBancoAlterno({ session: s, buttonPayload, bodyText });
    case "confirmar_hard_pull":
      return await stepConfirmarHardPull({ session: s, buttonPayload, bodyText });
    case "aplicado":
    case "pausado":
      return await stepLibre({ session: s, bodyText });
    default:
      return start(s);
  }
}

module.exports = {
  handleIncoming,
  redisplayStep,
  manejarDuda,
};
