const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { simulate, coerceProfile, toInternalAmount, currencyConfig } = require("./precali-whatsapp-bot");

// ============================================================
// PreCali AI — Tools (funciones que la IA puede invocar)
// ============================================================
// Este modulo NO genera texto ni conversa. Solo hace matematica
// y consultas exactas contra data.js. La conversacion, las
// preguntas de seguimiento y las recomendaciones las maneja
// precali-agent.js (el modelo de lenguaje), que llama estas
// funciones cuando necesita numeros o requisitos reales.

const COUNTRY_NAMES = {
  CR: "Costa Rica",
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

// ---------- calcular_precalificacion ----------

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
    warnings.push({ tipo: "sin_ingreso", detalle: "Todavia no se conoce el ingreso mensual neto; no se puede calcular nada real sin ese dato." });
    return warnings;
  }

  if (netIncome <= 0) {
    warnings.push({ tipo: "ingreso_neto_cero_o_negativo", detalle: "Las deudas mensuales actuales igualan o superan el ingreso reportado; no queda capacidad de pago." });
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
  // Primero saneamos pais/moneda/producto/plazo (sin escalar montos todavia).
  const base = coerceProfile({
    country: args.country,
    currency: args.currency,
    product: args.product,
    requestedYears: args.requestedYears,
  });

  // Los montos que manda la IA vienen en la moneda "visible" (lo que dijo el
  // usuario). Hay que pasarlos a unidades internas antes de simular, y
  // despues devolver los resultados otra vez en la moneda visible.
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
          motivo: "menor carga de cuota sobre el ingreso, dentro de un limite sano (cuota <= 35% del ingreso)",
          cuota_mensual: toDisplay(recommended.payment),
          tasa_anual_pct: Number(recommended.rate.toFixed(2)),
          monto_maximo: toDisplay(recommended.amount),
        }
      : null,
    avisos: buildWarnings({ ...profile, income: incomeDisplay, debt: toDisplay(profile.debt) }, results),
    calidad_datos:
      "oficial, revisada en sitios de cada banco",
  };
}

const CALCULAR_TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "calcular_precalificacion",
    description:
      "Calcula opciones REALES de credito contra los bancos de PreCali (tasas, montos, cuotas, recomendacion). " +
      "SIEMPRE llama esta funcion antes de mencionar cualquier numero de cuota, tasa o monto: nunca los inventes ni los calcules vos mismo. " +
      "Volve a llamarla cada vez que cambie algun dato del perfil (ingreso, deuda, prima, valor del bien, plazo, producto, pais o moneda).",
    parameters: {
      type: "object",
      properties: {
        country: {
          type: "string",
          enum: ["CR"],
          description: "Pais del usuario. En este MVP solo Costa Rica esta activo.",
        },
        currency: {
          type: "string",
          enum: ["CRC", "USD"],
          description: "Moneda en la que estan expresados los montos de este llamado. En Costa Rica se admite CRC o USD.",
        },
        product: {
          type: "string",
          enum: ["personal", "vehiculo", "hipoteca"],
          description: "Tipo de credito que busca la persona.",
        },
        income: {
          type: "number",
          description: "Ingreso mensual neto del usuario, en la moneda indicada. 0 si todavia no se sabe.",
        },
        debt: {
          type: "number",
          description: "Deudas mensuales actuales (cuotas que ya paga). 0 si no tiene o no se sabe.",
        },
        downPayment: {
          type: "number",
          description: "Prima o enganche disponible. 0 si no aplica o no se sabe todavia.",
        },
        assetValue: {
          type: "number",
          description: "Valor estimado del carro o de la propiedad, si se conoce. 0 si no se sabe.",
        },
        requestedYears: {
          type: "number",
          description: "Plazo en anos que pide el usuario. Si no lo dijo, usa un valor tipico: 5 personal, 6 vehiculo, 25 hipoteca.",
        },
      },
      required: ["country", "currency", "product", "income"],
    },
  },
};

// ---------- consultar_requisitos ----------

function consultarRequisitos(rawArgs) {
  const args = rawArgs || {};
  const country = "CR";
  const producto = ["personal", "vehiculo", "hipoteca"].includes(args.producto) ? args.producto : "personal";
  const query = normalizeText(args.banco);

  const bancos = loadBancosRaw().filter((b) => String(b.pais || "cr").toUpperCase() === country);
  if (!bancos.length) {
    return { encontrado: false, mensaje: `PreCali todavia no tiene bancos cargados para ${country}.` };
  }

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
    description:
      "Consulta los requisitos y documentos OFICIALES reales que pide un banco especifico de PreCali para un producto. " +
      "Usala cuando el usuario pregunte por documentos, requisitos, papeleo o garantia de un banco concreto. Nunca inventes requisitos.",
    parameters: {
      type: "object",
      properties: {
        banco: { type: "string", description: "Nombre del banco mencionado por el usuario, ej 'BAC', 'Banco Nacional', 'BBVA'." },
        producto: { type: "string", enum: ["personal", "vehiculo", "hipoteca"] },
        pais: { type: "string", enum: ["CR"] },
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
