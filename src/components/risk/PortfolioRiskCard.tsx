import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useFinanceStore } from "@/store/FinanceStore";
import { valueHolding } from "@/lib/investments/valuation";
import { getPortfolioRisk } from "@/lib/portfolioRisk.functions";
import type { PortfolioRiskResult } from "@/lib/risk/portfolioRisk";
import { publishRiskResult } from "@/lib/risk/resultsStore";
import { CardTitle, GlassCard, Kv, Note, StatusBadge } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { CsvMiniLink } from "@/components/common/CsvHelp";

const pct = (x: number | null | undefined, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(d)}%`);

export function PortfolioRiskCard() {
  const s = useFinanceStore();
  const run = useServerFn(getPortfolioRisk);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<PortfolioRiskResult | null>(null);

  const positions = useMemo(() => {
    const by = new Map<string, number>();
    for (const h of s.holdings) {
      if (!h.symbol || h.assetClass === "cash") continue;
      const v = valueHolding(h);
      if (v.micros === null) continue;
      by.set(h.symbol.toUpperCase(), (by.get(h.symbol.toUpperCase()) ?? 0) + Number(v.micros) / 1e6);
    }
    return [...by].map(([symbol, marketValue]) => ({ symbol, marketValue })).filter((p) => p.marketValue !== 0).slice(0, 40);
  }, [s.holdings]);

  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await run({ data: { positions, days: 365 } });
      if (r.status === "ok") { setRes(r.result); publishRiskResult("portfolioRisk", r.result); } else setErr(r.message);
    } catch { setErr("Could not calculate portfolio risk."); }
    finally { setBusy(false); }
  };

  // Auto-fetch price history once per visit so "Historical market data" is filled in.
  const auto = useRef<string | null>(null);
  const key = positions.map((p) => p.symbol).join(",");
  useEffect(() => {
    if (!key || auto.current === key) return;
    auto.current = key;
    void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const top = res ? [...res.holdings].filter((h) => h.riskShare !== null).sort((a, b) => (b.riskShare ?? 0) - (a.riskShare ?? 0)).slice(0, 8) : [];

  return (
    <GlassCard>
      <CardTitle right={<div className="flex flex-wrap items-center gap-2"><CsvMiniLink section="csv-holdings" label="Import holdings CSV" /><Button size="sm" onClick={go} disabled={busy || !positions.length}>{busy ? "Calculating…" : res ? "Recalculate" : "Calculate"}</Button></div>}>
        Portfolio risk
      </CardTitle>
      {!positions.length && <Note>Add priced stock or fund holdings with your investments CSV to measure portfolio risk.</Note>}
      {err && <Note>{err}</Note>}
      {res && res.status !== "ready" && <Note>Not enough data: {res.reason}</Note>}
      {res && res.status === "ready" && (
        <div className="space-y-4">
          <Kv items={[
            { label: "Annual volatility", value: pct(res.annualVolatility) },
            { label: "Max drawdown", value: pct(res.maxDrawdown) },
            ...res.var.map((v) => ({ label: `1-day VaR ${Math.round(v.confidence * 100)}%`, value: pct(v.dailyLoss, 2) })),
            ...res.cvar.map((v) => ({ label: `1-day CVaR ${Math.round(v.confidence * 100)}%`, value: pct(v.dailyLoss, 2) })),
            { label: `Beta vs ${res.benchmarkSymbol ?? "benchmark"}`, value: res.beta === null ? "—" : res.beta.toFixed(2) },
            { label: "Concentration (HHI)", value: res.concentration.hhi.toFixed(3) },
            { label: "Largest holding", value: pct(res.concentration.largestWeight) },
            { label: "Top 5 holdings", value: pct(res.concentration.top5Weight) },
          ]} />
          <div>
            <p className="mb-2 text-sm font-medium">Biggest contributors to risk</p>
            <ul className="space-y-1 text-sm">
              {top.map((h) => (
                <li key={h.symbol} className="flex justify-between gap-2">
                  <span>{h.symbol}</span>
                  <span className="text-muted-foreground">weight {pct(h.weight)} · volatility {pct(h.annualVolatility)} · risk share <strong className="text-foreground">{pct(h.riskShare)}</strong></span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="info">{res.observations} trading days{res.window ? ` · ${res.window.start} → ${res.window.end}` : ""}</StatusBadge>
            {res.missingSymbols.length > 0 && <StatusBadge tone="warn">No price history: {res.missingSymbols.join(", ")}</StatusBadge>}
            {res.regularization.applied && <StatusBadge tone="pending">Covariance shrinkage {pct(res.regularization.shrinkage, 0)}</StatusBadge>}
          </div>
          <Note>Historical estimates from Alpaca daily closes (IEX feed, 252 trading days/year). VaR and CVaR are past-based loss estimates, not limits on future losses. Risk shares can be negative for holdings that offset others.</Note>
        </div>
      )}
    </GlassCard>
  );
}
