/**
 * Quantitative portfolio risk (spec §5). Pure functions, no I/O.
 * Conventions:
 *  - Daily SIMPLE returns r_t = P_t/P_{t-1} - 1, aligned on dates common to all series.
 *  - Sample (n-1) covariance, annualized × tradingDays (default 252).
 *  - Historical VaR/CVaR on daily loss L = -r_p; VaR = empirical quantile (lower-index
 *    convention: the ceil((1-c)·n)-th worst loss); CVaR = mean of losses ≥ VaR.
 *  - Covariance shrinkage toward the diagonal (Ledoit-Wolf-style constant δ) when
 *    observations are few relative to assets; disclosed via `regularization`.
 * Invalid outputs are returned as null, never as fabricated numbers.
 */

export type PriceSeries = { symbol: string; points: { date: string; close: number }[] };
export type Position = { symbol: string; marketValue: number };

export type PortfolioRiskOptions = {
  tradingDays?: number;
  confidenceLevels?: number[];
  minObservations?: number;
  benchmark?: PriceSeries | null;
};

export type HoldingRisk = {
  symbol: string;
  weight: number;
  annualVolatility: number | null;
  marginalRisk: number | null;
  componentRisk: number | null;
  riskShare: number | null;
};

export type PortfolioRiskResult = {
  status: "ready" | "insufficient_data";
  reason: string | null;
  tradingDays: number;
  observations: number;
  window: { start: string; end: string } | null;
  missingSymbols: string[];
  annualVolatility: number | null;
  maxDrawdown: number | null;
  var: { confidence: number; dailyLoss: number }[];
  cvar: { confidence: number; dailyLoss: number }[];
  beta: number | null;
  benchmarkSymbol: string | null;
  concentration: { hhi: number; largestWeight: number; top5Weight: number; grossExposure: number; netExposure: number };
  correlations: { a: string; b: string; rho: number }[];
  holdings: HoldingRisk[];
  regularization: { applied: boolean; shrinkage: number };
  calculatedAt: string;
};

export const dailyReturns = (closes: number[]): number[] => {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    if (prev > 0) out.push(closes[i]! / prev - 1);
  }
  return out;
};

export const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;

export function covariance(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i]! - ma) * (b[i]! - mb);
  return s / (n - 1);
}

export function annualizedVolatility(returns: number[], tradingDays = 252): number | null {
  const v = covariance(returns, returns);
  return v === null ? null : Math.sqrt(v * tradingDays);
}

export function maxDrawdown(values: number[]): number | null {
  if (values.length < 2) return null;
  let peak = values[0]!, mdd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) mdd = Math.min(mdd, v / peak - 1);
  }
  return mdd;
}

export function historicalVaR(returns: number[], confidence: number): { var: number; cvar: number } | null {
  if (returns.length < 20 || confidence <= 0 || confidence >= 1) return null;
  const losses = returns.map((r) => -r).sort((x, y) => y - x); // worst first
  const k = Math.max(1, Math.ceil(Math.round((1 - confidence) * losses.length * 1e9) / 1e9));
  const tail = losses.slice(0, k);
  return { var: tail[k - 1]!, cvar: mean(tail) };
}

export function concentration(weights: number[]) {
  const gross = weights.reduce((a, w) => a + Math.abs(w), 0);
  const abs = weights.map((w) => (gross > 0 ? Math.abs(w) / gross : 0)).sort((a, b) => b - a);
  return {
    hhi: abs.reduce((a, w) => a + w * w, 0),
    largestWeight: abs[0] ?? 0,
    top5Weight: abs.slice(0, 5).reduce((a, w) => a + w, 0),
    grossExposure: gross,
    netExposure: weights.reduce((a, w) => a + w, 0),
  };
}

function align(series: PriceSeries[]): { dates: string[]; closes: number[][] } {
  const maps = series.map((s) => new Map(s.points.map((p) => [p.date.slice(0, 10), p.close])));
  const dates = [...(maps[0]?.keys() ?? [])].filter((d) => maps.every((m) => (m.get(d) ?? 0) > 0)).sort();
  return { dates, closes: maps.map((m) => dates.map((d) => m.get(d)!)) };
}

export function computePortfolioRisk(positions: Position[], prices: PriceSeries[], opts: PortfolioRiskOptions = {}): PortfolioRiskResult {
  const td = opts.tradingDays ?? 252;
  const confs = opts.confidenceLevels ?? [0.95, 0.99];
  const minObs = opts.minObservations ?? 30;
  const calculatedAt = new Date().toISOString();

  const totalNet = positions.reduce((a, p) => a + p.marketValue, 0);
  const grossValue = positions.reduce((a, p) => a + Math.abs(p.marketValue), 0);
  const base = grossValue > 0 ? Math.abs(totalNet) || grossValue : 1;
  const allWeights = positions.map((p) => p.marketValue / base);
  const conc = concentration(allWeights);

  const priceBy = new Map(prices.map((s) => [s.symbol, s]));
  const priced = positions.filter((p) => (priceBy.get(p.symbol)?.points.length ?? 0) > 1);
  const missingSymbols = positions.filter((p) => !priced.includes(p)).map((p) => p.symbol);

  const empty = (reason: string): PortfolioRiskResult => ({
    status: "insufficient_data", reason, tradingDays: td, observations: 0, window: null, missingSymbols,
    annualVolatility: null, maxDrawdown: null, var: [], cvar: [], beta: null, benchmarkSymbol: opts.benchmark?.symbol ?? null,
    concentration: conc, correlations: [],
    holdings: positions.map((p, i) => ({ symbol: p.symbol, weight: allWeights[i]!, annualVolatility: null, marginalRisk: null, componentRisk: null, riskShare: null })),
    regularization: { applied: false, shrinkage: 0 }, calculatedAt,
  });

  if (!priced.length) return empty("No price history for any holding.");
  const withBench = opts.benchmark && opts.benchmark.points.length > 1 ? [...priced.map((p) => priceBy.get(p.symbol)!), opts.benchmark] : priced.map((p) => priceBy.get(p.symbol)!);
  const { dates, closes } = align(withBench);
  if (dates.length - 1 < minObs) return empty(`Only ${Math.max(0, dates.length - 1)} aligned daily observations; need ${minObs}.`);

  const n = priced.length;
  const rets = closes.slice(0, n).map(dailyReturns);
  const T = rets[0]!.length;
  const pricedValue = priced.reduce((a, p) => a + p.marketValue, 0);
  const w = priced.map((p) => p.marketValue / (Math.abs(pricedValue) || 1));

  // Annualized sample covariance with shrinkage toward diagonal when T is small vs n.
  const S = rets.map((a) => rets.map((b) => covariance(a, b)! * td));
  const shrink = n > 1 ? Math.min(1, Math.max(0, n / T)) : 0;
  const applied = shrink > 0.05;
  const delta = applied ? shrink : 0;
  const Sig = S.map((row, i) => row.map((v, j) => (i === j ? v : (1 - delta) * v)));

  const Sw = Sig.map((row) => row.reduce((a, v, j) => a + v * w[j]!, 0));
  const varP = w.reduce((a, wi, i) => a + wi * Sw[i]!, 0);
  const sigmaP = varP > 0 ? Math.sqrt(varP) : null;

  const rp = Array.from({ length: T }, (_, t) => rets.reduce((a, r, i) => a + w[i]! * r[t]!, 0));
  const nav: number[] = [1];
  for (const r of rp) nav.push(nav[nav.length - 1]! * (1 + r));

  const varRows = confs.map((c) => ({ c, v: historicalVaR(rp, c) })).filter((x) => x.v);
  let beta: number | null = null;
  if (closes.length > n) {
    const rm = dailyReturns(closes[n]!);
    const vm = covariance(rm, rm);
    const c = covariance(rp, rm);
    beta = vm && vm > 0 && c !== null ? c / vm : null;
  }

  const correlations: PortfolioRiskResult["correlations"] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = Math.sqrt(S[i]![i]! * S[j]![j]!);
    if (d > 0) correlations.push({ a: priced[i]!.symbol, b: priced[j]!.symbol, rho: S[i]![j]! / d });
  }

  const holdings: HoldingRisk[] = positions.map((p, k) => {
    const i = priced.indexOf(p);
    if (i < 0) return { symbol: p.symbol, weight: allWeights[k]!, annualVolatility: null, marginalRisk: null, componentRisk: null, riskShare: null };
    const mrc = sigmaP ? Sw[i]! / sigmaP : null;
    const rc = mrc !== null ? w[i]! * mrc : null;
    return { symbol: p.symbol, weight: allWeights[k]!, annualVolatility: Math.sqrt(S[i]![i]!), marginalRisk: mrc, componentRisk: rc, riskShare: rc !== null && sigmaP ? rc / sigmaP : null };
  });

  return {
    status: sigmaP ? "ready" : "insufficient_data",
    reason: sigmaP ? null : "Portfolio variance is zero.",
    tradingDays: td, observations: T, window: { start: dates[0]!, end: dates[dates.length - 1]! }, missingSymbols,
    annualVolatility: sigmaP, maxDrawdown: maxDrawdown(nav),
    var: varRows.map((x) => ({ confidence: x.c, dailyLoss: x.v!.var })),
    cvar: varRows.map((x) => ({ confidence: x.c, dailyLoss: x.v!.cvar })),
    beta, benchmarkSymbol: opts.benchmark?.symbol ?? null,
    concentration: conc, correlations, holdings,
    regularization: { applied, shrinkage: delta }, calculatedAt,
  };
}
