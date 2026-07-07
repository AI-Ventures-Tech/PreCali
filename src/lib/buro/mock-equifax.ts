// Mock determinístico de una consulta de buró (Equifax / SUGEF ICIC) para Costa Rica.
// No hay acceso real a la API todavía; este generador produce una respuesta plausible
// y estable por cédula para poder desarrollar el motor calificador aguas abajo.
//
// Determinismo: la misma `idNumber` produce siempre el mismo resultado byte a byte.
// Se prohíbe Math.random / Date.now / new Date() dentro de la generación: la aleatoriedad
// sale de un PRNG (mulberry32) sembrado con un hash FNV-1a de la cédula.

import type {
  BuroMockResponse,
  ComportamientoPagoHistorico,
  OperacionCredito,
  SugefCategoria,
} from "@/types/buro";

// Hash FNV-1a de 32 bits: convierte la cédula en una semilla entera determinística.
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// PRNG mulberry32: rápido, determinístico, sin dependencias. Devuelve floats en [0, 1).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function redondearMil(n: number): number {
  return Math.round(n / 1000) * 1000;
}

interface CategoriaPerfil {
  categoria: SugefCategoria;
  // Peso relativo en la distribución. A2/B1/B2 concentran la masa (población real cae
  // en categorías intermedias); A1 y C2/D/E son colas chicas (prime y alto riesgo).
  peso: number;
  scoreMin: number;
  scoreMax: number;
  comportamientoBase: ComportamientoPagoHistorico;
  probAtrasoOperacion: number; // prob. de que una operación tenga días de atraso
  maxDiasAtraso: number;
  minOperaciones: number;
  moraGarantizada: boolean; // categorías malas deben mostrar al menos una mora activa
  probShopping: number; // prob. de consultas altas en 30 días (shopping de crédito)
  probProtesto: number; // prob. de protestos comerciales
}

// Pesos: A2(18)+B1(22)+B2(20)=60 de masa central; A1(5) cola prime;
// C1(14)+C2(10)+D(7)+E(4)=35 cola de riesgo creciente. Total 100.
const PERFILES: readonly CategoriaPerfil[] = [
  { categoria: "A1", peso: 5, scoreMin: 800, scoreMax: 850, comportamientoBase: 1, probAtrasoOperacion: 0.02, maxDiasAtraso: 15, minOperaciones: 0, moraGarantizada: false, probShopping: 0.05, probProtesto: 0.02 },
  { categoria: "A2", peso: 18, scoreMin: 740, scoreMax: 810, comportamientoBase: 1, probAtrasoOperacion: 0.05, maxDiasAtraso: 20, minOperaciones: 0, moraGarantizada: false, probShopping: 0.08, probProtesto: 0.03 },
  { categoria: "B1", peso: 22, scoreMin: 680, scoreMax: 750, comportamientoBase: 1, probAtrasoOperacion: 0.12, maxDiasAtraso: 30, minOperaciones: 0, moraGarantizada: false, probShopping: 0.12, probProtesto: 0.05 },
  { categoria: "B2", peso: 20, scoreMin: 620, scoreMax: 690, comportamientoBase: 2, probAtrasoOperacion: 0.22, maxDiasAtraso: 45, minOperaciones: 0, moraGarantizada: false, probShopping: 0.18, probProtesto: 0.08 },
  { categoria: "C1", peso: 14, scoreMin: 540, scoreMax: 630, comportamientoBase: 2, probAtrasoOperacion: 0.45, maxDiasAtraso: 75, minOperaciones: 1, moraGarantizada: true, probShopping: 0.28, probProtesto: 0.15 },
  { categoria: "C2", peso: 10, scoreMin: 460, scoreMax: 550, comportamientoBase: 2, probAtrasoOperacion: 0.6, maxDiasAtraso: 110, minOperaciones: 1, moraGarantizada: true, probShopping: 0.38, probProtesto: 0.22 },
  { categoria: "D", peso: 7, scoreMin: 380, scoreMax: 470, comportamientoBase: 3, probAtrasoOperacion: 0.75, maxDiasAtraso: 150, minOperaciones: 1, moraGarantizada: true, probShopping: 0.48, probProtesto: 0.3 },
  { categoria: "E", peso: 4, scoreMin: 300, scoreMax: 390, comportamientoBase: 3, probAtrasoOperacion: 0.9, maxDiasAtraso: 180, minOperaciones: 1, moraGarantizada: true, probShopping: 0.55, probProtesto: 0.4 },
];

const TIPOS_OPERACION = ["hipotecario", "prendario", "personal", "tarjeta"] as const;

const RANGO_MONTO: Record<OperacionCredito["tipo"], readonly [number, number]> = {
  hipotecario: [15_000_000, 80_000_000],
  prendario: [3_000_000, 20_000_000],
  personal: [500_000, 8_000_000],
  tarjeta: [100_000, 3_000_000],
};

const ENTIDADES = [
  "Banco Nacional",
  "Banco de Costa Rica",
  "BAC Credomatic",
  "Banco Popular",
  "Scotiabank",
  "Coopeservidores",
  "Grupo Mutual",
  "Davivienda",
  "Coopenae",
  "Financiera Desyfin",
] as const;

function pickCategoria(rng: () => number): CategoriaPerfil {
  const totalPeso = PERFILES.reduce((sum, p) => sum + p.peso, 0);
  let r = rng() * totalPeso;
  for (const perfil of PERFILES) {
    r -= perfil.peso;
    if (r < 0) return perfil;
  }
  return PERFILES[PERFILES.length - 1];
}

// Comportamiento base con jitter acotado a ±1 (se mantiene coherente con la categoría).
function derivarComportamiento(
  rng: () => number,
  base: ComportamientoPagoHistorico,
): ComportamientoPagoHistorico {
  if (rng() < 0.15) {
    const shifted = base + (rng() < 0.5 ? -1 : 1);
    return Math.min(3, Math.max(1, shifted)) as ComportamientoPagoHistorico;
  }
  return base;
}

function generarOperacion(
  rng: () => number,
  perfil: CategoriaPerfil,
): OperacionCredito {
  const tipo = pick(rng, TIPOS_OPERACION);
  const [minMonto, maxMonto] = RANGO_MONTO[tipo];
  const cancelada = rng() < 0.2;
  const tieneAtraso = !cancelada && rng() < perfil.probAtrasoOperacion;
  const diasAtraso = tieneAtraso ? randInt(rng, 1, perfil.maxDiasAtraso) : 0;
  const montoAdeudado = cancelada ? 0 : redondearMil(randInt(rng, minMonto, maxMonto));
  return { tipo, entidad: pick(rng, ENTIDADES), montoAdeudado, diasAtraso, cancelada };
}

export function generateMockBuroResponse(
  idNumber: string,
  fechaConsulta: string,
): BuroMockResponse {
  const rng = mulberry32(fnv1a(idNumber));

  const perfil = pickCategoria(rng);
  const categoriaSugef = perfil.categoria;
  const score = randInt(rng, perfil.scoreMin, perfil.scoreMax);
  const comportamientoPagoHistorico = derivarComportamiento(rng, perfil.comportamientoBase);

  const numOperaciones = randInt(rng, perfil.minOperaciones, 4);
  const operaciones: OperacionCredito[] = [];
  for (let i = 0; i < numOperaciones; i++) {
    operaciones.push(generarOperacion(rng, perfil));
  }

  // Coherencia: una categoría mala debe reflejar al menos una mora activa.
  if (perfil.moraGarantizada && operaciones.length > 0) {
    const tieneMoraActiva = operaciones.some((o) => !o.cancelada && o.diasAtraso > 0);
    if (!tieneMoraActiva) {
      let target = operaciones.find((o) => !o.cancelada);
      if (!target) {
        target = operaciones[0];
        target.cancelada = false;
        const [minMonto, maxMonto] = RANGO_MONTO[target.tipo];
        target.montoAdeudado = redondearMil(randInt(rng, minMonto, maxMonto));
      }
      target.diasAtraso = randInt(rng, Math.max(1, Math.floor(perfil.maxDiasAtraso / 2)), perfil.maxDiasAtraso);
    }
  }

  const montoTotalAdeudado = operaciones.reduce((sum, o) => sum + o.montoAdeudado, 0);

  // Consultas en 30 días sesgadas fuerte hacia 0; las categorías de riesgo pueden
  // mostrar shopping de crédito (varias consultas recientes).
  let entidadesConsultantesUltimos30Dias = Math.floor(rng() * rng() * 5);
  if (rng() < perfil.probShopping) {
    entidadesConsultantesUltimos30Dias += randInt(rng, 2, 4);
  }
  entidadesConsultantesUltimos30Dias = Math.min(8, entidadesConsultantesUltimos30Dias);

  const protestosComerciales = rng() < perfil.probProtesto ? randInt(rng, 1, 2) : 0;

  return {
    idNumber,
    score,
    categoriaSugef,
    comportamientoPagoHistorico,
    operaciones,
    montoTotalAdeudado,
    entidadesConsultantesUltimos30Dias,
    protestosComerciales,
    historialMeses: 48,
    fechaConsulta,
  };
}
