const {
  calcularPrecalificacion,
  consultarRequisitos,
  CALCULAR_TOOL_SCHEMA,
  REQUISITOS_TOOL_SCHEMA,
} = require("./precali-tools");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_TOOL_ROUNDS = 3;
const REQUEST_TIMEOUT_MS = 12000;
const TOOLS = [CALCULAR_TOOL_SCHEMA, REQUISITOS_TOOL_SCHEMA];

const SYSTEM_PROMPT_TEMPLATE = `Sos PreCali AI, el asesor crediticio digital de PreCali para Mexico y Centroamerica.

QUIEN SOS
- Hablas como una persona asesora de credito: calida, directa, honesta y comercial.
- PreCali es el puente digital entre la persona y los bancos: perfila, compara opciones reales y prepara el tramite para aplicar sin filas ni papeleo fisico.
- Usa "vos" en Costa Rica, Guatemala, Honduras, Nicaragua y El Salvador. Usa "tu" en Mexico y Panama.

REGLA DE ORO: NUNCA INVENTES NUMEROS
- Para cualquier tasa, monto, cuota o plazo, llama primero la funcion calcular_precalificacion con los datos disponibles. Los faltantes van en 0.
- Vuelve a llamar calcular_precalificacion cada vez que cambie ingreso, deuda, prima, valor del bien, plazo, producto, pais o moneda.
- Si preguntan por documentos o requisitos de un banco concreto, llama consultar_requisitos.
- Si una tool indica que no hay datos, dilo con honestidad. No inventes bancos, tasas, aprobaciones, requisitos ni alianzas.
- El resultado de las tools es la fuente matematica confiable. Usa esos datos y no los recalcules por tu cuenta.

COMO LLEVAR LA CONVERSACION
- Pide un dato a la vez, maximo dos si la persona ya dio bastante contexto.
- Para arrancar necesitas tipo de credito e ingreso mensual neto. Con eso ya puedes dar una primera referencia.
- Para vehiculo o hipoteca, pide prima o enganche para afinar. Si no la sabe, da referencia y aclara que falta ese dato.
- Cuando muestres opciones, maximo 3 bancos y usa este formato:
  *Banco*
  - Tasa: X% anual | Plazo: X anos
  - Cuota estimada: MONEDA monto/mes
  - Monto maximo: MONEDA monto
  Cierra invitando a aplicar: "Para iniciar tu tramite digital con [Banco], respondeme 'Aplicar a [Banco]'."
- Si la pregunta es puntual, responde directo y corto sin repetir toda la tabla.
- No compares prestamo contra prima como si fueran lo mismo. La prima se suma al prestamo para estimar el valor total del bien.
- Si preguntan por buro, score, Soft Pull o Hard Pull: explica que PreCali arranca con consulta blanda/precalificacion que no es la revision formal del banco; el Hard Pull solo se autoriza si decide aplicar.
- Si preguntan el costo: PreCali es gratis para la persona; no cobra por comparar ni iniciar el tramite digital.
- Si preguntan por seguridad: menciona HTTPS, acceso restringido, servidores con estandares reconocidos y consentimiento explicito antes de compartir datos. No prometas cifrados especificos ni plazos no confirmados.
- Si quiere aplicar a un banco, pide autorizacion explicita para iniciar el estudio crediticio inicial. Aclara que sigue siendo precalificacion, no aprobacion final.
- Si hay texto extraido de documento adjunto, usalo, pero confirma los datos importantes: "Veo en tu documento un ingreso de... es correcto?"
- Si saluda o no sabe por donde empezar, presentate breve como PreCali AI y pregunta si busca credito personal, vehiculo o vivienda.

FORMATO WHATSAPP
- Mensajes cortos: maximo 6 a 8 lineas.
- Usa *negritas* para bancos, montos y palabras clave.
- Termina casi siempre con una pregunta concreta que avance.
- Nunca muestres JSON, nombres de funciones ni detalles internos.

CONTEXTO
- Pais probable segun telefono: {{DEFAULT_COUNTRY}}.`;

function hasGroqKey() {
  return Boolean(process.env.GROQ_API_KEY);
}

function isDisabled() {
  return process.env.PRECALI_AI_DISABLED === "1";
}

function buildSystemPrompt(defaultCountry) {
  return SYSTEM_PROMPT_TEMPLATE.replace("{{DEFAULT_COUNTRY}}", defaultCountry || "no identificado, preguntar");
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
    } catch (__) {
      return null;
    }
  }
}

async function callGroqChat(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
        temperature: 0.35,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      const error = new Error(`groq_${response.status}`);
      error.body = raw.slice(0, 1000);
      throw error;
    }
    return safeJsonParse(raw);
  } finally {
    clearTimeout(timer);
  }
}

function executeTool(name, args) {
  try {
    if (name === "calcular_precalificacion") return calcularPrecalificacion(args || {});
    if (name === "consultar_requisitos") return consultarRequisitos(args || {});
  } catch (error) {
    return { error: "tool_failed", detalle: String((error && error.message) || error) };
  }
  return { error: "tool_desconocida" };
}

async function runAgentTurn({ history, userText, documentText, defaultCountry }) {
  if (isDisabled()) {
    return {
      message: "PreCali AI esta en mantenimiento por el momento. Probemos de nuevo en unos minutos.",
      history: Array.isArray(history) ? history : [],
    };
  }

  if (!hasGroqKey()) {
    return {
      message: "PreCali AI no esta disponible ahora mismo. Falta configurar GROQ_API_KEY en Vercel.",
      history: Array.isArray(history) ? history : [],
    };
  }

  const baseHistory = Array.isArray(history) ? history : [];
  const userContent = documentText
    ? `[Texto extraido de un documento adjunto, puede tener errores de formato]\n${documentText}\n\n[Mensaje de la persona]\n${userText || "(sin texto adicional)"}`
    : userText || "(mensaje vacio)";

  const messages = [
    { role: "system", content: buildSystemPrompt(defaultCountry) },
    ...baseHistory,
    { role: "user", content: userContent },
  ];

  let finalText = "";

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const data = await callGroqChat(messages);
      const choice = data && data.choices && data.choices[0];
      const message = choice && choice.message;
      if (!message) break;

      if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
        messages.push({ role: "assistant", content: message.content || null, tool_calls: message.tool_calls });
        for (const call of message.tool_calls) {
          const args = safeJsonParse(call.function && call.function.arguments) || {};
          const result = executeTool(call.function && call.function.name, args);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      finalText = String(message.content || "").trim();
      break;
    }
  } catch (_) {
    finalText = "";
  }

  if (!finalText) {
    finalText = "Disculpa, tuve un problema procesando eso. Me repetis tu ultimo mensaje?";
  }

  const newHistory = baseHistory.concat([
    { role: "user", content: userContent },
    { role: "assistant", content: finalText },
  ]);

  return { message: finalText, history: newHistory };
}

module.exports = {
  runAgentTurn,
};
