/**
 * Pure extraction of fundamental indicators from SEC EDGAR companyfacts (XBRL) JSON.
 * Every metric is null ("not meaningful") when its inputs are missing, have zero/negative
 * denominators, or are incomparable — never a manufactured number.
 */

export interface FactPoint { end: string; fy?: number; fp?: string; form?: string; val: number }
interface CompanyFacts { entityName?: string; facts?: Record<string, Record<string, { units?: Record<string, FactPoint[]> }>> }

/** Latest annual (10-K, ~1-year duration) value for a us-gaap tag, plus the prior year's. */
function annualPair(facts: CompanyFacts, tags: string[]): { latest: FactPoint | null; prior: FactPoint | null } {
  const gaap = facts.facts?.["us-gaap"] ?? {};
  for (const tag of tags) {
    const units = gaap[tag]?.units ?? {};
    const points = Object.values(units)
      .flat()
      .filter((p) => p.form === "10-K" && typeof p.val === "number")
      .sort((a, b) => a.end.localeCompare(b.end));
    // Deduplicate by period end, keeping the last filed value.
    const byEnd = new Map<string, FactPoint>();
    for (const p of points) byEnd.set(p.end, p);
    const series = [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end));
    if (series.length) return { latest: series[series.length - 1] ?? null, prior: series[series.length - 2] ?? null };
  }
  return { latest: null, prior: null };
}

function latest(facts: CompanyFacts, tags: string[]): FactPoint | null {
  return annualPair(facts, tags).latest;
}

const REVENUE = ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"];
const OPERATING_INCOME = ["OperatingIncomeLoss"];
const OPERATING_CF = ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"];
const CAPEX = ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets", "PaymentsForCapitalImprovements"];
const LONG_TERM_DEBT = ["LongTermDebt", "LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations"];
const CURRENT_DEBT = ["LongTermDebtCurrent", "ShortTermBorrowings", "DebtCurrent"];
const EQUITY = ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"];
const INTEREST_EXPENSE = ["InterestExpense", "InterestExpenseNonoperating", "InterestIncomeExpenseNet"];
const CURRENT_ASSETS = ["AssetsCurrent"];
const CURRENT_LIABILITIES = ["LiabilitiesCurrent"];

export interface FundamentalMetrics {
  companyName: string | null;
  periodEnd: string | null;
  revenue: number | null;
  revenueGrowth: number | null;
  operatingMargin: number | null;
  freeCashFlow: number | null;
  fcfMargin: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
  currentRatio: number | null;
  /** Tags that were missing or not meaningful, so the UI can explain gaps. */
  unavailable: string[];
}

export function extractFundamentals(facts: CompanyFacts): FundamentalMetrics {
  const unavailable: string[] = [];
  const revenue = annualPair(facts, REVENUE);
  const opIncome = latest(facts, OPERATING_INCOME);
  const opCf = latest(facts, OPERATING_CF);
  const capex = latest(facts, CAPEX);
  const ltd = latest(facts, LONG_TERM_DEBT);
  const cdebt = latest(facts, CURRENT_DEBT);
  const equity = latest(facts, EQUITY);
  const interest = latest(facts, INTEREST_EXPENSE);
  const curAssets = latest(facts, CURRENT_ASSETS);
  const curLiab = latest(facts, CURRENT_LIABILITIES);

  const rev = revenue.latest?.val ?? null;
  if (rev === null) unavailable.push("revenue");

  // Growth is meaningless when the prior year is missing or non-positive.
  let revenueGrowth: number | null = null;
  if (rev !== null && revenue.prior && revenue.prior.val > 0) {
    revenueGrowth = (rev - revenue.prior.val) / Math.abs(revenue.prior.val);
  } else unavailable.push("revenueGrowth");

  const operatingMargin = rev !== null && rev !== 0 && opIncome ? opIncome.val / rev : null;
  if (operatingMargin === null) unavailable.push("operatingMargin");

  const freeCashFlow = opCf && capex ? opCf.val - capex.val : null;
  if (freeCashFlow === null) unavailable.push("freeCashFlow");

  const fcfMargin = freeCashFlow !== null && rev !== null && rev !== 0 ? freeCashFlow / rev : null;
  if (fcfMargin === null) unavailable.push("fcfMargin");

  // Debt-to-equity is not meaningful with zero or negative equity.
  const totalDebt = (ltd?.val ?? 0) + (cdebt?.val ?? 0);
  const debtToEquity = equity && equity.val > 0 && (ltd || cdebt) ? totalDebt / equity.val : null;
  if (debtToEquity === null) unavailable.push("debtToEquity");

  const interestCoverage = opIncome && interest && interest.val > 0 ? opIncome.val / interest.val : null;
  if (interestCoverage === null) unavailable.push("interestCoverage");

  const currentRatio = curAssets && curLiab && curLiab.val > 0 ? curAssets.val / curLiab.val : null;
  if (currentRatio === null) unavailable.push("currentRatio");

  return {
    companyName: facts.entityName ?? null,
    periodEnd: revenue.latest?.end ?? opIncome?.end ?? null,
    revenue: rev,
    revenueGrowth,
    operatingMargin,
    freeCashFlow,
    fcfMargin,
    debtToEquity,
    interestCoverage,
    currentRatio,
    unavailable,
  };
}
