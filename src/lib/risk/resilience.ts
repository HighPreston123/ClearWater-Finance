/**
 * Future Resilience Score — Methodology v1 (team document dated 2026-10-11, @connor).
 * Pure: five weighted pillars (0–100), capped by survival gates, with a confidence
 * label and a low/high range. Unknown inputs are never treated as zero: an unknown
 * sub-metric is dropped and its weight re-spread inside its pillar; a pillar with no
 * inputs is "not scored"; under 60% scored weight → insufficient data (no number).
 *
 * Team decisions applied: weights 25/20/15/25/15; essentials = active recurring
 * series + minimum debt payments (survey band midpoint as fallback); undated goals
 * use current balance ÷ target; goals draw on cash only (cash above the emergency target).
 */
import type { FinancialSnapshot } from "@/types/risk";
import type { PortfolioRiskResult } from "@/lib/risk/portfolioRisk";
import type { MonteCarloResult } from "@/lib/risk/monteCarlo";
import type { TargetProfile, SurveyAnswers } from "@/lib/risk/survey";
import { bandValue } from "@/lib/risk/survey";

export const RESILIENCE_VERSION = "resilience-v1";

/** Pillar weights — one config table so the team can tune without touching formulas. */
export const PILLAR_WEIGHTS = { liquidity: 0.25, cashflow: 0.2, debt: 0.15, goals: 0.25, portfolio: 0.15 } as const;
export type PillarId = keyof typeof PILLAR_WEIGHTS;
const PILLAR_LABELS: Record<PillarId, string> = {
  liquidity: "Liquidity and runway",
  cashflow: "Cash flow and income stability",
  debt: "Debt burden",
  goals: "Goal and retirement progress",
  portfolio: "Portfolio resilience",
};

/** Piecewise-linear curve through [x, points] anchors (x ascending), clamped to 0–100. */
export function curve(x: number, anchors: [number, number][]): number {
  const first = anchors[0]!, last = anchors[anchors.length - 1]!;
  if (x <= first[0]) return clamp(first[1]);
  if (x >= last[0]) return clamp(last[1]);
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1]!, [x1, y1] = anchors[i]!;
    if (x <= x1) return clamp(y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
  }
  return clamp(last[1]);
}
const clamp = (v: number) => Math.max(0, Math.min(100, v));

export const CURVES = {
  runway: [[0, 0], [1, 25], [3, 60], [6, 90], [9, 100]] as [number, number][],
  savingsRate: [[0, 0], [0.1, 60], [0.2, 90], [0.3, 100]] as [number, number][],
  incomeCV: [[0.1, 100], [0.5, 0]] as [number, number][],
  deficit: [[0, 100], [0.5, 0]] as [number, number][],
  commitment: [[0.4, 100], [0.8, 0]] as [number, number][],
  debtToAssets: [[0.25, 100], [1, 50], [3, 0]] as [number, number][],
  dsr: [[0.1, 100], [0.2, 70], [0.36, 30], [0.5, 0]] as [number, number][],
  rate: [[4, 100], [8, 60], [15, 0]] as [number, number][],
  stress: [[0.5, 100], [1, 50], [1.5, 0]] as [number, number][],
  hhi: [[0.05, 100], [0.15, 60], [0.25, 0]] as [number, number][],
  largest: [[0.15, 100], [0.25, 70], [0.4, 0]] as [number, number][],
};

export type Basis = "data" | "approximate" | "unknown";
export interface SubMetric { id: string; label: string; weight: number; points: number | null; basis: Basis; value: string }
export interface PillarResult {
  id: PillarId; label: string; weight: number; effectiveWeight: number;
  score: number | null; points: number | null; pointsLost: number | null; subMetrics: SubMetric[]; notes: string[];
}
export interface GateResult { id: "G1" | "G2" | "G3" | "G4"; label: string; cap: number; reason: string }
export type Confidence = "High" | "Medium" | "Low";
export interface ResilienceResult {
  status: "ready" | "insufficient_data";
  version: string;
  score: number | null;
  raw: number | null;
  range: { low: number; high: number } | null;
  band: string | null;
  confidence: Confidence;
  coverage: number;
  scoredWeight: number;
  gate: GateResult | null;
  pillars: PillarResult[];
  flags: string[];
  assumptions: string[];
  unknowns: string[];
  metrics: Record<string, number | null>;
}

export interface ResilienceInputs {
  snapshot: FinancialSnapshot;
  portfolioRisk?: PortfolioRiskResult | null | undefined;
  monteCarlo?: MonteCarloResult | null | undefined;
  /** True when the simulation ran with contributions or retirement income left unknown. */
  monteCarloProvisional?: boolean | undefined;
  targetProfile?: TargetProfile | null | undefined;
  surveyAnswers?: SurveyAnswers | null | undefined;
  now?: Date | undefined;
}

/** Optional overrides used by scenarios and action ranking. */
export interface Adjust { liquidDeltaCents?: number; incomeZeroMonths?: number; investmentsFactor?: number; largestHoldingCap?: number; emergencyFill?: boolean }

const dollars = (c: number) => `$${Math.round(c / 100).toLocaleString("en-US")}`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function pillarScore(subs: SubMetric[], fill: number | null): { score: number | null; known: number } {
  let w = 0, s = 0, known = 0;
  for (const m of subs) {
    const p = m.points ?? fill;
    if (p === null) continue;
    w += m.weight; s += m.weight * p;
    if (m.points !== null) known += m.weight;
  }
  return { score: w > 0 ? s / w : null, known };
}

export function bandFor(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Stable";
  if (score >= 40) return "Vulnerable";
  return "At risk";
}

export function computeResilience(input: ResilienceInputs, adj: Adjust = {}): ResilienceResult {
  const { snapshot: snap } = input;
  const now = input.now ?? new Date(snap.generatedAt);
  const m = snap.manual;
  const flags: string[] = [];
  const assumptions: string[] = [`Methodology ${RESILIENCE_VERSION}; curve anchors as published in the methodology document.`];
  const unknowns: string[] = [];
  const metrics: Record<string, number | null> = {};

  const stale = m.updatedAt ? now.getTime() - Date.parse(m.updatedAt) > 90 * 86_400_000 : false;
  if (stale) flags.push("Manual inputs are older than 90 days (stale).");

  // ---------- shared quantities ----------
  const linkedFund = m.cashReserves.filter((r) => r.linkedAccountId === null && r.amountCents !== null);
  let fund = m.emergencyFundCents;
  if (adj.emergencyFill && m.emergencyFundTargetCents !== null) fund = Math.max(fund ?? 0, m.emergencyFundTargetCents);
  const reserves = linkedFund.reduce((a, r) => a + (r.amountCents ?? 0), 0);
  const hasLiquid = fund !== null || linkedFund.length > 0;
  const liquid = hasLiquid ? Math.max(0, (fund ?? 0) + reserves + (adj.liquidDeltaCents ?? 0)) : null;

  const investmentsCents = (Number(snap.investments.totalValueMicros) / 1e4) * (adj.investmentsFactor ?? 1);

  const recurringMonthly = snap.recurring.filter((r) => r.detection !== "not_recurring").reduce((a, r) => a + r.monthlyEquivalentCents, 0);
  const debtPayments = m.debts.map((d) => d.minPaymentCents);
  const knownPayments = debtPayments.every((p) => p !== null);
  const debtPay = m.debts.reduce((a, d) => a + (d.minPaymentCents ?? 0), 0);
  let essential: number | null = null;
  let essentialBasis: Basis = "data";
  if (snap.recurring.length > 0) {
    essential = recurringMonthly + debtPay;
    assumptions.push(`Essential monthly spending = ${snap.recurring.length} detected recurring series + minimum debt payments = ${dollars(recurringMonthly + debtPay)}${knownPayments ? "" : " (some debt payments unknown)"}.`);
  } else {
    const band = bandValue("s06_essential_expenses", input.surveyAnswers?.["s06_essential_expenses"]);
    if (band !== null) {
      essential = band * 100;
      essentialBasis = "approximate";
      assumptions.push(`Essential monthly spending approximated by the survey band midpoint (${dollars(essential)}).`);
    }
  }
  metrics["essentialMonthlyCents"] = essential;

  const months = snap.cashFlow.months.filter((x) => x.transactionCount > 0).map((x, i, arr) =>
    adj.incomeZeroMonths && i >= arr.length - adj.incomeZeroMonths ? { ...x, income: 0, net: -x.spending } : x);
  const n = months.length;

  // ---------- Pillar 1: liquidity ----------
  const p1: SubMetric[] = [];
  const R = liquid !== null && essential !== null && essential > 0 ? liquid / 100 / (essential / 100) : null;
  metrics["runwayMonths"] = R;
  p1.push({ id: "runway", label: "Runway (months of essentials)", weight: 0.7, points: R === null ? null : curve(R, CURVES.runway),
    basis: R === null ? "unknown" : essentialBasis === "approximate" ? "approximate" : "data", value: R === null ? "Unknown" : `${R.toFixed(1)} months` });
  const F = fund !== null && m.emergencyFundTargetCents ? fund / m.emergencyFundTargetCents : null;
  metrics["emergencyFill"] = F;
  p1.push({ id: "fill", label: "Emergency fund vs target", weight: 0.3, points: F === null ? null : Math.min(F, 1) * 100, basis: F === null ? "unknown" : "data", value: F === null ? "Unknown" : pct(F) });

  // ---------- Pillar 2: cash flow ----------
  const p2: SubMetric[] = [];
  const inc = months.reduce((a, x) => a + x.income, 0), sp = months.reduce((a, x) => a + x.spending, 0);
  const s = n && inc > 0 ? (inc - sp) / inc : null;
  const incomes = months.map((x) => x.income);
  const mu = n ? inc / n : 0;
  const cv = n >= 2 && mu > 0 ? Math.sqrt(incomes.reduce((a, v) => a + (v - mu) ** 2, 0) / (n - 1)) / mu : null;
  const d = n ? months.filter((x) => x.net < 0).length / n : null;
  const c = mu > 0 && snap.recurring.length ? recurringMonthly / mu : null;
  Object.assign(metrics, { savingsRate: s, incomeCV: cv, deficitFrequency: d, commitmentRatio: c, monthsObserved: n });
  p2.push({ id: "savingsRate", label: "Savings rate", weight: 0.35, points: s === null ? null : curve(s, CURVES.savingsRate), basis: s === null ? "unknown" : "data", value: s === null ? "Unknown" : pct(s) });
  p2.push({ id: "incomeCV", label: "Income variability", weight: 0.25, points: cv === null ? null : curve(cv, CURVES.incomeCV), basis: cv === null ? "unknown" : "data", value: cv === null ? "Unknown" : cv.toFixed(2) });
  p2.push({ id: "deficit", label: "Deficit frequency", weight: 0.25, points: d === null ? null : curve(d, CURVES.deficit), basis: d === null ? "unknown" : "data", value: d === null ? "Unknown" : `${months.filter((x) => x.net < 0).length} of ${n} months` });
  p2.push({ id: "commitment", label: "Recurring commitments vs income", weight: 0.15, points: c === null ? null : curve(c, CURVES.commitment), basis: c === null ? "unknown" : "data", value: c === null ? "Unknown" : pct(c) });
  const shrink = n > 0 && n < 6 ? n / 6 : 1;
  if (n > 0 && n < 6) flags.push(`Only ${n} month(s) of income history — cash-flow score shrunk toward 50.`);

  // ---------- Pillar 3: debt ----------
  const p3: SubMetric[] = [];
  const debtsKnown = m.debts.filter((x) => x.balanceCents !== null);
  const totalDebt = debtsKnown.reduce((a, x) => a + (x.balanceCents ?? 0), 0);
  const assets = (liquid ?? 0) + investmentsCents;
  let debtAll100 = false;
  if (m.debtsConfirmedNone && m.debts.length === 0) debtAll100 = true;
  const D = debtAll100 ? 0 : debtsKnown.length && assets > 0 ? totalDebt / assets : null;
  const rated = m.debts.filter((x) => x.balanceCents !== null && x.aprPercent !== null);
  const rw = rated.reduce((a, x) => a + x.balanceCents!, 0);
  const r = debtAll100 ? 0 : rw > 0 ? rated.reduce((a, x) => a + x.balanceCents! * x.aprPercent!, 0) / rw : null;
  const DSR = debtAll100 ? 0 : m.debts.length && knownPayments && mu > 0 ? debtPay / mu : null;
  Object.assign(metrics, { debtToAssets: D, weightedRate: r, debtServiceRatio: DSR });
  p3.push({ id: "D", label: "Debt to cash + investments", weight: 0.45, points: debtAll100 ? 100 : D === null ? null : curve(D, CURVES.debtToAssets), basis: D === null ? "unknown" : "data", value: debtAll100 ? "No debt (confirmed)" : D === null ? "Unknown" : `${D.toFixed(2)} (${dollars(totalDebt)} vs ${dollars(assets)})` });
  p3.push({ id: "DSR", label: "Debt payments vs income", weight: 0.3, points: debtAll100 ? 100 : DSR === null ? null : curve(DSR, CURVES.dsr), basis: DSR === null ? "unknown" : "data", value: debtAll100 ? "No debt" : DSR === null ? "Unknown" : pct(DSR) });
  p3.push({ id: "rate", label: "Weighted interest rate", weight: 0.25, points: debtAll100 ? 100 : r === null ? null : curve(r, CURVES.rate), basis: r === null ? "unknown" : "data", value: debtAll100 ? "No debt" : r === null ? "Unknown" : `${r.toFixed(1)}%` });

  // ---------- Pillar 4: goals and retirement ----------
  const p4: SubMetric[] = [];
  const mc = input.monteCarlo;
  const pSucc = mc ? 1 - mc.depletionProbability : null;
  const e = mc ? mc.essentialCoverageProbability : null;
  metrics["retirementSuccess"] = pSucc; metrics["essentialsCoverage"] = e;
  if (mc && input.monteCarloProvisional) flags.push("Retirement simulation is provisional: contributions or dependable retirement income were left unknown.");
  p4.push({ id: "retirement", label: "Retirement simulation", weight: 0.5, points: pSucc === null || e === null ? null : 100 * (0.6 * pSucc + 0.4 * e),
    basis: mc ? (input.monteCarloProvisional ? "approximate" : "data") : "unknown", value: mc ? `success ${pct(pSucc!)}, essentials ${pct(e!)}` : "Not run" });
  const freeCash = liquid !== null ? Math.max(0, liquid - (m.emergencyFundTargetCents ?? 0)) : null;
  const goals = m.goals.filter((g) => g.amountCents !== null && g.amountCents > 0);
  let g: number | null = null;
  if (goals.length && freeCash !== null) {
    const monthlySave = n ? Math.max(0, (inc - sp) / n) : 0;
    let tw = 0, acc = 0;
    for (const goal of goals) {
      const months2 = goal.targetDate ? Math.max(0, (Date.parse(goal.targetDate) - now.getTime()) / (30.44 * 86_400_000)) : 0;
      const projected = freeCash + (goal.targetDate ? monthlySave * months2 : 0);
      acc += goal.amountCents! * Math.min(projected / goal.amountCents!, 1); tw += goal.amountCents!;
    }
    g = acc / tw;
    assumptions.push("Goals draw on cash above the emergency-fund target only; undated goals use current balance ÷ target.");
  }
  metrics["goalOnTrack"] = g;
  p4.push({ id: "goals", label: "Savings goals on track", weight: 0.3, points: g === null ? null : 100 * Math.min(g, 1), basis: g === null ? "unknown" : "data", value: g === null ? (goals.length ? "Unknown (cash unknown)" : "No goals entered") : pct(g) });
  const due = m.obligations.filter((o) => o.amountCents !== null && (!o.dueDate || Date.parse(o.dueDate) - now.getTime() <= 365 * 86_400_000));
  const dueTotal = due.reduce((a, o) => a + o.amountCents!, 0);
  const o = dueTotal === 0 ? 1 : freeCash === null ? null : freeCash / dueTotal;
  metrics["obligationCover"] = o;
  p4.push({ id: "obligations", label: "Obligations due in 12 months", weight: 0.2, points: o === null ? null : 100 * Math.min(o, 1), basis: o === null ? "unknown" : "data", value: dueTotal === 0 ? "None due" : o === null ? "Unknown" : pct(o) });
  if (goals.length === 0) p4[1]!.weight = 0; // no goals → nothing to measure, not unknown

  // ---------- Pillar 5: portfolio ----------
  const p5: SubMetric[] = [];
  const pr = input.portfolioRisk?.status === "ready" ? input.portfolioRisk : null;
  const tp = input.targetProfile;
  const vol = pr?.annualVolatility ?? null, mdd = pr?.maxDrawdown ?? null;
  const shockDrop = adj.investmentsFactor !== undefined ? 1 - adj.investmentsFactor : 0;
  const stressLoss = vol !== null || mdd !== null ? Math.max(Math.abs(mdd ?? 0), 2 * (vol ?? 0), shockDrop) : null;
  let L = tp?.maxTolerableLoss ?? null;
  if (L !== null && tp?.liquidityNeed === "high") L = L / 2;
  const stress = stressLoss !== null && L !== null && L > 0 ? stressLoss / L : stressLoss !== null && L === 0 ? 10 : null;
  const hhi = pr?.concentration.hhi ?? null;
  const largest = pr ? Math.min(pr.concentration.largestWeight, adj.largestHoldingCap ?? 1) : null;
  Object.assign(metrics, { stressLoss, lossTolerance: L, stressRatio: stress, hhi, largestHolding: largest });
  p5.push({ id: "stress", label: "Stress loss vs tolerance", weight: 0.45, points: stress === null ? null : curve(stress, CURVES.stress), basis: stress === null ? "unknown" : "data", value: stress === null ? "Unknown" : `${pct(stressLoss!)} vs ${pct(L!)} (ratio ${stress.toFixed(2)})` });
  p5.push({ id: "hhi", label: "Concentration (HHI)", weight: 0.3, points: hhi === null ? null : curve(hhi, CURVES.hhi), basis: hhi === null ? "unknown" : "data", value: hhi === null ? "Unknown" : hhi.toFixed(3) });
  p5.push({ id: "largest", label: "Largest holding", weight: 0.25, points: largest === null ? null : curve(largest, CURVES.largest), basis: largest === null ? "unknown" : "data", value: largest === null ? "Unknown" : pct(largest) });
  const noPortfolio = snap.investments.holdings.length === 0;

  // ---------- assemble ----------
  const all: Record<PillarId, SubMetric[]> = { liquidity: p1, cashflow: p2, debt: p3, goals: p4, portfolio: noPortfolio ? [] : p5 };
  const evalWith = (fill: number | null) => {
    const res: { id: PillarId; score: number | null }[] = [];
    for (const id of Object.keys(all) as PillarId[]) {
      let { score } = pillarScore(all[id], fill);
      if (id === "cashflow" && score !== null && shrink < 1) score = shrink * score + (1 - shrink) * 50;
      res.push({ id, score });
    }
    return res;
  };
  const point = evalWith(null);
  const scoredW = point.reduce((a, p) => a + (p.score !== null ? PILLAR_WEIGHTS[p.id] : 0), 0);
  const combine = (ps: { id: PillarId; score: number | null }[]) => {
    const w = ps.reduce((a, p) => a + (p.score !== null ? PILLAR_WEIGHTS[p.id] : 0), 0);
    return w > 0 ? ps.reduce((a, p) => a + (p.score !== null ? PILLAR_WEIGHTS[p.id] * p.score : 0), 0) / w : null;
  };

  // gates (known data only)
  const gates: GateResult[] = [];
  if (R !== null) { if (R < 1) gates.push({ id: "G1", label: "Runway", cap: 40, reason: `Runway ${R.toFixed(1)} < 1 month` }); else if (R < 3) gates.push({ id: "G1", label: "Runway", cap: 70, reason: `Runway ${R.toFixed(1)} < 3 months` }); }
  if (pSucc !== null) { if (pSucc < 0.5) gates.push({ id: "G2", label: "Retirement failure", cap: 55, reason: `Success ${pct(pSucc)} < 50%` }); else if (pSucc < 0.75) gates.push({ id: "G2", label: "Retirement failure", cap: 75, reason: `Success ${pct(pSucc)} < 75%` }); }
  if (d !== null && n >= 4 && d >= 0.5) gates.push({ id: "G3", label: "Persistent deficit", cap: 60, reason: `Deficits in ${pct(d)} of ${n} months` });
  if (DSR !== null && DSR >= 0.5) gates.push({ id: "G4", label: "Debt service", cap: 50, reason: `Debt payments ${pct(DSR)} of income` });
  const gate = gates.length ? gates.reduce((a, b) => (b.cap < a.cap ? b : a)) : null;
  const capOf = (v: number) => Math.min(v, gate?.cap ?? 100);

  // coverage & confidence
  let tot = 0, cov = 0;
  for (const id of Object.keys(all) as PillarId[]) for (const sm of all[id]) {
    const w = PILLAR_WEIGHTS[id] * sm.weight; tot += w;
    if (sm.points !== null) cov += w; else unknowns.push(`${PILLAR_LABELS[id]}: ${sm.label}`);
  }
  if (noPortfolio) unknowns.push("Portfolio resilience: no holdings (pillar not scored)");
  const C = tot > 0 ? cov / tot : 0;
  let level = C >= 0.85 ? 2 : C >= 0.6 ? 1 : 0;
  if (stale) level--;
  if (n > 0 && n < 6) level--;
  const confidence: Confidence = level >= 2 ? "High" : level === 1 ? "Medium" : "Low";

  const pillars: PillarResult[] = point.map((p) => {
    const ew = scoredW > 0 && p.score !== null ? PILLAR_WEIGHTS[p.id] / scoredW : 0;
    return {
      id: p.id, label: PILLAR_LABELS[p.id], weight: PILLAR_WEIGHTS[p.id], effectiveWeight: ew,
      score: p.score === null ? null : round1(p.score),
      points: p.score === null ? null : round1(ew * p.score),
      pointsLost: p.score === null ? null : round1(ew * (100 - p.score)),
      subMetrics: all[p.id], notes: [],
    };
  });

  if (scoredW < 0.6) {
    return { status: "insufficient_data", version: RESILIENCE_VERSION, score: null, raw: null, range: null, band: null, confidence, coverage: C, scoredWeight: scoredW, gate: null, pillars, flags, assumptions, unknowns, metrics };
  }
  const raw = combine(point)!;
  const lo = capOf(combine(evalWith(25))!), hi = capOf(combine(evalWith(90))!);
  const score = Math.round(capOf(raw));
  return {
    status: "ready", version: RESILIENCE_VERSION, score, raw: round1(raw),
    range: { low: Math.min(Math.round(lo), score), high: Math.max(Math.round(hi), score) },
    band: bandFor(score), confidence, coverage: C, scoredWeight: scoredW, gate, pillars, flags, assumptions, unknowns, metrics,
  };
}
const round1 = (v: number) => Math.round(v * 10) / 10;

export interface ScenarioOutcome { id: string; label: string; score: number | null; delta: number | null }
export interface ActionOutcome { id: string; label: string; gain: number }

export function resilienceScenarios(input: ResilienceInputs, base: ResilienceResult): ScenarioOutcome[] {
  const ess = base.metrics["essentialMonthlyCents"] ?? null;
  const run = (id: string, label: string, adj: Adjust | null): ScenarioOutcome => {
    if (!adj) return { id, label, score: null, delta: null };
    const r = computeResilience(input, adj);
    return { id, label, score: r.score, delta: r.score !== null && base.score !== null ? r.score - base.score : null };
  };
  return [
    run("no_income", "6 months with no income", ess !== null ? { liquidDeltaCents: -6 * ess, incomeZeroMonths: 6 } : null),
    run("market_drop", "30% market drop", { investmentsFactor: 0.7 }),
    run("expense", "Unplanned expense of 3 months of essentials", ess !== null ? { liquidDeltaCents: -3 * ess } : null),
  ];
}

export function resilienceActions(input: ResilienceInputs, base: ResilienceResult): ActionOutcome[] {
  if (base.score === null) return [];
  const out: ActionOutcome[] = [];
  const R = base.metrics["runwayMonths"] ?? null, ess = base.metrics["essentialMonthlyCents"] ?? null;
  if (R !== null && ess !== null) {
    const next = [1, 3, 6, 9].find((a) => a > R + 1e-9);
    if (next) {
      const need = (next - R) * ess;
      const r = computeResilience(input, { liquidDeltaCents: need });
      out.push({ id: "runway", label: `Add ${dollars(need)} to cash reserves to reach ${next} months of runway`, gain: (r.score ?? 0) - base.score });
    }
  }
  if ((base.metrics["emergencyFill"] ?? 1) < 1) {
    const r = computeResilience(input, { emergencyFill: true });
    out.push({ id: "fund", label: "Fill the emergency fund to its target", gain: (r.score ?? 0) - base.score });
  }
  const lg = base.metrics["largestHolding"] ?? null;
  if (lg !== null && lg > 0.15) {
    const r = computeResilience(input, { largestHoldingCap: 0.15 });
    out.push({ id: "largest", label: "Trim your largest holding to 15% of the portfolio", gain: (r.score ?? 0) - base.score });
  }
  return out.filter((a) => a.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 3);
}
