const {
  calcularPrecalificacion,
  consultarRequisitos,
  CALCULAR_TOOL_SCHEMA,
  REQUISITOS_TOOL_SCHEMA,
} = require("./precali-tools");

// ============================================================
// PreCali AI — Agente para resolver dudas (modo "duda")
// ============================================================
// IMPORTANTE: este agente YA NO conduce la conversacion principal.
// El flujo guiado (precali-flow.js) es quien decide los pasos,
// envia listas/botones y recolecta los datos. Este agente entra
// en escena SOLO cuando la persona se sale del guion (pregunta
// algo, pide una aclaracion, objeta, etc.). Responde corto, con
// los datos reales (via tools), y el flujo se encarga de retomar
// el paso donde iba despues.

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_TOOL_ROUNDS = 3;
const REQUEST_TIMEOUT_MS = 12000;

const TOOLS = [CALCULAR_TOOL_SCHEMA, REQUISITOS_TOOL_SCHEMA];

const SYSTEM_PROMPT_TEMPLATE = `Sos PreCali AI, el asesor crediticio digital de PreCali para Costa Rica.

DONDE ESTAS PARADO
- La conversacion principal con esta persona la lleva un flujo guiado con listas y botones (no vos). A vos te llaman SOLO cuando la persona escribe algo que no es una respuesta directa al paso actual: una pregunta, una duda, una objecion, o un pedido de aclaracion.
- Despues de tu respuesta, el sistema le va a volver a mostrar las opciones/botones del paso en el que estaba. Por eso NO tenes que repetir menus ni botones: solo respondé la duda puntual, corto y claro.
- Usa "vos" de forma natural y respetuosa.

REGLA DE ORO: NUNCA INVENTES NUMEROS
- Para cualquier tasa, monto, cuota o plazo, llama calcular_precalificacion con el perfil que ya se conoce de la persona (te lo paso en el contexto). Nunca inventes ni recalcules numeros vos mismo.
- Si preguntan por requisitos o documentos de un banco concreto, llama consultar_requisitos.
- Si una funcion dice que no hay datos para ese banco, decilo con honestidad.

TONO
- Maximo 4 a 6 lineas. Directo, calido, sin relleno.
- *Negritas* de WhatsApp para montos, bancos o palabras clave.
- No hagas preguntas de seguimiento que ya esten cubiertas por el flujo guiado (ingreso, deudas, prima, etc.) — esas las pregunta el flujo, no vos.
- Si la dificultad es que la persona no entendio el paso actual, aclaraselo de forma simple y breve.
- Nunca muestres JSON, nombres de funciones, ni digas "voy a llamar una funcion".

CONTEXTO ACTUAL DE LA PERSONA
- Pais: {{COUNTRY}}
- Paso actual del flujo guiado: {{STEP}}
- Perfil ya conocido: {{PROFILE_JSON}}`;

function hasGroqKey() {
  return Boolean(process.env.GROQ_API_KEY);
}

function isDisabled() {
  return process.env.PRECALI_AI_DISABLED === "1";
}

function buildSystemPrompt({ country, step, profile }) {
  return SYSTEM_PROMPT_TEMPLATE.replace("{{COUNTRY}}", country || "no identificado")
    .replace("{{STEP}}", step || "inicio")
    .replace("{{PROFILE_JSON}}", JSON.stringify(profile || {}));
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
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
        temperature: 0.4,
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

// aiHistory: turnos previos (cortos) en formato { role, content }
// userText: el mensaje "fuera de guion" que disparo la duda
// context: { country, step, profile }
async function resolverDuda({ aiHistory, userText, context }) {
  if (isDisabled() || !hasGroqKey()) {
    return {
      message: "No pude buscar eso en este momento. Probemos de nuevo en unos minutos, o seguimos con la siguiente pregunta.",
      aiHistory: Array.isArray(aiHistory) ? aiHistory : [],
    };
  }

  const baseHistory = Array.isArray(aiHistory) ? aiHistory : [];
  const messages = [
    { role: "system", content: buildSystemPrompt(context || {}) },
    ...baseHistory,
    { role: "user", content: userText || "(mensaje vacio)" },
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
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        }
        continue;
      }

      finalText = String(message.content || "").trim();
      break;
    }
  } catch (_error) {
    finalText = "";
  }

  if (!finalText) {
    finalText = "Disculpa, tuve un problema respondiendo eso. ¿Seguimos con la siguiente pregunta?";
  }

  const newHistory = baseHistory.concat([
    { role: "user", content: userText },
    { role: "assistant", content: finalText },
  ]);

  return { message: finalText, aiHistory: newHistory };
}

module.exports = {
  resolverDuda,
};
