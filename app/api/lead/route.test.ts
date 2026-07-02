// PreCali — tests for the /api/lead Route Handler.
// Calls POST directly with a synthetic Request (no HTTP server needed).

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { POST } from "./route";
import { resetRateLimiter } from "@/lib/leads/rate-limit";

const BASE = "http://test.local/api/lead";

function validBody(): URLSearchParams {
  return new URLSearchParams({
    nombre: "Ada",
    apellido: "Lovelace",
    email: "ada@example.com",
    banco: "BAC Credomatic",
    "tipo-prestamo": "personal",
    monto: "₡1.000.000",
    cuota: "₡45.000",
    "acepta-terminos": "sí",
    "acepta-marketing": "sí",
    "bot-field": "",
  });
}

function req(body: URLSearchParams, ip = "203.0.113.1"): Request {
  return new Request(BASE, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": ip,
    },
    body: body.toString(),
  });
}

describe("POST /api/lead", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid payload and returns {ok:true}", async () => {
    const res = await POST(req(validBody()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("logs the lead via console.info on success", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await POST(req(validBody()));
    expect(spy).toHaveBeenCalledOnce();
    const [tag, payload] = spy.mock.calls[0]!;
    expect(tag).toBe("[lead]");
    expect(payload).toMatchObject({
      nombre: "Ada",
      email: "ada@example.com",
      banco: "BAC Credomatic",
      tipo: "personal",
      marketing: "sí",
    });
    expect(payload).toHaveProperty("ts");
    // No secrets in payload shape.
    expect(payload).not.toHaveProperty("authToken");
  });

  it("rejects a missing email with 400 and field errors", async () => {
    const body = validBody();
    body.delete("email");
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors).toHaveProperty("email");
  });

  it("rejects when 'acepta-terminos' is not the literal 'sí'", async () => {
    const body = validBody();
    body.set("acepta-terminos", "on");
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors).toHaveProperty("acepta-terminos");
  });

  it("silently drops a honeypot-filled request with 200 and no side effects", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const body = validBody();
    body.set("bot-field", "spam-bot-123");
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns 429 after the (N+1)th request from the same IP (limit=5)", async () => {
    const ip = "198.51.100.42";
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    for (let i = 0; i < 5; i++) {
      const res = await POST(req(validBody(), ip));
      expect(res.status).toBe(200);
    }
    const over = await POST(req(validBody(), ip));
    expect(over.status).toBe(429);
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it("does not share rate-limit buckets across different IPs", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    for (let i = 0; i < 5; i++) {
      await POST(req(validBody(), `10.0.0.${i}`));
    }
    const other = await POST(req(validBody(), "10.0.0.99"));
    expect(other.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(6);
  });
});
