import { describe, it, expect } from "vitest";
import { handleIncoming } from "@/lib/whatsapp/flow";
import { defaultSession } from "@/lib/whatsapp/memory";
import { generateMockBuroResponse } from "@/lib/buro/mock-equifax";
import { scoreLead } from "@/lib/buro/engine";
import type { Session } from "@/lib/whatsapp/types";
import type { RiskLevel } from "@/types/buro";

function leadDatosSession(overrides: Partial<Session> = {}): Session {
  return {
    ...defaultSession(),
    step: "lead_datos",
    profile: { ...defaultSession().profile, income: 800_000, debt: 100_000 },
    ...overrides,
  };
}

describe("flow/stepLeadDatos — scoring engine with bureau mock", () => {
  it("populates session.buroLevel with a valid value when lead data is complete", async () => {
    const session = leadDatosSession();
    const result = await handleIncoming({
      session,
      bodyText: "Juan Perez\n1-2345-6789\njuan@example.com",
      defaultCountry: "cr",
    });

    expect(result.session.buroLevel).not.toBeNull();
    expect([1, 2, 3]).toContain(result.session.buroLevel);
    expect(result.session.step).toBe("lead_fuente_ingresos");
    expect(result.session.lead.idNumber).toBe("1-2345-6789");
  });

  it("is reproducible — same cédula yields the same level across separate runs", async () => {
    const bodyText = "Juan Perez\n1-2345-6789\njuan@example.com";
    const r1 = await handleIncoming({ session: leadDatosSession(), bodyText, defaultCountry: "cr" });
    const r2 = await handleIncoming({ session: leadDatosSession(), bodyText, defaultCountry: "cr" });

    expect(r1.session.buroLevel).toBe(r2.session.buroLevel);
  });

  it("matches scoreLead(generateMockBuroResponse(...)) called directly for the same cédula", async () => {
    const idNumber = "1-2345-6789";
    const profile = { income: 800_000, debt: 100_000 };
    const session = leadDatosSession({ profile: { ...defaultSession().profile, ...profile } });
    const result = await handleIncoming({
      session,
      bodyText: `Juan Perez\n${idNumber}\njuan@example.com`,
      defaultCountry: "cr",
    });

    const buro = generateMockBuroResponse(idNumber, "any-date-does-not-affect-level");
    const expected = scoreLead(buro, profile);
    expect(result.session.buroLevel).toBe(expected.level);
  });

  it("does not compute buroLevel yet if lead data is incomplete (cédula missing)", async () => {
    const session = leadDatosSession();
    const result = await handleIncoming({
      session,
      bodyText: "Juan Perez\njuan@example.com",
      defaultCountry: "cr",
    });

    expect(result.session.buroLevel).toBeNull();
    expect(result.session.step).toBe("lead_datos");
  });
});

describe("flow/goToHardPull — risk level gates the hard pull", () => {
  function datosConfirmadosSession(buroLevel: RiskLevel): Session {
    return {
      ...defaultSession(),
      step: "confirmar_datos_extraidos",
      targetBank: "BAC Credomatic",
      buroLevel,
    };
  }

  it("level 1: redirects to rescue flow, does not offer 'Autorizo banco', and pauses the session", async () => {
    const session = datosConfirmadosSession(1);
    const result = await handleIncoming({ session, bodyText: "correcto", defaultCountry: "cr" });

    expect(result.session.step).toBe("pausado");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].kind).toBe("text");
    expect(JSON.stringify(result.actions)).toContain("banco tradicional");
    expect(JSON.stringify(result.actions)).not.toContain("Autorizo banco");
  });

  it("level 2: reaches confirmar_hard_pull with prima/amount-adjustment note", async () => {
    const session = datosConfirmadosSession(2);
    const result = await handleIncoming({ session, bodyText: "correcto", defaultCountry: "cr" });

    expect(result.session.step).toBe("confirmar_hard_pull");
    expect(JSON.stringify(result.actions)).toContain("prima");
    expect(JSON.stringify(result.actions)).toContain("Autorizo banco");
  });

  it("level 3: reaches confirmar_hard_pull without prima/adjustment note", async () => {
    const session = datosConfirmadosSession(3);
    const result = await handleIncoming({ session, bodyText: "correcto", defaultCountry: "cr" });

    expect(result.session.step).toBe("confirmar_hard_pull");
    expect(JSON.stringify(result.actions)).not.toContain("prima");
  });

  it("redisplayStep at confirmar_hard_pull preserves the level-2 note (not lost on re-render)", async () => {
    // First reach confirmar_hard_pull with level 2 (the note is in the original body).
    const arrived = await handleIncoming({
      session: datosConfirmadosSession(2),
      bodyText: "correcto",
      defaultCountry: "cr",
    });
    expect(arrived.session.step).toBe("confirmar_hard_pull");

    // A message that doesn't match "autorizo"/"no" triggers manejarDuda + redisplayStep of the same step.
    const redisplay = await handleIncoming({
      session: arrived.session,
      bodyText: "no entendi bien",
      defaultCountry: "cr",
    });
    expect(redisplay.session.step).toBe("confirmar_hard_pull");
    expect(JSON.stringify(redisplay.actions)).toContain("prima");
  });
});
