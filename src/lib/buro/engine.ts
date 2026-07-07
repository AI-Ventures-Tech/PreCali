// Motor calificador de leads a partir del mock de buró (Equifax/SUGEF ICIC).
// La precedencia de reglas está fijada por negocio; ver plan S3. No reinterpretar el orden.

import type {
  BuroMockResponse,
  EngineConfig,
  EngineResult,
} from "@/types/buro";
import type { Profile } from "@/lib/whatsapp/types";

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  scorePrimeThreshold: 700,
  ratioDeudaIngresoAlerta: 0.5,
  ratioDeudaIngresoPrecalificado: 0.45,
  moraActivaDiasLimite: 90,
  shoppingCreditoConsultas30d: 5,
};

const CATEGORIAS_NIVEL_1 = new Set(["B2", "C1", "C2", "D", "E"]);

function mergeConfig(config?: Partial<EngineConfig>): EngineConfig {
  const merged = { ...DEFAULT_ENGINE_CONFIG };
  if (!config) return merged;
  for (const key of Object.keys(DEFAULT_ENGINE_CONFIG) as (keyof EngineConfig)[]) {
    const value = config[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      merged[key] = value;
    }
  }
  return merged;
}

export function calificarLead(
  buro: BuroMockResponse,
  profile: Pick<Profile, "income" | "debt">,
  config?: Partial<EngineConfig>,
): EngineResult {
  const cfg = mergeConfig(config);

  const ratioDeudaIngreso = profile.debt / Math.max(1, profile.income);
  const ratioAlto = ratioDeudaIngreso > cfg.ratioDeudaIngresoAlerta;
  const shoppingCredito =
    buro.entidadesConsultantesUltimos30Dias > cfg.shoppingCreditoConsultas30d;

  const moraActivaSevera = buro.operaciones.some(
    (op) => op.diasAtraso > cfg.moraActivaDiasLimite,
  );

  let nivel: EngineResult["nivel"];
  let motivo: string;

  if (moraActivaSevera) {
    // Regla 1: override duro, pisa categoría y score.
    nivel = 1;
    motivo = "mora activa > 90 dias";
  } else if (CATEGORIAS_NIVEL_1.has(buro.categoriaSugef)) {
    // Regla 2: B2 cuenta como Nivel 1 (alto riesgo), no Nivel 2.
    nivel = 1;
    motivo = "categoria B2/C1-E";
  } else if (
    buro.score >= cfg.scorePrimeThreshold &&
    ratioDeudaIngreso <= cfg.ratioDeudaIngresoPrecalificado
  ) {
    // Regla 3: categoría A1/A2/B1 + score y ratio dentro de umbral.
    nivel = 3;
    motivo = "categoria prime, score y ratio dentro de umbral";
  } else {
    // Regla 4: categoría buena pero score o ratio insuficiente.
    nivel = 2;
    motivo = "categoria buena pero score/ratio insuficiente";
  }

  // Regla 5 (cap): ratio por encima de la alerta nunca permite Nivel 3.
  if (ratioAlto && nivel === 3) {
    nivel = 2;
  }

  return {
    nivel,
    categoriaSugef: buro.categoriaSugef,
    score: buro.score,
    ratioDeudaIngreso,
    moraActivaSevera,
    shoppingCredito,
    ratioAlto,
    motivo,
  };
}
