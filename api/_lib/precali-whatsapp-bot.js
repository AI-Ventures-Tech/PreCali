const BANKS = [
  {
    id: "bac",
    name: "BAC Credomatic",
    vehiculo: { rate: 9.25, maxYears: 8, ratio: 0.32, minIncome: 750000, minAmount: 5000000, finance: 0.85 },
    personal: { rate: 18.0, maxYears: 5, ratio: 0.32, minIncome: 500000, minAmount: 500000 },
    hipoteca: { rate: 9.5, maxYears: 30, ratio: 0.35, minIncome: 750000, minAmount: 10000000, finance: 0.85 },
  },
  {
    id: "bn",
    name: "Banco Nacional",
    vehiculo: { rate: 8.9, maxYears: 8, ratio: 0.4, minIncome: 400000, minAmount: 2000000, finance: 0.85 },
    personal: { rate: 16.57, maxYears: 8, ratio: 0.4, minIncome: 400000, minAmount: 500000 },
    hipoteca: { rate: 9.0, maxYears: 30, ratio: 0.35, minIncome: 600000, minAmount: 5000000, finance: 0.9 },
  },
  {
    id: "davibank",
    name: "DaviBank",
    vehiculo: { rate: 8.95, maxYears: 8, ratio: 0.32, minIncome: 650000, minAmount: 3000000, finance: 0.9 },
    personal: { rate: 19.0, maxYears: 5, ratio: 0.32, minIncome: 500000, minAmount: 500000 },
  },
  {
    id: "promerica",
    name: "Promerica",
    vehiculo: { rate: 8.25, maxYears: 8, ratio: 0.33, minIncome: 600000, minAmount: 2500000, finance: 0.85 },
    hipoteca: { rate: 12.0, maxYears: 30, ratio: 0.35, minIncome: 750000, minAmount: 10000000, finance: 0.85 },
  },
  {
    id: "lafise",
    name: "Lafise",
    vehiculo: { rate: 10.5, maxYears: 7, ratio: 0.4, minIncome: 600000, minAmount: 2000000, finance: 0.85 },
    personal: { rate: 24.0, maxYears: 5, ratio: 0.35, minIncome: 500000, minAmount: 500000 },
    hipoteca: { rate: 10.0, maxYears: 30, ratio: 0.35, minIncome: 700000, minAmount: 8000000, finance: 0.8 },
  },
];

const AMOUNT_PATTERN = /([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m))?)/;

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeAmountWords(text) {
  const millions = {
    medio: 0.5,
    media: 0.5,
    un: 1,
    uno: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
  };
  const thousands = {
    cien: 100,
    ciento: 100,
    doscientos: 200,
    trescientos: 300,
    cuatrocientos: 400,
    quinientos: 500,
    seiscientos: 600,
    setecientos: 700,
    ochocientos: 800,
    novecientos: 900,
  };

  let result = text;
  for (const [word, value] of Object.entries(millions)) {
    result = result.replace(new RegExp("\\b" + word + "\\s+(?:millon|millones)\\b", "g"), value + " millones");
  }
  for (const [word, value] of Object.entries(thousands)) {
    result = result.replace(new RegExp("\\b" + word + "\\s+mil\\b", "g"), value + " mil");
  }
  return result;
}

function normalizeTypos(text) {
  return text
    .replace(/\bkiero\b/g, "quiero")
    .replace(/\bqiero\b/g, "quiero")
    .replace(/\bnesecito\b/g, "necesito")
    .replace(/\bnesesito\b/g, "necesito")
    .replace(/\bkasa\b/g, "casa")
    .replace(/\bveiculo\b/g, "vehiculo")
    .replace(/\bveiculos\b/g, "vehiculos")
    .replace(/\bpreztamo\b/g, "prestamo")
    .replace(/\bhipotekario\b/g, "hipotecario");
}

function money(value) {
  const rounded = Math.max(0, Math.round(Number(value) || 0));
  return "CRC " + rounded.toLocaleString("es-CR");
}

function parseAmount(raw) {
  if (!raw) return 0;

  const compact = String(raw).toLowerCase().replace(/[,\s]/g, "");
  const number = Number(compact.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(number)) return 0;

  if (/millones|millon|mill|m\b/.test(compact)) return number * 1000000;
  if (/mil|k\b/.test(compact)) return number * 1000;
  return number;
}

function hasWrittenAmountCue(text) {
  return /\b\d[\d.,]*\b/.test(text) || /\b(medio|media|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos)\s+(millones|millon|mill|mil|k|m)\b/.test(text);
}

function findAmount(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseAmount(match[1]);
  }
  return 0;
}

function amountAfter(text, labels, blockers) {
  for (const label of labels) {
    const matcher = new RegExp("\\b(?:" + label + ")\\b", "g");
    let labelMatch;

    while ((labelMatch = matcher.exec(text))) {
      const segment = text.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 60);
      const amountMatch = segment.match(AMOUNT_PATTERN);
      if (!amountMatch) continue;

      const beforeAmount = segment.slice(0, amountMatch.index || 0);
      const blocked = blockers.some((blocker) => new RegExp("\\b(?:" + blocker + ")\\b").test(beforeAmount));
      if (!blocked) return parseAmount(amountMatch[1]);
    }
  }

  return 0;
}

function detectProduct(text) {
  if (/(casa|vivienda|hipoteca|hipotecario|apartamento|apto|lote|terreno|propiedad|inmueble)/.test(text)) {
    return "hipoteca";
  }
  if (/(carro|auto|vehiculo|veiculo|vehicular|moto|prendario|pickup|pick up|camioneta)/.test(text)) {
    return "vehiculo";
  }
  return "personal";
}

function parseProfile(body) {
  const text = normalizeTypos(normalizeAmountWords(normalize(body)));
  const product = detectProduct(text);

  const income =
    amountAfter(
      text,
      ["gano", "ganamos", "ingreso", "ingresos", "salario", "sueldo", "neto", "devengo"],
      ["debo", "deuda", "deudas", "pago", "pagos", "cuotas", "prima", "enganche", "aporte", "carro", "auto", "vehiculo", "veiculo", "casa", "vivienda", "monto", "valor"]
    ) ||
    findAmount(text, [
      /([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m))?)\s*(?:de ingreso|de salario|netos|mensuales)/,
    ]);

  const debt =
    amountAfter(
      text,
      ["debo", "debemos", "deuda", "deudas", "pago", "pagos", "cuotas", "rebajos"],
      ["gano", "ingreso", "ingresos", "salario", "sueldo", "neto", "prima", "enganche", "aporte", "carro", "auto", "vehiculo", "veiculo", "casa", "vivienda", "monto", "valor"]
    ) ||
    findAmount(text, [
      /([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m))?)\s*(?:de deuda|en deudas|de pagos|en pagos)/,
    ]);

  const downPayment =
    amountAfter(
      text,
      ["prima", "enganche", "aporte"],
      ["debo", "deuda", "deudas", "pago", "pagos", "cuotas", "gano", "ingreso", "salario", "sueldo", "monto", "valor"]
    ) ||
    findAmount(text, [
      /([\d.,]+(?:\s*(?:millones|millon|mill|mil|k|m))?)\s*(?:de\s+)?(?:prima|enganche|aporte)\b/,
    ]) ||
    0;

  const rawAssetValue =
    amountAfter(
      text,
      ["valor", "monto", "hipoteca", "hipotecario", "casa", "vivienda", "propiedad", "apartamento", "apto", "lote", "terreno", "carro", "auto", "vehiculo", "veiculo", "prestamo", "credito", "financiar", "financiamiento", "ocupo", "necesito", "nesesito"],
      ["gano", "ingreso", "ingresos", "salario", "sueldo", "neto", "devengo", "debo", "deuda", "deudas", "pago", "pagos", "cuotas", "prima", "enganche", "aporte"]
    );
  const assetValue = rawAssetValue >= 100000 ? rawAssetValue : 0;

  const yearsMatch = text.match(/(\d{1,2})\s*(?:anos|ano|anios|meses|plazo)/);
  const defaultYears = product === "hipoteca" ? 30 : product === "personal" ? 5 : 6;
  const requestedYears = yearsMatch ? Number(yearsMatch[1]) : defaultYears;

  return {
    product,
    income,
    debt,
    downPayment,
    assetValue,
    requestedYears: Math.max(1, Math.min(requestedYears || defaultYears, 30)),
  };
}

function coerceProfile(profile) {
  const source = profile || {};
  const product = ["personal", "vehiculo", "hipoteca"].includes(source.product) ? source.product : "personal";
  const defaultYears = product === "hipoteca" ? 30 : product === "personal" ? 5 : 6;

  return {
    product,
    income: Math.max(0, Math.round(Number(source.income) || 0)),
    debt: Math.max(0, Math.round(Number(source.debt) || 0)),
    downPayment: Math.max(0, Math.round(Number(source.downPayment) || 0)),
    assetValue: Math.max(0, Math.round(Number(source.assetValue) || 0)),
    requestedYears: Math.max(1, Math.min(Math.round(Number(source.requestedYears) || defaultYears), 30)),
  };
}

function paymentFor(amount, annualRate, years) {
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = annualRate / 100 / 12;
  if (!monthlyRate) return amount / months;
  return amount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
}

function amountForPayment(payment, annualRate, years) {
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = annualRate / 100 / 12;
  if (!monthlyRate) return payment * months;
  return payment * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
}

function simulate(profile) {
  const results = [];

  for (const bank of BANKS) {
    const condition = bank[profile.product];
    if (!condition) continue;

    const years = Math.min(profile.requestedYears, condition.maxYears);
    const capacity = Math.max(0, profile.income * condition.ratio - profile.debt);
    let amount = amountForPayment(capacity, condition.rate, years);

    if (profile.assetValue && profile.product !== "personal") {
      const financeLimit = profile.assetValue * (condition.finance || 0.85);
      const requested = Math.max(0, profile.assetValue - profile.downPayment);
      amount = Math.min(amount, financeLimit, requested || financeLimit);
    }

    const qualifies = profile.income >= condition.minIncome && amount >= condition.minAmount && capacity > 0;
    if (!qualifies) continue;

    const payment = paymentFor(amount, condition.rate, years);
    results.push({
      bank: bank.name,
      rate: condition.rate,
      years,
      amount,
      payment,
      capacity,
    });
  }

  return results.sort((a, b) => a.payment - b.payment);
}

function missingProfileMessage(profile) {
  const missing = [];
  if (!profile.income) missing.push("ingreso mensual");
  if (missing.length === 0) return "";

  return [
    "Para calcularte bien necesito: " + missing.join(", ") + ".",
    "Ejemplo:",
    "Gano 1500000, debo 250000, quiero vehiculo de 15000000, tengo 2000000 de prima, a 6 anos.",
    "Tambien podes decir: gano 2 millones, debo 400 mil y quiero prestamo para casa.",
  ].join("\n");
}

function likelyDocumentFollowUp(body) {
  const text = normalizeTypos(normalizeAmountWords(normalize(body)));
  const mentionsIncomeContext = /(ingreso|ingresos|salario|sueldo|neto|devengo|orden patronal|colilla|boleta|documento|pdf|archivo|adjunto|estos son mis ingresos|te mando|no debo|sin deudas?|deuda cero)/.test(text);
  const mentionsIntent = /(carro|auto|vehiculo|veiculo|casa|vivienda|hipoteca|credito|prestamo|financiar)/.test(text);
  return mentionsIncomeContext && mentionsIntent;
}

function productTitle(product) {
  if (product === "hipoteca") return "credito hipotecario";
  if (product === "vehiculo") return "credito vehicular";
  return "credito personal";
}

function assetLabel(product) {
  return product === "vehiculo" ? "vehiculo" : "bien";
}

function formatResults(profile, results) {
  const hasAssetContext = profile.product !== "personal";
  const hasDownPaymentOnly = hasAssetContext && profile.downPayment > 0 && !profile.assetValue;
  const lines = [
    "PreCali - comparativa preliminar",
    "Producto: " + productTitle(profile.product),
    "Ingreso: " + money(profile.income) + " | Deudas: " + money(profile.debt),
    profile.assetValue
      ? "Valor de referencia: " + money(profile.assetValue) + (profile.downPayment ? " | Prima: " + money(profile.downPayment) : "")
      : hasDownPaymentOnly
        ? "Sin valor del bien: estimo el monto maximo segun capacidad de pago. Prima detectada: " + money(profile.downPayment) + "."
        : "Sin valor del bien: estimo el monto maximo segun capacidad de pago.",
    "",
  ];

  if (!results.length) {
    lines.push(profile.downPayment && hasAssetContext
      ? "Ya tome en cuenta tu prima de " + money(profile.downPayment) + ", pero con estos datos no encontre una opcion clara."
      : "Con esos datos no encontre una opcion clara.");
    lines.push("Probemos bajando monto, subiendo prima, ampliando plazo o revisando deudas mensuales.");
    return lines.join("\n");
  }

  if (results.length === 1) {
    lines.push("Hoy solo veo una opcion clara con este perfil.");
    lines.push("Los otros bancos normalmente quedan fuera por ingreso minimo, capacidad de pago o monto financiable.");
    lines.push("");
  }

  results.slice(0, 4).forEach((result, index) => {
    lines.push(
      `${index + 1}. ${result.bank}`,
      `Tasa: ${result.rate.toFixed(2)}% | Plazo: ${result.years} anos`,
      `${profile.assetValue ? "Monto financiado" : "Monto maximo estimado"}: ${money(result.amount)}`,
      hasDownPaymentOnly ? `Valor total aprox con prima: ${money(result.amount + profile.downPayment)}` : null,
      `Cuota aprox: ${money(result.payment)}`,
      ""
    );
  });

  lines.push("Queres aplicar a alguna opcion? Responde: Aplicar BAC, Aplicar BN, etc.");
  if ((profile.product === "vehiculo" || profile.product === "hipoteca") && !profile.assetValue) {
    lines.push("Si me decis el valor del " + assetLabel(profile.product) + (profile.downPayment ? ", te digo cuanto te financiarian exactamente." : " y la prima, te afino mucho mas la comparativa."));
  }
  lines.push("MVP: estimacion orientativa. El banco confirma aprobacion, tasa y requisitos finales.");
  return lines.filter(Boolean).join("\n");
}

function buildReplyFromProfile(profile, options) {
  const cleanProfile = coerceProfile(profile);
  const missing = missingProfileMessage(cleanProfile);
  const prefixLines = Array.isArray(options && options.prefixLines) ? options.prefixLines.filter(Boolean) : [];

  if (missing) {
    return {
      message: prefixLines.length ? prefixLines.concat("", missing).join("\n") : missing,
    };
  }

  const message = formatResults(cleanProfile, simulate(cleanProfile));
  return {
    message: prefixLines.length ? prefixLines.concat("", message).join("\n") : message,
  };
}

function buildReply(input) {
  const body = input && input.body ? String(input.body) : "";
  const text = normalizeTypos(normalizeAmountWords(normalize(body)));
  const numMedia = Number(input && input.numMedia ? input.numMedia : 0);

  if (numMedia > 0) {
    return {
      message:
        "Recibi tu documento. PreCali intenta leerlo localmente si es PDF/DOCX/CSV con texto. Si no sale, escribime ingreso mensual, deudas, monto aproximado, prima y plazo.",
    };
  }

  const hasFinancialIntent = /(gano|ingreso|salario|sueldo|neto|debo|deuda|prima|enganche|casa|vivienda|hipoteca|carro|auto|vehiculo|credito|prestamo|plata|financiar)/.test(text);

  if (!text || (/^(hola|buenas|menu|ayuda|inicio|empezar|hey|ola)\b/.test(text) && !hasFinancialIntent)) {
    return {
      message: [
        "Hola, soy PreCali por WhatsApp.",
        "Mandame tus datos y te comparo opciones en segundos.",
        "",
        "Ejemplo carro:",
        "Gano 1500000, debo 250000, quiero vehiculo de 15000000, tengo 2000000 de prima, a 6 anos.",
        "",
        "Ejemplo casa:",
        "Gano 2 millones, debo 400 mil y quiero prestamo para casa.",
      ].join("\n"),
    };
  }

  const profile = parseProfile(body);

  if (!profile.income && (
    likelyDocumentFollowUp(body) ||
    (profile.product !== "personal" && (profile.downPayment > 0 || profile.assetValue > 0 || /\b(no debo|sin deudas?|deuda cero)\b/.test(text)))
  )) {
    return {
      message: [
        "Perfecto. Mandame la orden patronal, colilla o PDF y saco el ingreso desde ahi.",
        "Ya tengo presente si es casa o carro y cualquier prima o deuda que me hayas dicho.",
      ].join("\n"),
    };
  }

  if (/(pdf|documento|orden|patronal|boleta|colilla|foto|imagen|adjunto|archivo)/.test(text) && !/(gano|ingreso|salario|sueldo|neto)/.test(text)) {
    return {
      message: [
        "Si ya tenes el documento, mandalo como archivo o foto por este chat.",
        "PreCali puede leer PDF/DOCX/CSV con texto para extraer ingreso, cedula y patrono sin depender de IA.",
        "Las fotos escaneadas van a ocupar OCR local en el siguiente paso.",
        "",
        "Mientras tanto, podes escribirme: gano 1500000, debo 250000, quiero casa o carro.",
      ].join("\n"),
    };
  }

  if (/(aplicar|solicitar|me interesa|quiero esa|enviar|mandar|banco)/.test(text) && !/(gano|ingreso|salario|sueldo)/.test(text)) {
    return {
      message: [
        "Perfecto. Para aplicar normalmente necesitarias:",
        "- Cedula vigente",
        "- Orden patronal o constancia de ingresos",
        "- Estados de cuenta recientes",
        "- Proforma o datos del bien si aplica",
        "",
        "En el MVP todavia no enviamos al banco automaticamente. El siguiente paso sera conectar convenios, buro y estado de aprobacion.",
      ].join("\n"),
    };
  }

  if (/(estado|aprobado|rechazado|seguimiento)/.test(text)) {
    return {
      message:
        "El flujo final seria: PreCali te avisa por WhatsApp cuando el banco responda. Ejemplo: Tu credito fue aprobado; el banco se contactara con vos en las proximas horas.",
    };
  }

  const missing = missingProfileMessage(profile);
  if (missing) return { message: missing };

  return { message: formatResults(profile, simulate(profile)) };
}

module.exports = {
  buildReply,
  buildReplyFromProfile,
  coerceProfile,
  parseProfile,
  simulate,
};
