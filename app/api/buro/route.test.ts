// PreCali — tests for the /api/buro Route Handler.
// Calls POST directly with a synthetic Request (no HTTP server needed).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";
import { resetRateLimiter } from "@/lib/leads/rate-limit";

const BASE = "http://test.local/api/buro";

function req(body: unknown, opts: { ip?: string; apiKey?: string } = {}): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": opts.ip ?? "203.0.113.1",
  };
  if (opts.apiKey !== undefined) headers["x-api-key"] = opts.apiKey;
  return new Request(BASE, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/buro", () => {
  beforeEach(() => {
    resetRateLimiter();
    // No env var by default → public endpoint in these tests.
    vi.stubEnv("PRECALI_BURO_API_KEY", "");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns 200 and a BuroMockResponse for a valid idNumber", async () => {
    const res = await POST(req({ idNumber: "1-2345-6789" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toMatchObject({
      idNumber: "1-2345-6789",
      historyMonths: 48,
    });
    expect(["A1", "A2", "B1", "B2", "C1", "C2", "D", "E"]).toContain(
      json.data.sugefCategory,
    );
    expect(json.data.score).toBeGreaterThanOrEqual(300);
    expect(json.data.score).toBeLessThanOrEqual(850);
    expect(Array.isArray(json.data.operations)).toBe(true);
  });

  it("is deterministic — same idNumber yields the same response byte to byte", async () => {
    const a = await POST(req({ idNumber: "2-0000-0001" }));
    const b = await POST(req({ idNumber: "2-0000-0001" }));
    const ja = await a.json();
    const jb = await b.json();
    // inquiryDate changes between calls → omitted from the comparison.
    const { inquiryDate: _fa, ...restA } = ja.data;
    const { inquiryDate: _fb, ...restB } = jb.data;
    expect(restA).toEqual(restB);
  });

  it("returns 400 when idNumber is missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors).toHaveProperty("idNumber");
  });

  it("returns 400 when idNumber is too short", async () => {
    const res = await POST(req({ idNumber: "ab" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors).toHaveProperty("idNumber");
  });

  it("returns 400 on invalid JSON body", async () => {
    const res = await POST(req("not-json{", { ip: "203.0.113.2" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: "invalid_json" });
  });

  it("does NOT log the idNumber raw value (CWE-532)", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await POST(req({ idNumber: "3-9999-9999" }));
    expect(spy).toHaveBeenCalledOnce();
    const [tag, payload] = spy.mock.calls[0]!;
    expect(tag).toBe("[buro]");
    // The log carries category/score/ts but never the cédula or raw payload.
    expect(payload).not.toHaveProperty("idNumber");
    expect(payload).not.toHaveProperty("operations");
    expect(JSON.stringify(payload)).not.toContain("3-9999-9999");
  });

  it("returns 429 after the (N+1)th request from the same IP (limit=5)", async () => {
    const ip = "198.51.100.42";
    for (let i = 0; i < 5; i++) {
      const res = await POST(req({ idNumber: "1-0000-0001" }, { ip }));
      expect(res.status).toBe(200);
    }
    const over = await POST(req({ idNumber: "1-0000-0001" }, { ip }));
    expect(over.status).toBe(429);
  });

  describe("with PRECALI_BURO_API_KEY set", () => {
    beforeEach(() => {
      vi.stubEnv("PRECALI_BURO_API_KEY", "secret-test-key-1234567890");
    });

    it("rejects requests without x-api-key header with 401", async () => {
      const res = await POST(req({ idNumber: "1-2345-6789" }));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ ok: false, error: "unauthorized" });
    });

    it("rejects requests with a wrong x-api-key with 401", async () => {
      const res = await POST(req({ idNumber: "1-2345-6789" }, { apiKey: "wrong" }));
      expect(res.status).toBe(401);
    });

    it("accepts requests with the matching x-api-key", async () => {
      const res = await POST(
        req({ idNumber: "1-2345-6789" }, { apiKey: "secret-test-key-1234567890" }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });
  });
});
