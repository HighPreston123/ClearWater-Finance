/**
 * Monte Carlo retirement sustainability simulation (pure, seeded, testable).
 *
 * Conventions (disclosed to the user):
 * - Annual steps; real (inflation-adjusted) dollars throughout, so no separate
 *   inflation growth is applied to expenses.
 * - Portfolio returns are sampled per year from a Student-t distribution with the
 *   given real mean and volatility (df configurable; lower df = fatter tails).
 *   Correlations between holdings are already embedded in the portfolio-level
 *   volatility supplied by the risk engine — holdings are not simulated independently.
 * - Contributions are made at the END of each accumulation year.
 * - Retirement withdrawal need = max(0, retirement spending - dependable income).
 *   If the balance cannot cover the need, the shortfall is recorded and the path
 *   counts as depleted — a clamped zero balance is never treated as success.
 * - A fixed seed makes runs reproducible for the same inputs.
 */

export interface MonteCarloInputs {
  currentAge: number;
  retirementAge: number;
  horizonAge: number;
  initialBalance: number;
  /** Real annual contribution during working years (end of year). */
  annualContribution: number;
  /** Real annual spending need in retirement. */
  annualRetirementSpending: number;
  /** Real annual dependable non-portfolio income in retirement. */
  annualDependableIncome: number;
  /** Expected real annual return (before fees). */
  meanReturn: number;
  /** Annual return volatility. */
  volatility: number;
  /** Annual fee drag applied to returns. */
  feeRate: number;
  /** Student-t degrees of freedom (fat tails); >= 30 ≈ normal. */
  df: number;
  paths: number;
  seed: number;
}

export interface ScenarioResult { id: string; label: string; depletionProbability: number; medianEndingBalance: number }

export interface MonteCarloResult {
  status: "ready";
  paths: number;
  years: number;
  depletionProbability: number;
  essentialCoverageProbability: number;
  medianEndingBalance: number;
  p10EndingBalance: number;
  p90EndingBalance: number;
  /** Median age at depletion among failed paths; null if none failed. */
  medianDepletionAge: number | null;
  /** Probability of reaching retirement age with a positive balance. */
  goalProbability: number;
  sensitivities: ScenarioResult[];
  scenarios: ScenarioResult[];
  assumptions: Record<string, number>;
}

/** mulberry32 — small seeded PRNG so identical inputs reproduce identical outputs. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller. */
function normal(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Student-t sample with the given degrees of freedom (normal / sqrt(chi2/df)). */
function studentT(rand: () => number, df: number): number {
  if (df >= 60) return normal(rand);
  let chi2 = 0;
  for (let i = 0; i < df; i++) { const z = normal(rand); chi2 += z * z; }
  return normal(rand) / Math.sqrt(chi2 / df);
}

interface PathOutcome { endingBalance: number; depleted: boolean; depletionAge: number | null; essentialGap: boolean }

function runPath(inputs: MonteCarloInputs, rand: () => number, overrides: Partial<MonteCarloInputs> = {}, shock?: { earlyBadYears?: number; earlyBadReturn?: number; nearRetirementDrawdown?: number; oneTimeExpense?: number; oneTimeExpenseAge?: number }): PathOutcome {
  const p = { ...inputs, ...overrides };
  let balance = p.initialBalance;
  let depleted = false;
  let depletionAge: number | null = null;
  let essentialGap = false;
  const scale = p.volatility / Math.sqrt(p.df > 2 ? p.df / (p.df - 2) : 1); // keep target volatility with fat tails

  for (let age = p.currentAge; age < p.horizonAge; age++) {
    const retired = age >= p.retirementAge;
    const yearsIntoRetirement = age - p.retirementAge;
    let r = p.meanReturn - p.feeRate + scale * studentT(rand, p.df);
    if (shock?.earlyBadYears && retired && yearsIntoRetirement < shock.earlyBadYears) r = shock.earlyBadReturn ?? -0.1;
    balance *= 1 + r;
    if (!retired && shock?.nearRetirementDrawdown && age === p.retirementAge - 1) balance *= 1 - shock.nearRetirementDrawdown;
    if (shock?.oneTimeExpense && shock.oneTimeExpenseAge === age) balance -= shock.oneTimeExpense;
    if (balance < 0) balance = 0; // a wiped-out balance is zero, not negative, before any withdrawal check

    if (!retired) {
      balance += p.annualContribution; // end-of-year contribution
    } else {
      const need = Math.max(0, p.annualRetirementSpending - p.annualDependableIncome);
      if (balance >= need) {
        balance -= need;
      } else {
        essentialGap = true;
        if (!depleted) { depleted = true; depletionAge = age; }
        balance = 0;
      }
    }
  }
  return { endingBalance: balance, depleted, depletionAge, essentialGap };
}

const percentile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;

function summarize(inputs: MonteCarloInputs, overrides: Partial<MonteCarloInputs> = {}, shock?: Parameters<typeof runPath>[3]): { outcomes: PathOutcome[]; depletionProbability: number; essentialCoverageProbability: number; medianEndingBalance: number; p10: number; p90: number; medianDepletionAge: number | null; goalProbability: number } {
  const outcomes: PathOutcome[] = [];
  for (let i = 0; i < inputs.paths; i++) outcomes.push(runPath(inputs, rng(inputs.seed + i), overrides, shock));
  const endings = outcomes.map((o) => o.endingBalance).sort((a, b) => a - b);
  const depletions = outcomes.filter((o) => o.depleted);
  const depletionAges = depletions.map((o) => o.depletionAge!).sort((a, b) => a - b);
  return {
    outcomes,
    depletionProbability: depletions.length / inputs.paths,
    essentialCoverageProbability: 1 - outcomes.filter((o) => o.essentialGap).length / inputs.paths,
    medianEndingBalance: percentile(endings, 0.5),
    p10: percentile(endings, 0.1),
    p90: percentile(endings, 0.9),
    medianDepletionAge: depletionAges.length ? percentile(depletionAges, 0.5) : null,
    goalProbability: outcomes.filter((o) => o.endingBalance > 0 || !o.depleted).length / inputs.paths,
  };
}

/** Which required inputs are missing (null/undefined/invalid). */
export function missingMonteCarloInputs(inputs: Partial<Record<keyof MonteCarloInputs, number | null>>): string[] {
  const required: (keyof MonteCarloInputs)[] = ["currentAge", "retirementAge", "horizonAge", "initialBalance", "annualRetirementSpending"];
  return required.filter((k) => typeof inputs[k] !== "number" || !Number.isFinite(inputs[k] as number));
}

export function runMonteCarlo(inputs: MonteCarloInputs): MonteCarloResult {
  const base = summarize(inputs);
  const years = inputs.horizonAge - inputs.currentAge;

  const s = (id: string, label: string, overrides: Partial<MonteCarloInputs>, shock?: Parameters<typeof runPath>[3]): ScenarioResult => {
    const r = summarize({ ...inputs, ...overrides }, overrides, shock);
    return { id, label, depletionProbability: r.depletionProbability, medianEndingBalance: r.medianEndingBalance };
  };

  const sensitivities: ScenarioResult[] = [
    s("retire_later", "Retire 2 years later", { retirementAge: inputs.retirementAge + 2 }),
    s("save_more", "Contribute 20% more", { annualContribution: inputs.annualContribution * 1.2 }),
    s("spend_less", "Spend 10% less in retirement", { annualRetirementSpending: inputs.annualRetirementSpending * 0.9 }),
    s("more_volatile", "25% higher volatility", { volatility: inputs.volatility * 1.25 }),
  ];

  const scenarios: ScenarioResult[] = [
    s("early_bad_returns", "Poor returns in the first 5 retirement years", {}, { earlyBadYears: 5, earlyBadReturn: -0.1 }),
    s("low_long_run", "Long-run returns 2 points lower", { meanReturn: inputs.meanReturn - 0.02 }),
    s("income_interruption", "No contributions for 3 years (income interruption)", {}, undefined),
    s("major_expense", "Unexpected major expense at retirement", {}, { oneTimeExpense: inputs.annualRetirementSpending * 2, oneTimeExpenseAge: inputs.retirementAge }),
    s("longer_life", "Plan lasts 5 years longer", { horizonAge: inputs.horizonAge + 5 }),
    s("near_retirement_drawdown", "30% drawdown the year before retirement", {}, { nearRetirementDrawdown: 0.3 }),
  ];
  // Income interruption: zero contributions for the first 3 working years.
  scenarios[2] = s("income_interruption", "No contributions for 3 years (income interruption)", { annualContribution: 0 });

  return {
    status: "ready",
    paths: inputs.paths,
    years,
    depletionProbability: base.depletionProbability,
    essentialCoverageProbability: base.essentialCoverageProbability,
    medianEndingBalance: base.medianEndingBalance,
    p10EndingBalance: base.p10,
    p90EndingBalance: base.p90,
    medianDepletionAge: base.medianDepletionAge,
    goalProbability: base.goalProbability,
    sensitivities,
    scenarios,
    assumptions: {
      meanReturn: inputs.meanReturn,
      volatility: inputs.volatility,
      feeRate: inputs.feeRate,
      df: inputs.df,
      basis: 0, // 0 = real (inflation-adjusted) dollars
    },
  };
}
