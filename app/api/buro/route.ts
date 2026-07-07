// PreCali — Route Handler para consulta de buró (mock Equifax/SUGEF ICIC).
// Hoy sirve el mock determinístico; mañana envuelve el cliente real de Equifax.
// La firma HTTP (POST /api/buro con { idNumber }) se mantiene estable en el swap.
//
// Seguridad:
//   - Auth opcional vía PRECALI_BURO_API_KEY (CWE-306). Sin la env var, el
//     endpoint es público (modo desarrollo). En producción, setear la var y
//     exigir header `x-api-key` coincidente (comparación timing-safe).
//   - Rate-limit por IP (CWE-770), reutilizando el bucket de /api/lead.
//   - CWE-532: nunca loguear la cédula cruda ni el payload del buró.
//
// Legal: el caller (bot u otro servicio) es responsable de tener consentimiento
// del usuario antes de llamar este endpoint (Ley 9859 art. 44 bis). El endpoint
// no requiere un campo `consentimiento` en el body porque eso sería teatro de
// seguridad: un cliente malicioso lo pasaría igual.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMockBuroResponse } from "@/lib/buro/mock-equifax";
import { getEnv } from "@/lib/env";
import { isRateLimited } from "@/lib/leads/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // Mínimo laxo (string ≥ 3 chars): el mock hashea cualquier string.
  // Validación estricta de formato CR (X-XXXX-XXXXX) se puede agregar luego
  // sin romper la API, cuando se confirme el formato exacto aceptado por Equifax.
  idNumber: z.string().trim().min(3, "idNumber requerido (min 3 chars)"),
});

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

function checkApiAuth(req: Request): boolean {
  const expected = getEnv().PRECALI_BURO_API_KEY;
  // Sin env var → modo desarrollo, endpoint público.
  if (!expected) return true;
  const provided = req.headers.get("x-api-key") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual exige igual longitud; distinta longitud ya es inválido.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  // CWE-306: auth opcional cuando PRECALI_BURO_API_KEY está seteada.
  if (!checkApiAuth(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  // CWE-770: rate-limit por IP, mismo bucket que /api/lead.
  if (isRateLimited(clientIp(req))) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  // El mock es determinista: misma cédula → mismo resultado byte a byte.
  // fechaConsulta va como metadata aparte, no afecta el seed del PRNG.
  const buro = generateMockBuroResponse(
    parsed.data.idNumber,
    new Date().toISOString(),
  );

  // CWE-532: nunca loguear la cédula ni el payload crudo.
  console.info("[buro]", {
    ts: new Date().toISOString(),
    categoria: buro.categoriaSugef,
    score: buro.score,
  });

  return json({ ok: true, data: buro }, 200);
}
