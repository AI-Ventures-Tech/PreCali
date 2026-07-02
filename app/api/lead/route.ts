// PreCali — Route Handler for lead capture (replaces the legacy broken POST to "/").
// Receives x-www-form-urlencoded payloads from the calculators and persists via log (Q1 = log + email).

import { NextResponse } from "next/server";
import { leadSchema } from "@/lib/leads/schema";
import { isRateLimited } from "@/lib/leads/rate-limit";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

function json(body: unknown, status: number): Response {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request): Promise<Response> {
  let params: URLSearchParams;
  try {
    const text = await req.text();
    params = new URLSearchParams(text);
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  // Honeypot: silently drop bots with a 200 so they can't tell.
  // bot-field must be empty (schema also enforces max(0)); any content = bot.
  const rawBot = params.get("bot-field") ?? "";
  if (rawBot.length > 0) {
    return json({ ok: true }, 200);
  }

  // Rate-limit by IP (CWE-770).
  if (isRateLimited(clientIp(req))) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  const data = Object.fromEntries(params.entries());
  const parsed = leadSchema.safeParse(data);
  if (!parsed.success) {
    return json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  // Q1 = log + email (no DB yet). No secrets in this payload.
  console.info("[lead]", {
    nombre: parsed.data.nombre,
    apellido: parsed.data.apellido,
    email: parsed.data.email,
    banco: parsed.data.banco,
    tipo: parsed.data["tipo-prestamo"],
    monto: parsed.data.monto,
    cuota: parsed.data.cuota,
    marketing: parsed.data["acepta-marketing"],
    ts: new Date().toISOString(),
  });

  return json({ ok: true }, 200);
}
