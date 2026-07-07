// ============================================================
// PreCali AI — Agente para resolver dudas (modo "duda")
// ============================================================
// Port fiel de `api/_lib/precali-agent.js` (CommonJS → TypeScript).
//
// IMPORTANTE: este agente YA NO conduce la conversacion principal.
// El flujo guiado (flow.ts) es quien decide los pasos, envia
// listas/botones y recolecta los datos. Este agente entra en
// escena SOLO cuando la persona se sale del guion (pregunta algo,
// pide una aclaracion, objeta, etc.). Responde corto, con los datos
// reales (via tools), y el flujo se encarga de retomar el paso
// donde iba despues.
//
// Proveedor: Groq (OpenAI-compatible). Usa `fetch` directo contra
// la REST API; no depende del paquete npm `openai`.

import { getEnv } from "@/lib/env";
import {
  calcularPrecalificacion,
  consultarRequisitos,
  CALCULAR_TOOL_SCHEMA,
  REQUISITOS_TOOL_SCHEMA,
} from "@/lib/whatsapp/tools";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_TOOL_ROUNDS = 3;
const REQUEST_TIMEOUT_MS = 12000;

const TOOLS = [CALCULAR_TOOL_SCHEMA, REQUISITOS_TOOL_SCHEMA];

// ---------- Tipos ----------

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
}

export interface ResolverDudaContext {
  country: string;
  step: string;
  profile: object;
  // Risk level from the scoring engine (1/2/3), or null/undefined if the bureau
  // query has not run yet. Only this number is used to modulate tone: never pass
  // the score, sugefCategory, or any other raw bureau payload here (CWE-200 —
  // sensitive simulated financial data).
  riskLevel?: 1 | 2 | 3 | null;
}

export interface ResolverDudaResult {
  message: string;
  aiHistory: ChatMessage[];
}

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
- Perfil ya conocido: {{PROFILE_JSON}}
{{RISK_LEVEL}}`;

// Modulates tone based on the scoring engine's risk level (1/2/3).
// SECURITY: consumes only the level number. Never interpolate the score,
// sugefCategory, operations, or any other bureau field here (CWE-200).
function riskLevelInstruction(level: ResolverDudaContext["riskLevel"]): string {
  switch (level) {
    case 1:
      return "- Nivel de riesgo: 1 (alto riesgo). No vendas productos bancarios ni empujes a aplicar a ningun banco: rol educativo y empatico, guiando un plan de saneamiento crediticio a 6 meses.";
    case 2:
      return "- Nivel de riesgo: 2 (riesgo medio). Aclara que las ofertas van a requerir mayor prima/enganche o ajuste de monto, y prioriza cooperativas/financieras con mas apetito de riesgo sobre bancos tradicionales exigentes.";
    case 3:
      return "- Nivel de riesgo: 3 (cliente prime). Modo de conversion rapida: prioriza las mejores tasas y los bancos lideres.";
    default:
      return "";
  }
}

function hasGroqKey(): boolean {
  return Boolean(getEnv().GROQ_API_KEY);
}

function isDisabled(): boolean {
  return getEnv().PRECALI_AI_DISABLED === "1";
}

export function buildSystemPrompt(context: ResolverDudaContext | null | undefined): string {
  const c = context || ({} as ResolverDudaContext);
  return SYSTEM_PROMPT_TEMPLATE.replace("{{COUNTRY}}", c.country || "no identificado")
    .replace("{{STEP}}", c.step || "inicio")
    .replace("{{PROFILE_JSON}}", JSON.stringify(c.profile || {}))
    .replace("{{RISK_LEVEL}}", riskLevelInstruction(c.riskLevel));
}

function safeJsonParse(value: string | null | undefined): unknown {
  try {
    return JSON.parse(value || "");
  } catch {
    return null;
  }
}

async function callGroqChat(messages: ChatMessage[]): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getEnv().GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getEnv().GROQ_MODEL || DEFAULT_GROQ_MODEL,
        temperature: 0.4,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      const error = new Error(`groq_${response.status}`) as Error & { body?: string };
      error.body = raw.slice(0, 1000);
      throw error;
    }
    return safeJsonParse(raw) as Record<string, unknown> | null;
  } finally {
    clearTimeout(timer);
  }
}

function executeTool(name: string, args: Record<string, unknown>): unknown {
  try {
    if (name === "calcular_precalificacion") return calcularPrecalificacion(args || {});
    if (name === "consultar_requisitos") return consultarRequisitos(args || {});
  } catch (error) {
    return { error: "tool_failed", detalle: String((error && (error as Error).message) || error) };
  }
  return { error: "tool_desconocida" };
}

// aiHistory: turnos previos (cortos) en formato { role, content }
// userText: el mensaje "fuera de guion" que disparo la duda
// context: { country, step, profile }
export async function resolverDuda({
  aiHistory,
  userText,
  context,
}: {
  aiHistory: ChatMessage[] | null | undefined;
  userText: string | null | undefined;
  context: ResolverDudaContext | null | undefined;
}): Promise<ResolverDudaResult> {
  if (isDisabled() || !hasGroqKey()) {
    return {
      message: "No pude buscar eso en este momento. Probemos de nuevo en unos minutos, o seguimos con la siguiente pregunta.",
      aiHistory: Array.isArray(aiHistory) ? aiHistory : [],
    };
  }

  const baseHistory: ChatMessage[] = Array.isArray(aiHistory) ? aiHistory : [];
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(context) },
    ...baseHistory,
    { role: "user", content: userText || "(mensaje vacio)" },
  ];

  let finalText = "";

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const data = await callGroqChat(messages);
      const choices = (data && (data as { choices?: Array<{ message?: Record<string, unknown> }> }).choices) || [];
      const message = choices[0] && choices[0].message;
      if (!message) break;

      const toolCalls = (message.tool_calls as ToolCall[] | undefined) || [];
      if (Array.isArray(toolCalls) && toolCalls.length) {
        messages.push({
          role: "assistant",
          content: (message.content as string | null | undefined) || null,
          tool_calls: toolCalls,
        });
        for (const call of toolCalls) {
          const args = (safeJsonParse(call.function && call.function.arguments) as Record<string, unknown>) || {};
          const result = executeTool((call.function && call.function.name) || "", args);
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        }
        continue;
      }

      finalText = String((message.content as string | null | undefined) || "").trim();
      break;
    }
  } catch {
    finalText = "";
  }

  if (!finalText) {
    finalText = "Disculpa, tuve un problema respondiendo eso. ¿Seguimos con la siguiente pregunta?";
  }

  const newHistory: ChatMessage[] = baseHistory.concat([
    { role: "user", content: userText || "" },
    { role: "assistant", content: finalText },
  ]);

  return { message: finalText, aiHistory: newHistory };
}
