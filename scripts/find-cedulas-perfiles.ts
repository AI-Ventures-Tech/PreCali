// scripts/find-cedulas-perfiles.ts
//
// Searches a canonical set of 15 cédulas with realistic Costa Rica profiles,
// distributed 5/5/5 across risk levels. Each persona has:
//   - Cédula in realistic CR format (X-YYYY-ZZZZZ, province 1-7).
//   - Profile (income, debt) coherent with its story.
//   - Target category to enrich set variety.
//
// Usage:
//   npx tsx scripts/find-cedulas-perfiles.ts

import { generateMockBuroResponse } from "@/lib/buro/mock-equifax";
import { scoreLead } from "@/lib/buro/engine";
import type { SugefCategory, BuroReportStatus, BuroReportLink } from "@/types/buro";

interface Persona {
  nombre: string;
  province: number; // 1-7
  income: number;
  debt: number;
  targetLevel: 1 | 2 | 3;
  targetCategory?: SugefCategory;
  story: string;
}

const PROVINCES: Record<number, string> = {
  1: "San José",
  2: "Alajuela",
  3: "Cartago",
  4: "Heredia",
  5: "Guanacaste",
  6: "Puntarenas",
  7: "Limón",
};

const PERSONAS: Persona[] = [
  // === Level 1 (does not qualify) ===
  {
    nombre: "Pedro", province: 7,
    income: 600_000, debt: 550_000, // ratio 0.92 — over-indebted
    targetLevel: 1, targetCategory: "E",
    story: "Heavily over-indebted, damaged history",
  },
  {
    nombre: "María", province: 1,
    income: 800_000, debt: 300_000,
    targetLevel: 1, targetCategory: "D",
    story: "Severe active default (>90 days)",
  },
  {
    nombre: "José", province: 2,
    income: 700_000, debt: 200_000,
    targetLevel: 1, targetCategory: "C2",
    story: "Low income, low category",
  },
  {
    nombre: "Ana", province: 3,
    income: 900_000, debt: 200_000,
    targetLevel: 1, targetCategory: "C1",
    story: "Low category with credit shopping",
  },
  {
    nombre: "Carlos", province: 5,
    income: 1_200_000, debt: 400_000,
    targetLevel: 1, targetCategory: "B2",
    story: "B2 — upper boundary of high risk",
  },
  // === Level 2 (regular) ===
  {
    nombre: "Luis", province: 4,
    income: 1_000_000, debt: 300_000,
    targetLevel: 2, targetCategory: "B1",
    story: "B1 with low score (recovering history)",
  },
  {
    nombre: "Sofía", province: 6,
    income: 1_300_000, debt: 700_000, // ratio 0.54 — hasHighDebtRatio
    targetLevel: 2, targetCategory: "A2",
    story: "A2 but over-indebted (ratio > 0.50 → cap)",
  },
  {
    nombre: "Diego", province: 1,
    income: 1_000_000, debt: 200_000,
    targetLevel: 2, targetCategory: "B1",
    story: "B1 with score < 700",
  },
  {
    nombre: "Elena", province: 2,
    income: 1_400_000, debt: 350_000,
    targetLevel: 2, targetCategory: "A2",
    story: "A2 with insufficient score",
  },
  {
    nombre: "Marco", province: 3,
    income: 1_100_000, debt: 550_000, // ratio 0.50 — at the limit
    targetLevel: 2, targetCategory: "B1",
    story: "B1 with ratio at the limit",
  },
  // === Level 3 (good customer) ===
  {
    nombre: "Patricia", province: 1,
    income: 2_500_000, debt: 300_000,
    targetLevel: 3, targetCategory: "A1",
    story: "A1 — premium customer",
  },
  {
    nombre: "Roberto", province: 4,
    income: 1_800_000, debt: 200_000,
    targetLevel: 3, targetCategory: "A2",
    story: "Solid A2, high income",
  },
  {
    nombre: "Carmen", province: 2,
    income: 1_600_000, debt: 100_000,
    targetLevel: 3, targetCategory: "A2",
    story: "A2 with clean history",
  },
  {
    nombre: "Andrés", province: 3,
    income: 1_500_000, debt: 250_000,
    targetLevel: 3, targetCategory: "B1",
    story: "B1 with high score",
  },
  {
    nombre: "Gabriela", province: 5,
    income: 3_000_000, debt: 400_000,
    targetLevel: 3, targetCategory: "A1",
    story: "A1 — premium income",
  },
];

function formatCedula(province: number, n: number): string {
  const str = String(n).padStart(8, "0");
  return `${province}-${str.slice(0, 4)}-${str.slice(4, 8)}`;
}

interface Match {
  nombre: string;
  province: number;
  cedula: string;
  income: number;
  debt: number;
  level: 1 | 2 | 3;
  category: SugefCategory;
  score: number;
  reason: string;
  ratio: number;
  hasHighDebtRatio: boolean;
  hasSevereActiveDefault: boolean;
  isCreditShopping: boolean;
  operations: number;
  exactMatch: boolean;
  story: string;
  status: BuroReportStatus;
  hitCode: { code: string };
  links: BuroReportLink[];
}

function findCedula(persona: Persona, maxAttempts = 30_000): Match | null {
  let fallback: Match | null = null;
  for (let i = 1; i <= maxAttempts; i++) {
    const cedula = formatCedula(persona.province, i);
    const buro = generateMockBuroResponse(cedula, new Date().toISOString());
    const result = scoreLead(buro, { income: persona.income, debt: persona.debt });

    if (result.level !== persona.targetLevel) continue;

    const exactMatch =
      !persona.targetCategory || buro.sugefCategory === persona.targetCategory;

    const match: Match = {
      nombre: persona.nombre,
      province: persona.province,
      cedula,
      income: persona.income,
      debt: persona.debt,
      level: result.level,
      category: buro.sugefCategory,
      score: buro.score,
      reason: result.reason,
      ratio: Number(result.debtToIncomeRatio.toFixed(2)),
      hasHighDebtRatio: result.hasHighDebtRatio,
      hasSevereActiveDefault: result.hasSevereActiveDefault,
      isCreditShopping: result.isCreditShopping,
      operations: buro.operations.length,
      exactMatch,
      story: persona.story,
      status: buro.status,
      hitCode: buro.hitCode,
      links: buro.links,
    };

    if (exactMatch) return match;
    if (!fallback) fallback = match;
  }
  return fallback;
}

function main() {
  const results: Match[] = [];
  const failures: string[] = [];

  console.log(`Searching cédulas per persona (max 30,000 attempts each)...\n`);

  for (const persona of PERSONAS) {
    const match = findCedula(persona);
    if (match) {
      results.push(match);
      const mark = match.exactMatch ? "✓" : "~";
      console.log(
        `${mark} ${persona.nombre.padEnd(9)} ${match.cedula.padEnd(13)} ` +
          `L${match.level} cat=${match.category} score=${match.score} ` +
          `ratio=${match.ratio.toFixed(2)}${match.hasHighDebtRatio ? "↑" : ""} ` +
          `${PROVINCES[persona.province]}`,
      );
    } else {
      failures.push(persona.nombre);
      console.log(`✗ ${persona.nombre} — no match in 30,000 attempts`);
    }
  }

  // Final table
  console.log(`\n=== Canonical set (15 personas) ===\n`);
  for (const level of [1, 2, 3] as const) {
    console.log(`--- Level ${level} ---`);
    console.table(
      results
        .filter((r) => r.level === level)
        .map((r) => ({
          nombre: r.nombre,
          cedula: r.cedula,
          province: PROVINCES[r.province],
          income: r.income.toLocaleString("es-CR"),
          debt: r.debt.toLocaleString("es-CR"),
          ratio: r.ratio.toFixed(2),
          category: r.category,
          score: r.score,
          default: r.hasSevereActiveDefault ? "yes" : "no",
          shopping: r.isCreditShopping ? "yes" : "no",
          story: r.story,
        })),
    );
  }

  console.log(`\n=== JSON for src/data/casos-prueba-buro.json ===\n`);
  console.log(JSON.stringify(results, null, 2));

  if (failures.length) {
    console.warn(`\n⚠ Failures: ${failures.join(", ")}`);
  }
}

main();
