// Deterministic mock of a credit bureau query (Equifax / SUGEF ICIC) for Costa Rica.
// There is no real API access yet; this generator produces a plausible, stable-by-cédula
// response so the downstream scoring engine can be developed.
//
// Determinism: the same `idNumber` always yields the same result, byte for byte.
// Math.random / Date.now / new Date() are forbidden inside generation: randomness
// comes from a mulberry32 PRNG seeded with an FNV-1a hash of the cédula.

import type {
  BuroMockResponse,
  HistoricalPaymentBehavior,
  CreditOperation,
  SugefCategory,
} from "@/types/buro";

// 32-bit FNV-1a hash: turns the cédula into a deterministic integer seed.
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32 PRNG: fast, deterministic, no dependencies. Returns floats in [0, 1).
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

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000;
}

interface CategoryProfile {
  category: SugefCategory;
  // Relative weight in the distribution. A2/B1/B2 hold the bulk of the mass (real
  // population falls in the middle categories); A1 and C2/D/E are small tails (prime
  // and high-risk respectively).
  weight: number;
  scoreMin: number;
  scoreMax: number;
  baseBehavior: HistoricalPaymentBehavior;
  probOperationPastDue: number; // probability that an operation has past-due days
  maxDaysPastDue: number;
  minOperations: number;
  guaranteedDefault: boolean; // bad categories must show at least one active default
  probShopping: number; // probability of high inquiries in 30 days (credit shopping)
  probProtest: number; // probability of commercial protests
}

// Weights: A2(18)+B1(22)+B2(20)=60 of central mass; A1(5) prime tail;
// C1(14)+C2(10)+D(7)+E(4)=35 of increasing-risk tail. Total 100.
const CATEGORY_PROFILES: readonly CategoryProfile[] = [
  { category: "A1", weight: 5, scoreMin: 800, scoreMax: 850, baseBehavior: 1, probOperationPastDue: 0.02, maxDaysPastDue: 15, minOperations: 0, guaranteedDefault: false, probShopping: 0.05, probProtest: 0.02 },
  { category: "A2", weight: 18, scoreMin: 740, scoreMax: 810, baseBehavior: 1, probOperationPastDue: 0.05, maxDaysPastDue: 20, minOperations: 0, guaranteedDefault: false, probShopping: 0.08, probProtest: 0.03 },
  { category: "B1", weight: 22, scoreMin: 680, scoreMax: 750, baseBehavior: 1, probOperationPastDue: 0.12, maxDaysPastDue: 30, minOperations: 0, guaranteedDefault: false, probShopping: 0.12, probProtest: 0.05 },
  { category: "B2", weight: 20, scoreMin: 620, scoreMax: 690, baseBehavior: 2, probOperationPastDue: 0.22, maxDaysPastDue: 45, minOperations: 0, guaranteedDefault: false, probShopping: 0.18, probProtest: 0.08 },
  { category: "C1", weight: 14, scoreMin: 540, scoreMax: 630, baseBehavior: 2, probOperationPastDue: 0.45, maxDaysPastDue: 75, minOperations: 1, guaranteedDefault: true, probShopping: 0.28, probProtest: 0.15 },
  { category: "C2", weight: 10, scoreMin: 460, scoreMax: 550, baseBehavior: 2, probOperationPastDue: 0.6, maxDaysPastDue: 110, minOperations: 1, guaranteedDefault: true, probShopping: 0.38, probProtest: 0.22 },
  { category: "D", weight: 7, scoreMin: 380, scoreMax: 470, baseBehavior: 3, probOperationPastDue: 0.75, maxDaysPastDue: 150, minOperations: 1, guaranteedDefault: true, probShopping: 0.48, probProtest: 0.3 },
  { category: "E", weight: 4, scoreMin: 300, scoreMax: 390, baseBehavior: 3, probOperationPastDue: 0.9, maxDaysPastDue: 180, minOperations: 1, guaranteedDefault: true, probShopping: 0.55, probProtest: 0.4 },
];

const OPERATION_TYPES = ["hipotecario", "prendario", "personal", "tarjeta"] as const;

const AMOUNT_RANGES: Record<CreditOperation["type"], readonly [number, number]> = {
  hipotecario: [15_000_000, 80_000_000],
  prendario: [3_000_000, 20_000_000],
  personal: [500_000, 8_000_000],
  tarjeta: [100_000, 3_000_000],
};

const INSTITUTIONS = [
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

function pickCategory(rng: () => number): CategoryProfile {
  const totalWeight = CATEGORY_PROFILES.reduce((sum, p) => sum + p.weight, 0);
  let r = rng() * totalWeight;
  for (const profile of CATEGORY_PROFILES) {
    r -= profile.weight;
    if (r < 0) return profile;
  }
  return CATEGORY_PROFILES[CATEGORY_PROFILES.length - 1];
}

// Base behavior with bounded jitter of ±1 (stays coherent with the category).
function deriveBehavior(
  rng: () => number,
  base: HistoricalPaymentBehavior,
): HistoricalPaymentBehavior {
  if (rng() < 0.15) {
    const shifted = base + (rng() < 0.5 ? -1 : 1);
    return Math.min(3, Math.max(1, shifted)) as HistoricalPaymentBehavior;
  }
  return base;
}

function generateOperation(
  rng: () => number,
  profile: CategoryProfile,
): CreditOperation {
  const type = pick(rng, OPERATION_TYPES);
  const [minAmount, maxAmount] = AMOUNT_RANGES[type];
  const closed = rng() < 0.2;
  const hasPastDue = !closed && rng() < profile.probOperationPastDue;
  const daysPastDue = hasPastDue ? randInt(rng, 1, profile.maxDaysPastDue) : 0;
  const amountOwed = closed ? 0 : roundToThousand(randInt(rng, minAmount, maxAmount));
  return { type, institution: pick(rng, INSTITUTIONS), amountOwed, daysPastDue, closed };
}

export function generateMockBuroResponse(
  idNumber: string,
  inquiryDate: string,
): BuroMockResponse {
  const rng = mulberry32(fnv1a(idNumber));

  const profile = pickCategory(rng);
  const sugefCategory = profile.category;
  const score = randInt(rng, profile.scoreMin, profile.scoreMax);
  const historicalPaymentBehavior = deriveBehavior(rng, profile.baseBehavior);

  const numOperations = randInt(rng, profile.minOperations, 4);
  const operations: CreditOperation[] = [];
  for (let i = 0; i < numOperations; i++) {
    operations.push(generateOperation(rng, profile));
  }

  // Coherence: a bad category must reflect at least one active default.
  if (profile.guaranteedDefault && operations.length > 0) {
    const hasActiveDefault = operations.some((o) => !o.closed && o.daysPastDue > 0);
    if (!hasActiveDefault) {
      let target = operations.find((o) => !o.closed);
      if (!target) {
        target = operations[0];
        target.closed = false;
        const [minAmount, maxAmount] = AMOUNT_RANGES[target.type];
        target.amountOwed = roundToThousand(randInt(rng, minAmount, maxAmount));
      }
      target.daysPastDue = randInt(rng, Math.max(1, Math.floor(profile.maxDaysPastDue / 2)), profile.maxDaysPastDue);
    }
  }

  const totalAmountOwed = operations.reduce((sum, o) => sum + o.amountOwed, 0);

  // Inquiries in the last 30 days are heavily skewed toward 0; risk categories may
  // show credit shopping (multiple recent inquiries).
  let inquiriesLast30Days = Math.floor(rng() * rng() * 5);
  if (rng() < profile.probShopping) {
    inquiriesLast30Days += randInt(rng, 2, 4);
  }
  inquiriesLast30Days = Math.min(8, inquiriesLast30Days);

  const commercialProtests = rng() < profile.probProtest ? randInt(rng, 1, 2) : 0;

  return {
    idNumber,
    score,
    sugefCategory,
    historicalPaymentBehavior,
    operations,
    totalAmountOwed,
    inquiriesLast30Days,
    commercialProtests,
    historyMonths: 48,
    inquiryDate,
    status: "completed" as const,
    hitCode: { code: "1" },
    links: [],
  };
}
