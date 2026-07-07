// PreCali — Route Handler for credit bureau queries (mock Equifax/SUGEF ICIC).
// Today it serves the deterministic mock; tomorrow the same contract wraps the real
// Equifax client. The HTTP signature (POST /api/buro with { idNumber }) stays
// stable across the swap.
//
// Security:
//   - Optional auth via PRECALI_BURO_API_KEY (CWE-306). Without the env var, the
//     endpoint is public (development mode). In production, set the var and
//     require a matching `x-api-key` header (timing-safe comparison).
//   - Rate-limit per IP (CWE-770), reusing the /api/lead bucket.
//   - CWE-532: never log the raw cédula or bureau payload.
//
// Legal: the caller (bot or other service) is responsible for obtaining user
// consent before calling this endpoint (Ley 9859 art. 44 bis). The endpoint does
// not require a `consent` field in the body because that would be security
// theater: a malicious client would just pass it anyway.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMockBuroResponse } from "@/lib/buro/mock-equifax";
import { getEnv } from "@/lib/env";
import { isRateLimited } from "@/lib/leads/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // Lax minimum (string ≥ 3 chars): the mock hashes any string.
  // Strict CR-format validation (X-XXXX-XXXXX) can be added later without breaking
  // the API, once the exact format accepted by Equifax is confirmed.
  idNumber: z.string().trim().min(3, "idNumber required (min 3 chars)"),
  customerReferenceIdentifier: z.string().trim().optional(),
  memberNumber: z.string().trim().optional(),
  securityCode: z.string().trim().optional(),
  customerCode: z.string().trim().optional(),
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
  // No env var → development mode, public endpoint.
  if (!expected) return true;
  const provided = req.headers.get("x-api-key") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual requires equal length; different length is already invalid.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  // CWE-306: optional auth when PRECALI_BURO_API_KEY is set.
  if (!checkApiAuth(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  // CWE-770: rate-limit per IP, same bucket as /api/lead.
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

  // The mock is deterministic: same cédula → same result byte for byte.
  // inquiryDate is metadata only; it does not affect the PRNG seed.
  const buro = generateMockBuroResponse(
    parsed.data.idNumber,
    new Date().toISOString(),
  );

  // CWE-532: never log the cédula or the raw payload.
  console.info("[buro]", {
    ts: new Date().toISOString(),
    category: buro.sugefCategory,
    score: buro.score,
  });

  return json({ ok: true, data: buro }, 200);
}
