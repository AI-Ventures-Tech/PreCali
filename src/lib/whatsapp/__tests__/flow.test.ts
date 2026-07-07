import { describe, it, expect } from "vitest";
import { handleIncoming } from "@/lib/whatsapp/flow";
import { defaultSession } from "@/lib/whatsapp/memory";
import { generateMockBuroResponse } from "@/lib/buro/mock-equifax";
import { calificarLead } from "@/lib/buro/engine";
import type { Session } from "@/lib/whatsapp/types";
import type { EngineResult } from "@/types/buro";

function makeBuroResult(overrides: Partial<EngineResult>): EngineResult {
  return {
    nivel: 3,
    categoriaSugef: "A1",
    score: 800,
    ratioDeudaIngreso: 0.1,
    moraActivaSevera: false,
    shoppingCredito: false,
    ratioAlto: false,
    motivo: "test",
    ...overrides,
  };
}

function leadDatosSession(overrides: Partial<Session> = {}): Session {
  return {
    ...defaultSession(),
    step: "lead_datos",
    profile: { ...defaultSession().profile, income: 800_000, debt: 100_000 },
    ...overrides,
  };
}

describe("flow/stepLeadDatos — motor calificador con mock de buro", () => {
  it("popula session.buroResult con un nivel valido cuando los datos del lead son completos", async () => {
    const session = leadDatosSession();
    const result = await handleIncoming({
      session,
      bodyText: "Juan Perez\n1-2345-6789\njuan@example.com",
      defaultCountry: "cr",
    });

    expect(result.session.buroResult).not.toBeNull();
    expect([1, 2, 3]).toContain(result.session.buroResult!.nivel);
    expect(result.session.step).toBe("lead_fuente_ingresos");
    expect(result.session.lead.idNumber).toBe("1-2345-6789");
  });

  it("es reproducible: la misma cedula produce el mismo nivel en dos corridas separadas", async () => {
    const bodyText = "Juan Perez\n1-2345-6789\njuan@example.com";
    const r1 = await handleIncoming({ session: leadDatosSession(), bodyText, defaultCountry: "cr" });
    const r2 = await handleIncoming({ session: leadDatosSession(), bodyText, defaultCountry: "cr" });

    expect(r1.session.buroResult!.nivel).toBe(r2.session.buroResult!.nivel);
    expect(r1.session.buroResult!.categoriaSugef).toBe(r2.session.buroResult!.categoriaSugef);
  });

  it("coincide con calificarLead(generateMockBuroResponse(...)) invocado directamente para la misma cedula", async () => {
    const idNumber = "1-2345-6789";
    const profile = { income: 800_000, debt: 100_000 };
    const session = leadDatosSession({ profile: { ...defaultSession().profile, ...profile } });
    const result = await handleIncoming({
      session,
      bodyText: `Juan Perez\n${idNumber}\njuan@example.com`,
      defaultCountry: "cr",
    });

    const buro = generateMockBuroResponse(idNumber, "cualquier-fecha-no-afecta-el-nivel");
    const expected = calificarLead(buro, profile);
    expect(result.session.buroResult!.nivel).toBe(expected.nivel);
  });

  it("no calcula buroResult todavia si faltan datos del lead (cedula ausente)", async () => {
    const session = leadDatosSession();
    const result = await handleIncoming({
      session,
      bodyText: "Juan Perez\njuan@example.com",
      defaultCountry: "cr",
    });

    expect(result.session.buroResult).toBeNull();
    expect(result.session.step).toBe("lead_datos");
  });
});

describe("flow/goToHardPull — nivel de riesgo gatea el hard pull", () => {
  function datosConfirmadosSession(buroResult: EngineResult): Session {
    return {
      ...defaultSession(),
      step: "confirmar_datos_extraidos",
      targetBank: "BAC Credomatic",
      buroResult,
    };
  }

  it("nivel 1: redirige a flujo de rescate, no ofrece 'Autorizo banco', y pausa la sesion", async () => {
    const session = datosConfirmadosSession(makeBuroResult({ nivel: 1 }));
    const result = await handleIncoming({ session, bodyText: "correcto", defaultCountry: "cr" });

    expect(result.session.step).toBe("pausado");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].kind).toBe("text");
    expect(JSON.stringify(result.actions)).toContain("banco tradicional");
    expect(JSON.stringify(result.actions)).not.toContain("Autorizo banco");
  });

  it("nivel 2: llega a confirmar_hard_pull con nota de prima/ajuste de monto", async () => {
    const session = datosConfirmadosSession(makeBuroResult({ nivel: 2 }));
    const result = await handleIncoming({ session, bodyText: "correcto", defaultCountry: "cr" });

    expect(result.session.step).toBe("confirmar_hard_pull");
    expect(JSON.stringify(result.actions)).toContain("prima");
    expect(JSON.stringify(result.actions)).toContain("Autorizo banco");
  });

  it("nivel 3: llega a confirmar_hard_pull sin nota de prima/ajuste", async () => {
    const session = datosConfirmadosSession(makeBuroResult({ nivel: 3 }));
    const result = await handleIncoming({ session, bodyText: "correcto", defaultCountry: "cr" });

    expect(result.session.step).toBe("confirmar_hard_pull");
    expect(JSON.stringify(result.actions)).not.toContain("prima");
  });

  it("redisplayStep en confirmar_hard_pull conserva la nota de nivel 2 (no se pierde en un re-render)", async () => {
    // Primero llegamos a confirmar_hard_pull con nivel 2 (la nota queda en el body original).
    const arrived = await handleIncoming({
      session: datosConfirmadosSession(makeBuroResult({ nivel: 2 })),
      bodyText: "correcto",
      defaultCountry: "cr",
    });
    expect(arrived.session.step).toBe("confirmar_hard_pull");

    // Un mensaje que no matchea "autorizo"/"no" dispara manejarDuda + redisplayStep del mismo paso.
    const redisplay = await handleIncoming({
      session: arrived.session,
      bodyText: "no entendi bien",
      defaultCountry: "cr",
    });
    expect(redisplay.session.step).toBe("confirmar_hard_pull");
    expect(JSON.stringify(redisplay.actions)).toContain("prima");
  });
});
