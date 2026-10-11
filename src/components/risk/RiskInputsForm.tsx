import { useRef, useState } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { parseRiskInputsCsv, RISK_INPUTS_TEMPLATE } from "@/lib/csv/riskInputsImport";
import { GlassCard, CardTitle, Note } from "@/components/common/Glass";
import { CsvGuide } from "@/components/common/CsvHelp";
import { MoneyInput } from "@/components/common/MoneyInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useFinanceStore } from "@/store/FinanceStore";

const uid = () => Math.random().toString(36).slice(2, 10);

export function EmergencyFundFields() {
  const { manual, updateManual } = useFinanceStore();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor="ef">Emergency-fund balance</Label><MoneyInput id="ef" label="Emergency-fund balance" value={manual.emergencyFundCents} onChange={(v) => updateManual({ emergencyFundCents: v })} /></div>
      <div><Label htmlFor="eft">Emergency-fund target</Label><MoneyInput id="eft" label="Emergency-fund target" value={manual.emergencyFundTargetCents} onChange={(v) => updateManual({ emergencyFundTargetCents: v })} /></div>
    </div>
  );
}

export function GoalsFields() {
  const { manual, updateManual } = useFinanceStore();
  return (
    <div className="space-y-2">
      {manual.goals.map((g) => (
        <div key={g.id} className="grid grid-cols-[1fr_8rem_9rem_auto] items-center gap-2">
          <Input aria-label="Goal name" value={g.label} onChange={(e) => updateManual({ goals: manual.goals.map((x) => (x.id === g.id ? { ...x, label: e.target.value } : x)) })} className="bg-card" />
          <MoneyInput label="Goal amount" value={g.amountCents} onChange={(v) => updateManual({ goals: manual.goals.map((x) => (x.id === g.id ? { ...x, amountCents: v } : x)) })} />
          <Input aria-label="Target date" type="date" value={g.targetDate ?? ""} onChange={(e) => updateManual({ goals: manual.goals.map((x) => (x.id === g.id ? { ...x, targetDate: e.target.value || null } : x)) })} className="bg-card" />
          <Button variant="ghost" size="icon" aria-label={`Remove ${g.label}`} onClick={() => updateManual({ goals: manual.goals.filter((x) => x.id !== g.id) })}><Trash2 /></Button>
        </div>
      ))}
      <Button variant="glass" size="sm" onClick={() => updateManual({ goals: [...manual.goals, { id: uid(), label: "New goal", amountCents: null, targetDate: null }] })}><Plus /> Add goal</Button>
    </div>
  );
}

export function RiskInputsForm() {
  const { manual, updateManual } = useFinanceStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; warnings: string[] } | null>(null);
  const read = (f: File) => f.text().then((text) => {
    const r = parseRiskInputsCsv(text);
    if (!r.ok) setMsg({ ok: false, text: r.error, warnings: [] });
    else { updateManual(r.inputs); setMsg({ ok: true, text: `Imported ${r.rows} row(s) from ${f.name}. This replaced your previous inputs.`, warnings: r.warnings }); }
    if (inputRef.current) inputRef.current.value = "";
  });
  const template = () => {
    const url = URL.createObjectURL(new Blob([RISK_INPUTS_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "future-risk-inputs-template.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const money = (c: number | null) => (c === null ? "Unknown" : `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
  const rows: [string, string][] = [
    ["Emergency fund", money(manual.emergencyFundCents)],
    ["Emergency-fund target", money(manual.emergencyFundTargetCents)],
    ...manual.cashReserves.map((r): [string, string] => [`Cash reserve: ${r.label}`, `${money(r.amountCents)}${r.linkedAccountId ? ` (linked: ${r.linkedAccountId})` : ""}`]),
    ...(manual.debtsConfirmedNone ? [["Debts", "None (confirmed)"] as [string, string]] : manual.debts.length ? manual.debts.map((d): [string, string] => [`Debt: ${d.name}`, `${money(d.balanceCents)} · APR ${d.aprPercent ?? "Unknown"}% · min ${money(d.minPaymentCents)}`]) : [["Debts", "Unknown"] as [string, string]]),
    ...manual.obligations.map((o): [string, string] => [`Obligation: ${o.label}`, `${money(o.amountCents)}${o.dueDate ? ` due ${o.dueDate}` : ""}`]),
    ...manual.goals.map((g): [string, string] => [`Goal: ${g.label}`, `${money(g.amountCents)}${g.targetDate ? ` by ${g.targetDate}` : ""}`]),
    ["Time horizon", manual.timeHorizonYears === null ? "Unknown" : `${manual.timeHorizonYears} years`],
    ["Risk comfort", manual.riskComfort],
  ];
  return (
    <GlassCard id="csv-risk-inputs" className="scroll-mt-24">
      <CardTitle>Import Future risk inputs from CSV</CardTitle>
      <p className="mb-4 text-sm text-muted-foreground">Upload one CSV with your emergency fund, cash reserves, debts, upcoming obligations, goals, time horizon and risk comfort. Blank cells stay "Unknown" — they are never treated as zero. Each upload replaces the previous inputs.</p>
      <CsvGuide
        columns={[
          { name: "type", required: true, what: "Which input the row is: emergency_fund, emergency_target, cash_reserve, debt, no_debt, obligation, goal, time_horizon or risk_comfort.", example: "debt" },
          { name: "name", what: "A label (e.g. the card or goal name). For risk_comfort: conservative, moderate or growth.", example: "Credit card" },
          { name: "amount", what: "Dollars: fund balance, target, reserve, debt balance, bill or goal amount. For time_horizon: years until you need the money.", example: "3200" },
          { name: "rate", what: "Debt rows only: interest rate (APR) in percent.", example: "19.9" },
          { name: "min_payment", what: "Debt rows only: required monthly minimum payment in dollars.", example: "90" },
          { name: "date", what: "Obligation and goal rows: due date or target date.", example: "2029-06-01" },
          { name: "linked", what: "Cash reserve rows: emergency_fund (or an account id) if this cash is already counted elsewhere, to avoid double counting.", example: "emergency_fund" },
        ]}
        whereToFind={[
          "Emergency fund and cash reserves: current balance of your savings or checking accounts (bank app or latest statement).",
          "Debts: credit-card, loan or student-loan statements list the balance, APR and minimum payment.",
          "Obligations: known upcoming bills — tax payments, insurance renewals, tuition, planned repairs.",
          "Goals: your own targets (house down payment, car, wedding) with the amount and a target date.",
          "Time horizon and risk comfort: your own judgement — years until retirement, and how much market ups and downs you can tolerate.",
          "No debts? Add a single row with type no_debt so it counts as confirmed rather than unknown.",
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" id="risk-inputs-csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }} />
        <Button variant="aero" onClick={() => inputRef.current?.click()}><Upload /> Upload CSV</Button>
        <Button variant="glass" onClick={template}><Download /> Download template</Button>
      </div>
      {msg && (
        <div role="status" className={`mt-4 rounded-2xl border p-3 text-sm ${msg.ok ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
          <p>{msg.text}</p>
          {msg.warnings.length > 0 && <ul className="mt-2 list-disc pl-4 text-xs">{msg.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </div>
      )}
      <ul className="mt-4 divide-y rounded-2xl border bg-card text-sm">
        {rows.map(([k, v], i) => <li key={i} className="flex justify-between gap-3 px-3 py-2"><span className="font-medium">{k}</span><span className="text-right text-muted-foreground">{v}</span></li>)}
      </ul>
      <Note>Types: emergency_fund, emergency_target, cash_reserve (linked = emergency_fund or an account id to avoid double counting), debt (amount, rate, min_payment), no_debt, obligation (date), goal (date), time_horizon (amount = years), risk_comfort (name = conservative, moderate or growth).</Note>
      <Note>Last updated: {manual.updatedAt ? new Date(manual.updatedAt).toLocaleString() : "Never"}</Note>
    </GlassCard>
  );
}
