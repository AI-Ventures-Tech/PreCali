import { describe, it, expect } from "vitest";
import {
  defaultSession,
  normalizeProfile,
  normalizeLead,
  normalizeSession,
  kvConfigured,
  SESSION_VERSION,
} from "@/lib/whatsapp/memory";
import type { Profile, Lead, Session } from "@/lib/whatsapp/types";

describe("whatsapp/memory", () => {
  it("defaultSession() returns step 'inicio', current version and zeroed/empty fields", () => {
    const session = defaultSession();

    expect(session.step).toBe("inicio");
    expect(session.version).toBe(SESSION_VERSION);

    const profile: Profile = session.profile;
    for (const key of Object.keys(profile) as (keyof Profile)[]) {
      const value = profile[key];
      if (typeof value === "number") {
        expect(value).toBe(0);
      } else {
        expect(value).toBe("");
      }
    }

    const lead: Lead = session.lead;
    for (const key of Object.keys(lead) as (keyof Lead)[]) {
      expect(lead[key]).toBe("");
    }

    expect(session.aiHistory).toEqual([]);
    expect(session.lastResults).toBeNull();
    expect(session.targetBank).toBeNull();
    expect(typeof session.updatedAt).toBe("number");
  });

  it("normalizeProfile({income: 'abc'}) cleans to a non-negative finite number (0)", () => {
    const profile = normalizeProfile({ income: "abc" });

    expect(profile.income).toBe(0);
    expect(Number.isFinite(profile.income)).toBe(true);
    expect(profile.income).toBeGreaterThanOrEqual(0);

    // cualquier otro valor numerico valido se mantiene limpio
    expect(normalizeProfile({ income: "1500.7", debt: -3 }).income).toBe(1501);
    expect(normalizeProfile({ debt: -3 }).debt).toBe(0);
  });

  it("normalizeSession(null) returns a valid default session without throwing", () => {
    expect(() => normalizeSession(null)).not.toThrow();

    const session: Session = normalizeSession(null);
    expect(session.step).toBe("inicio");
    expect(session.version).toBe(SESSION_VERSION);
    expect(session.profile.income).toBe(0);
    expect(session.lead.fullName).toBe("");
    expect(Array.isArray(session.aiHistory)).toBe(true);
  });

  it("normalizeLead() coerces fields to safe strings (legacy String(x||'') semantics)", () => {
    // truthy number se stringifica (comportamiento fiel del legado: String(123||"")).
    expect(normalizeLead({ fullName: 123 as unknown as string }).fullName).toBe("123");
    // null/undefined → "" (falsy)
    expect(normalizeLead({ email: null }).email).toBe("");
    expect(normalizeLead({ idNumber: undefined }).idNumber).toBe("");
    // input no-objeto → defaults vacios
    expect(normalizeLead(null).phoneOverride).toBe("");
  });

  it("kvConfigured() is false when no KV/Upstash env is set", () => {
    // En el entorno de test no hay vars de KV configuradas.
    const hadUrl = process.env.KV_REST_API_URL;
    const hadUpUrl = process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.KV_REST_API_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    try {
      expect(kvConfigured()).toBe(false);
    } finally {
      if (hadUrl) process.env.KV_REST_API_URL = hadUrl;
      if (hadUpUrl) process.env.UPSTASH_REDIS_REST_URL = hadUpUrl;
    }
  });
});
