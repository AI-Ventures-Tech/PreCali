// Lead scoring engine based on the credit bureau mock (Equifax/SUGEF ICIC).
// Rule precedence is fixed by business — see plan subtask S3. Do not reinterpret the order.

import type {
  BuroMockResponse,
  EngineConfig,
  EngineResult,
} from "@/types/buro";
import type { Profile } from "@/lib/whatsapp/types";

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  scorePrimeThreshold: 700,
  debtToIncomeAlertThreshold: 0.5,
  debtToIncomePrequalifiedThreshold: 0.45,
  activeDefaultDaysLimit: 90,
  shoppingInquiriesThreshold: 5,
};

const HIGH_RISK_CATEGORIES = new Set(["B2", "C1", "C2", "D", "E"]);

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

export function scoreLead(
  buro: BuroMockResponse,
  profile: Pick<Profile, "income" | "debt">,
  config?: Partial<EngineConfig>,
): EngineResult {
  const cfg = mergeConfig(config);

  const debtToIncomeRatio = profile.debt / Math.max(1, profile.income);
  const hasHighDebtRatio = debtToIncomeRatio > cfg.debtToIncomeAlertThreshold;
  const isCreditShopping =
    buro.inquiriesLast30Days > cfg.shoppingInquiriesThreshold;

  const hasSevereActiveDefault = buro.operations.some(
    (op) => op.daysPastDue > cfg.activeDefaultDaysLimit,
  );

  let level: EngineResult["level"];
  let reason: string;

  if (hasSevereActiveDefault) {
    // Rule 1: hard override — trumps category and score.
    level = 1;
    reason = "active default > 90 days";
  } else if (HIGH_RISK_CATEGORIES.has(buro.sugefCategory)) {
    // Rule 2: B2 counts as Level 1 (high risk), not Level 2.
    level = 1;
    reason = "SUGEF category B2/C1-E";
  } else if (
    buro.score >= cfg.scorePrimeThreshold &&
    debtToIncomeRatio <= cfg.debtToIncomePrequalifiedThreshold
  ) {
    // Rule 3: category A1/A2/B1 with score and ratio inside thresholds.
    level = 3;
    reason = "prime category, score and ratio within thresholds";
  } else {
    // Rule 4: good category but score or ratio insufficient.
    level = 2;
    reason = "good category but score/ratio insufficient";
  }

  // Rule 5 (cap): ratio above alert never allows Level 3.
  if (hasHighDebtRatio && level === 3) {
    level = 2;
  }

  return {
    level,
    sugefCategory: buro.sugefCategory,
    score: buro.score,
    debtToIncomeRatio,
    hasSevereActiveDefault,
    isCreditShopping,
    hasHighDebtRatio,
    reason,
  };
}
