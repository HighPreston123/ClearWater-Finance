import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useFinanceStore } from "@/store/FinanceStore";
import { getFundamentals } from "@/lib/fundamentals.functions";
import type { FundamentalsResult } from "@/lib/edgar.server";
import { publishRiskResult } from "@/lib/risk/resultsStore";
import { CardTitle, GlassCard, Kv, Note, StatusBadge } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";

const pct = (x: number | null | undefined, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(d)}%`);
const money = (x: number | null | undefined) =>
  x === null || x === undefined || !Number.isFinite(x)
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(x);
const ratio = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? "—" : x.toFixed(2));

export function FundamentalsCard() {
  const s = useFinanceStore();
  const run = useServerFn(getFundamentals);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<FundamentalsResult[] | null>(null);

  const symbols = useMemo(
    () => [...new Set(s.holdings.filter((h) => h.symbol && h.assetClass !== "cash").map((h) => h.symbol!.toUpperCase()))].slice(0, 40),
    [s.holdings],
  );

  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await run({ data: { symbols } });
      setRes(r.results);
      publishRiskResult("fundamentals", r.results.map((x) => x.metrics).filter((m): m is NonNullable<typeof m> => m !== null));
    } catch { setErr("Could not load company fundamentals."); }
    finally { setBusy(false); }
  };

  return (
    <GlassCard>
      <CardTitle right={<Button size="sm" onClick={go} disabled={busy || !symbols.length}>{busy ? "Loading…" : res ? "Refresh" : "Load fundamentals"}</Button>}>
        Company fundamentals
      </CardTitle>
      {!symbols.length && <Note>Add stock holdings on the Investments page to see company fundamentals.</Note>}
      {err && <Note>{err}</Note>}
      {res && (
        <div className="space-y-4">
          {res.map((r) => (
            <div key={r.symbol} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{r.symbol}{r.metrics?.companyName ? ` — ${r.metrics.companyName}` : ""}</p>
                {r.status === "no_filings" && <StatusBadge tone="warn">No SEC filings found</StatusBadge>}
                {r.status === "unavailable" && <StatusBadge tone="warn">Filing data unavailable</StatusBadge>}
                {r.metrics?.periodEnd && <StatusBadge tone="info">Period ending {r.metrics.periodEnd}</StatusBadge>}
              </div>
              {r.metrics && (
                <Kv items={[
                  { label: "Revenue", value: money(r.metrics.revenue) },
                  { label: "Revenue growth", value: pct(r.metrics.revenueGrowth) },
                  { label: "Operating margin", value: pct(r.metrics.operatingMargin) },
                  { label: "Free cash flow", value: money(r.metrics.freeCashFlow) },
                  { label: "FCF margin", value: pct(r.metrics.fcfMargin) },
                  { label: "Debt / equity", value: ratio(r.metrics.debtToEquity) },
                  { label: "Interest coverage", value: ratio(r.metrics.interestCoverage) },
                  { label: "Current ratio", value: ratio(r.metrics.currentRatio) },
                ]} />
              )}
            </div>
          ))}
          <Note>
            Latest annual figures from SEC EDGAR company filings (XBRL). “—” means the metric was missing or not
            meaningful (for example negative equity), not zero. Reported fundamentals describe the company's past —
            they are not a prediction of its next stock return.
          </Note>
        </div>
      )}
    </GlassCard>
  );
}
