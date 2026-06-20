const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { simulate, coerceProfile, toInternalAmount, currencyConfig } = require("./precali-whatsapp-bot");

const COUNTRY_NAMES = {
  CR: "Costa Rica",
  MX: "Mexico",
  GT: "Guatemala",
  PA: "Panama",
  HN: "Honduras",
  NI: "Nicaragua",
  SV: "El Salvador",
};

const PRODUCT_LABELS = {
  personal: "prestamo personal",
  vehiculo: "credito vehicular",
  hipoteca: "credito hipotecario",
};

function loadBancosRaw() {
  const candidates = [
    path.join(process.cwd(), "data.js"),
    path.join(__dirname, "..", "..", "data.js"),
  ];
  const dataPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!dataPath) return [];
  const code = fs.readFileSync(dataPath, "utf8") + "\n;({ BANCOS });";
  const ctx = vm.runInNewContext(code, {}, { filename: dataPath, timeout: 1000 });
  return Array.isArray(ctx.BANCOS) ? ctx.BANCOS : [];
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function recommendedResult(results, profile) {
  if (!results.length) return null;
  const netIncome = Math.max(1, profile.income - profile.debt);
  const affordable = results
    .map((r) => ({ r, burden: r.payment / netIncome }))
    .filter((item) => item.burden <= 0.35)
    .sort((a, b) => a.burden - b.burden || a.r.rate - b.r.rate);
  if (affordable.length) return affordable[0].r;
  return results.slice().sort((a, b) => a.payment - b.payment || a.rate - b.rate)[0];
}

function buildWarnings(profile, results) {
  const warnings = [];
  const netIncome = profile.income - profile.debt;

  if (profile.income <= 0) {
    warnings.push({
      tipo: "sin_ingreso",
      detalle: "Todavia no se conoce el ingreso mensual neto; no se puede calcular nada real sin ese dato.",
    });
    return warnings;
  }

  if (netIncome <= 0) {
    warnings.push({
      tipo: "ingreso_neto_cero_o_negativo",
      detalle: "Las deudas mensuales actuales igualan o superan el ingreso reportado; no queda capacidad de pago.",
    });
  }

  if (profile.product !== "personal" && profile.assetValue > 0 && profile.downPayment > 0) {
    const share = profile.downPayment / profile.assetValue;
    if (share < 0.05) {
      warnings.push({
        tipo: "prima_muy_baja",
        detalle: `La prima indicada cubre solo ${Math.round(share * 100)}% del valor del bien. Lo usual en el mercado es entre 10% y 20%.`,
      });
    }
  }

  if (!results.length && netIncome > 0) {
    warnings.push({
      tipo: "ningun_banco_califica",
      detalle: "Con los datos actuales ningun banco de PreCali califica. Puede deberse a ingreso por debajo del minimo, monto resultante muy bajo, o deudas que consumen toda la capacidad de pago.",
    });
  }

  return warnings;
}

function calcularPrecalificacion(rawArgs) {
  const args = rawArgs || {};
  const base = coerceProfile({
    country: args.country,
    currency: args.currency,
    product: args.product,
    requestedYears: args.requestedYears,
  });
  const scale = currencyConfig(base.country, base.currency).scale;
  const toDisplay = (internalValue) => Math.max(0, Math.round((Number(internalValue) || 0) / scale));

  const profile = {
    ...base,
    income: toInternalAmount(args.income, base.country, base.currency),
    debt: toInternalAmount(args.debt, base.country, base.currency),
    downPayment: toInternalAmount(args.downPayment, base.country, base.currency),
    assetValue: toInternalAmount(args.assetValue, base.country, base.currency),
  };

  const results = simulate(profile);
  const incomeDisplay = toDisplay(profile.income);
  const opciones = results.slice(0, 6).map((r) => ({
    banco: r.bank,
    tasa_anual_pct: Number(r.rate.toFixed(2)),
    plazo_anos: r.years,
    monto_maximo: toDisplay(r.amount),
    cuota_mensual: toDisplay(r.payment),
    porcentaje_ingreso_a_cuota: incomeDisplay > 0 ? Math.round((toDisplay(r.payment) / incomeDisplay) * 100) : null,
  }));
  const recommended = recommendedResult(results, profile);

  return {
    pais: COUNTRY_NAMES[profile.country] || profile.country,
    moneda: profile.currency,
    producto: PRODUCT_LABELS[profile.product],
    perfil_usado: {
      ingreso_mensual: incomeDisplay,
      deudas_mensuales: toDisplay(profile.debt),
      prima_o_enganche: toDisplay(profile.downPayment),
      valor_del_bien: toDisplay(profile.assetValue),
      plazo_solicitado_anos: profile.requestedYears,
    },
    total_bancos_evaluados: results.length,
    opciones,
    recomendacion: recommended
      ? {
          banco: recommended.bank,
          motivo: "menor carga de cuota sobre el ingreso, dentro de un limite sano",
          cuota_mensual: toDisplay(recommended.payment),
          tasa_anual_pct: Number(recommended.rate.toFixed(2)),
          monto_maximo: toDisplay(recommended.amount),
        }
      : null,
    avisos: buildWarnings(
      { ...profile, income: incomeDisplay, debt: toDisplay(profile.debt) },
      results
    ),
    calidad_datos:
      profile.country === "CR"
        ? "oficial, revisada en sitios de cada banco"
        : "referencial: PreCali todavia esta validando estas tasas con cada banco en este pais",
  };
}

const CALCULAR_TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "calcular_precalificacion",
    description:
      "Calcula opciones reales de credito contra bancos de PreCali. Debe llamarse antes de mencionar tasas, montos, cuotas o plazos.",
    parameters: {
      type: "object",
      properties: {
        country: { type: "string", enum: ["CR", "MX", "GT", "PA", "HN", "NI", "SV"] },
        currency: { type: "string", description: "Moneda visible del usuario, ej CRC, USD, MXN, GTQ, HNL, NIO." },
        product: { type: "string", enum: ["personal", "vehiculo", "hipoteca"] },
        income: { type: "number", description: "Ingreso mensual neto. 0 si no se sabe." },
        debt: { type: "number", description: "Deudas mensuales. 0 si no tiene o no se sabe." },
        downPayment: { type: "number", description: "Prima o enganche disponible. 0 si no se sabe." },
        assetValue: { type: "number", description: "Valor del carro o propiedad. 0 si no se sabe." },
        requestedYears: { type: "number", description: "Plazo solicitado o tipico." },
      },
      required: ["country", "currency", "product", "income"],
    },
  },
};

function consultarRequisitos(rawArgs) {
  const args = rawArgs || {};
  const country = String(args.pais || "CR").toUpperCase();
  const producto = ["personal", "vehiculo", "hipoteca"].includes(args.producto) ? args.producto : "personal";
  const query = normalizeText(args.banco);
  const bancos = loadBancosRaw().filter((b) => String(b.pais || "cr").toUpperCase() === country);
  if (!bancos.length) return { encontrado: false, mensaje: `PreCali todavia no tiene bancos cargados para ${country}.` };

  const match =
    bancos.find((b) => {
      const name = normalizeText(b.nombre);
      const id = normalizeText(b.id);
      return (name && (name.includes(query) || query.includes(name))) || (id && query.includes(id));
    }) || null;

  if (!match) {
    return {
      encontrado: false,
      mensaje: `No encontre ese banco en la base de datos de PreCali para ${country}. Bancos disponibles: ${bancos.map((b) => b.nombre).join(", ")}.`,
    };
  }

  const condicion = match[producto];
  if (!condicion) {
    return { encontrado: false, mensaje: `${match.nombre} no tiene producto de ${PRODUCT_LABELS[producto]} cargado en PreCali.` };
  }

  return {
    encontrado: true,
    banco: match.nombre,
    producto: PRODUCT_LABELS[producto],
    garantia: condicion.garantia || null,
    requisitos: condicion.requisitos || [],
    fuente_oficial: condicion.url || match.web || null,
  };
}

const REQUISITOS_TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "consultar_requisitos",
    description: "Consulta requisitos reales de un banco especifico de PreCali para un producto.",
    parameters: {
      type: "object",
      properties: {
        banco: { type: "string" },
        producto: { type: "string", enum: ["personal", "vehiculo", "hipoteca"] },
        pais: { type: "string", enum: ["CR", "MX", "GT", "PA", "HN", "NI", "SV"] },
      },
      required: ["banco", "producto", "pais"],
    },
  },
};

module.exports = {
  calcularPrecalificacion,
  consultarRequisitos,
  CALCULAR_TOOL_SCHEMA,
  REQUISITOS_TOOL_SCHEMA,
};
