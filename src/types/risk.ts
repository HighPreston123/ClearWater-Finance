import type { CashFlowSummary, MonthSummary, RecurringSeries } from "./finance";
import type { InvestmentAccount, Holding } from "./investments";

/** null always means "unknown" — never treat it as zero. */
export interface CashReserve {
  id: string;
  label: string;
  amountCents: number | null;
  /** Link to a tracked account (e.g. an investment account's cash) to avoid double counting. */
  linkedAccountId: string | null;
}
export interface DebtItem {
  id: string;
  name: string;
  balanceCents: number | null;
  aprPercent: number | null;
  minPaymentCents: number | null;
}
export interface UpcomingObligation {
  id: string;
  label: string;
  amountCents: number | null;
  dueDate: string | null;
}
export interface SavingsGoal {
  id: string;
  label: string;
  amountCents: number | null;
  targetDate: string | null;
}
export type RiskComfort = "unknown" | "conservative" | "moderate" | "growth";

/** Shared manual inputs (also used by the Savings planner). */
export interface ManualFinancialInputs {
  emergencyFundCents: number | null;
  emergencyFundTargetCents: number | null;
  cashReserves: CashReserve[];
  /** null = user hasn't said; [] with debtsConfirmedNone=true = user confirmed no debt. */
  debts: DebtItem[];
  debtsConfirmedNone: boolean;
  obligations: UpcomingObligation[];
  goals: SavingsGoal[];
  timeHorizonYears: number | null;
  riskComfort: RiskComfort;
  updatedAt: string | null;
}

export type InputAvailability = "available" | "missing" | "manual" | "stale";

export interface InputCoverageItem {
  id: string;
  category: string;
  availability: InputAvailability;
  detail: string;
}

export interface FinancialSnapshot {
  generatedAt: string;
  cashFlow: { selectedRange: CashFlowSummary; months: MonthSummary[] };
  recurring: RecurringSeries[];
  manual: ManualFinancialInputs;
  investments: { accounts: InvestmentAccount[]; holdings: Holding[]; totalValueMicros: string; partial: boolean };
  /** Historical market data, when supplied later. */
  marketHistory: null;
  coverage: InputCoverageItem[];
}

export type RiskEngineStatus = "not_implemented" | "insufficient_data" | "ready" | "error";

/** Intentionally open: scale, direction and categories are defined by the methodology owner. */
export interface RiskCategoryContribution {
  categoryId: string;
  label: string;
  contribution: unknown;
  evidence: string[];
}

export interface RiskAssessment {
  status: RiskEngineStatus;
  methodologyVersion: string | null;
  inputTimestamp: string;
  dataCoverage: InputCoverageItem[];
  message: string;
  overall: { value: unknown; label: string; scaleDescription: string } | null;
  categories: RiskCategoryContribution[];
  assumptions: string[];
  limitations: string[];
  scenarios: { id: string; label: string; result: unknown }[];
  potentialActions: string[];
}

export interface RiskEngine {
  readonly methodologyVersion: string | null;
  assess(snapshot: FinancialSnapshot): RiskAssessment;
}

export type WellnessComposition =
  | { status: "not_available"; message: string; reason: string }
  | { status: "ok"; value: unknown; label: string; methodologyVersion: string };
