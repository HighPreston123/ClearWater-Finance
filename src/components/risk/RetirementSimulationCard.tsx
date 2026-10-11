import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useFinanceStore } from "@/store/FinanceStore";
import { valueHolding } from "@/lib/investments/valuation";
import { getRiskSurvey } from "@/lib/riskSurvey.functions";
import { bandValue } from "@/lib/risk/survey";
import { runRetirementSimulation } from "@/lib/monteCarlo.functions";
import type { MonteCarloResult } from "@/lib/risk/monteCarlo";
import { publishRiskResult } from "@/lib/risk/resultsStore";
import { CardTitle, GlassCard, Kv, Note, StatusBadge } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const money0 = (x: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x);
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

interface Assumption { key: string; label: string; value: string; fromSurvey: boolean }

export function RetirementSimulationCard() {
  const s = useFinanceStore();
  const run = useServerFn(runRetirementSimulation);
  const [fields, setFields] = useState<Assumption[]>([
    { key: "currentAge", label: "Current age", value: "", fromSurvey: false },
    { key: "retirementAge", label: "Retirement age", value: "", fromSurvey: false },
    { key: "horizonAge", label: "Plan through age", value: "", fromSurvey: false },
    { key: "annualContribution", label: "Yearly contributions ($)", value: "", fromSurvey: false },
    { key: "annualRetirementSpending", label: "Yearly retirement spending ($)", value: "", fromSurvey: false },
    { key: "annualDependableIncome", label: "Yearly dependable income in retirement ($)", value: "", fromSurvey: false },
  ]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<MonteCarloResult | null>(null);

  const invested = useMemo(() => {
    let total = 0;
    for (const h of s.holdings) {
      const v = valueHolding(h);
      if (v.micros !== null) total += Number(v.micros) / 1e6;
    }
    return total;
  }, [s.holdings]);

  useEffect(() => {
    let cancelled = false;
    getRiskSurvey()
      .then((state) => {
        if (cancelled) return;
        const a = state.answers;
        const prefill: Record<string, number | null> = {
          currentAge: bandValue("s01_current_age", a["s01_current_age"]),
          retirementAge: a["s02_retirement_age"] === "s02_a" ? bandValue("s01_current_age", a["s01_current_age"]) : bandValue("s02_retirement_age", a["s02_retirement_age"]),
          horizonAge: bandValue("s03_planning_horizon", a["s03_planning_horizon"]),
          annualRetirementSpending: (() => { const m = bandValue("s11_retirement_spending", a["s11_retirement_spending"]); return m === null ? null : m * 12; })(),
          annualDependableIncome: null,
          annualContribution: null,
        };
        setFields((prev) => prev.map((f) => {
          const v = prefill[f.key];
          return f.value === "" && v !== null && v !== undefined ? { ...f, value: String(Math.round(v)), fromSurvey: true } : f;
        }));
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const set = (key: string, value: string) =>
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value, fromSurvey: false } : f)));

  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const num = (key: string) => {
        const raw = fields.find((f) => f.key === key)?.value ?? "";
        const n = Number(raw);
        return raw === "" || !Number.isFinite(n) ? null : n;
      };
      const currentAge = num("currentAge"), retirementAge = num("retirementAge"), horizonAge = num("horizonAge"), spending = num("annualRetirementSpending");
      if (currentAge === null || retirementAge === null || horizonAge === null || spending === null) {
        setErr("Current age, retirement age, planning age, and retirement spending are required — leave nothing blank or fill in the survey above.");
        return;
      }
      const r = await run({
        data: {
          currentAge, retirementAge, horizonAge,
          initialBalance: Math.max(0, invested),
          annualContribution: num("annualContribution") ?? 0,
          annualRetirementSpending: spending,
          annualDependableIncome: num("annualDependableIncome") ?? 0,
          paths: 10000,
        },
      });
      if (r.status === "ok") { setRes(r.result); publishRiskResult("monteCarloProvisional", num("annualContribution") === null || num("annualDependableIncome") === null); publishRiskResult("monteCarlo", r.result); }
      else setErr(`Missing inputs: ${r.missing.join(", ")}`);
    } catch { setErr("Could not run the simulation."); }
    finally { setBusy(false); }
  };

  return (
    <GlassCard>
      <CardTitle right={<Button size="sm" onClick={go} disabled={busy || !loaded}>{busy ? "Simulating…" : res ? "Run again" : "Run simulation"}</Button>}>
        Retirement simulation
      </CardTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        Monte Carlo estimate of whether your resources may support your spending through your planning age. Values
        prefilled from your survey are approximations from answer ranges — adjust any of them. Invested balance
        ({money0(invested)}) comes from your current holdings.
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key}>
            <Label htmlFor={`mc-${f.key}`}>{f.label}{f.fromSurvey ? " (from survey)" : ""}</Label>
            <Input id={`mc-${f.key}`} inputMode="numeric" placeholder="Unknown" value={f.value} onChange={(e) => set(f.key, e.target.value)} className="bg-card" />
          </div>
        ))}
      </div>
      {err && <Note>{err}</Note>}
      {res && (
        <div className="space-y-4">
          <Kv items={[
            { label: "Chance of running out of money", value: pct(res.depletionProbability) },
            { label: "Chance essential spending is covered", value: pct(res.essentialCoverageProbability) },
            { label: "Median ending balance", value: money0(res.medianEndingBalance) },
            { label: "10th–90th percentile", value: `${money0(res.p10EndingBalance)} – ${money0(res.p90EndingBalance)}` },
            { label: "Median depletion age (failed paths)", value: res.medianDepletionAge !== null ? String(Math.round(res.medianDepletionAge)) : "—" },
          ]} />
          <div>
            <p className="mb-2 text-sm font-medium">What changes the outcome most</p>
            <ul className="space-y-1 text-sm">
              {res.sensitivities.map((sc) => (
                <li key={sc.id} className="flex justify-between gap-2">
                  <span>{sc.label}</span>
                  <span className="text-muted-foreground">depletion {pct(sc.depletionProbability)} · median {money0(sc.medianEndingBalance)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Stress scenarios</p>
            <ul className="space-y-1 text-sm">
              {res.scenarios.map((sc) => (
                <li key={sc.id} className="flex justify-between gap-2">
                  <span>{sc.label}</span>
                  <span className="text-muted-foreground">depletion {pct(sc.depletionProbability)} · median {money0(sc.medianEndingBalance)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="info">{res.paths.toLocaleString()} paths · {res.years} years</StatusBadge>
            <StatusBadge tone="info">Real (inflation-adjusted) dollars</StatusBadge>
            <StatusBadge tone="info">Fat-tailed returns (Student-t, df 5)</StatusBadge>
          </div>
          <Note>
            Model estimates, not guarantees or predictions of exact future wealth. Returns are simulated with a
            fat-tailed distribution using a {pct(res.assumptions["meanReturn"] ?? 0)} real return, {pct(res.assumptions["volatility"] ?? 0)} volatility,
            and {pct(res.assumptions["feeRate"] ?? 0)} fees; contributions are added at year-end. Scenarios change one
            assumption at a time — they are possibilities, not promises.
          </Note>
        </div>
      )}
    </GlassCard>
  );
}
