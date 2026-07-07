/*
Campo nuestro	Equifax probable
idNumber	consumers.document[0].number
score	consumers.creditReport[0].models[0].score
sugefCategory	CR-specific
operations[]	consumers.creditReport[0].trades[]
inquiriesLast30Days	consumers.creditReport[0].inquiries[] filtrado
commercialProtests	publicRecords[]
status	top-level status
hitCode	consumers.creditReport[0].hitCode
links[]	top-level links[]
*/

// Domain types for the credit bureau mock + scoring engine (Equifax/SUGEF ICIC).
// See plans/2026-07-02-motor-calificador-buro-mock/plan.md for business context.
//
// Naming: identifiers (types, fields, functions) are English; string ENUM VALUES
// ("hipotecario" | "prendario" | "personal" | "tarjeta") stay Spanish because they
// are domain data tied to the Costa Rican financial system, not code.


export type SugefCategory = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "D" | "E";

/** 1 = good, 2 = acceptable, 3 = poor. */
export type HistoricalPaymentBehavior = 1 | 2 | 3;

export interface CreditOperation {
  type: "hipotecario" | "prendario" | "personal" | "tarjeta";
  institution: string;
  amountOwed: number;
  daysPastDue: number;
  closed: boolean;
}

export interface BuroMockResponse {
  idNumber: string;
  score: number;
  sugefCategory: SugefCategory;
  historicalPaymentBehavior: HistoricalPaymentBehavior;
  operations: CreditOperation[];
  totalAmountOwed: number;
  inquiriesLast30Days: number;
  commercialProtests: number;
  historyMonths: 48;
  inquiryDate: string;
  status: BuroReportStatus;
  hitCode: { code: string };
  links: BuroReportLink[];
}

export type BuroReportStatus = "completed" | "pending" | "error";

export interface BuroReportLink {
  identifier: string;
  type: "GET" | "POST";
  href: string;
}

export type RiskLevel = 1 | 2 | 3;

export interface EngineConfig {
  scorePrimeThreshold: number;
  debtToIncomeAlertThreshold: number;
  debtToIncomePrequalifiedThreshold: number;
  activeDefaultDaysLimit: number;
  shoppingInquiriesThreshold: number;
}

export interface EngineResult {
  level: RiskLevel;
  sugefCategory: SugefCategory;
  score: number;
  debtToIncomeRatio: number;
  hasSevereActiveDefault: boolean;
  isCreditShopping: boolean;
  hasHighDebtRatio: boolean;
  reason: string;
}
