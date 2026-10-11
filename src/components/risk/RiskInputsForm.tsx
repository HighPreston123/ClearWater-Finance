import { Plus, Trash2 } from "lucide-react";
import { GlassCard, CardTitle, Note } from "@/components/common/Glass";
import { MoneyInput } from "@/components/common/MoneyInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanceStore } from "@/store/FinanceStore";
import type { RiskComfort } from "@/types/risk";

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
  const { manual, updateManual, accounts } = useFinanceStore();
  return (
    <GlassCard>
      <CardTitle>Manual inputs</CardTitle>
      <p className="mb-4 text-sm text-muted-foreground">Optional details transactions can't establish. Blank fields stay "Unknown" — they are never treated as zero.</p>
      <div className="space-y-6">
        <section aria-labelledby="ef-h"><h3 id="ef-h" className="mb-2 font-display font-bold">Emergency fund</h3><EmergencyFundFields /></section>

        <section aria-labelledby="cr-h">
          <h3 id="cr-h" className="mb-2 font-display font-bold">Cash reserves</h3>
          {manual.cashReserves.map((r) => (
            <div key={r.id} className="mb-2 grid gap-2 sm:grid-cols-[1fr_8rem_12rem_auto]">
              <Input aria-label="Reserve name" value={r.label} onChange={(e) => updateManual({ cashReserves: manual.cashReserves.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)) })} className="bg-card" />
              <MoneyInput label="Reserve amount" value={r.amountCents} onChange={(v) => updateManual({ cashReserves: manual.cashReserves.map((x) => (x.id === r.id ? { ...x, amountCents: v } : x)) })} />
              <Select value={r.linkedAccountId ?? "none"} onValueChange={(v) => updateManual({ cashReserves: manual.cashReserves.map((x) => (x.id === r.id ? { ...x, linkedAccountId: v === "none" ? null : v } : x)) })}>
                <SelectTrigger aria-label="Linked account" className="bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Separate account (not tracked)</SelectItem>
                  <SelectItem value="emergency-fund">Same as emergency fund</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>Cash in {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" aria-label="Remove reserve" onClick={() => updateManual({ cashReserves: manual.cashReserves.filter((x) => x.id !== r.id) })}><Trash2 /></Button>
            </div>
          ))}
          <Button variant="glass" size="sm" onClick={() => updateManual({ cashReserves: [...manual.cashReserves, { id: uid(), label: "Checking buffer", amountCents: null, linkedAccountId: null }] })}><Plus /> Add reserve</Button>
          <Note>Link a reserve if it's already counted elsewhere (your emergency fund or investment-account cash) so it isn't counted twice.</Note>
        </section>

        <section aria-labelledby="debt-h">
          <h3 id="debt-h" className="mb-2 font-display font-bold">Debts</h3>
          {manual.debts.map((d) => (
            <div key={d.id} className="mb-2 grid gap-2 sm:grid-cols-[1fr_8rem_6rem_8rem_auto]">
              <Input aria-label="Debt name" value={d.name} onChange={(e) => updateManual({ debts: manual.debts.map((x) => (x.id === d.id ? { ...x, name: e.target.value } : x)) })} className="bg-card" />
              <MoneyInput label="Balance" value={d.balanceCents} onChange={(v) => updateManual({ debts: manual.debts.map((x) => (x.id === d.id ? { ...x, balanceCents: v } : x)) })} />
              <Input aria-label="APR %" placeholder="APR %" inputMode="decimal" value={d.aprPercent ?? ""} onChange={(e) => updateManual({ debts: manual.debts.map((x) => (x.id === d.id ? { ...x, aprPercent: e.target.value === "" ? null : Number(e.target.value) } : x)) })} className="bg-card" />
              <MoneyInput label="Minimum payment" value={d.minPaymentCents} onChange={(v) => updateManual({ debts: manual.debts.map((x) => (x.id === d.id ? { ...x, minPaymentCents: v } : x)) })} />
              <Button variant="ghost" size="icon" aria-label="Remove debt" onClick={() => updateManual({ debts: manual.debts.filter((x) => x.id !== d.id) })}><Trash2 /></Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="glass" size="sm" onClick={() => updateManual({ debts: [...manual.debts, { id: uid(), name: "Credit card", balanceCents: null, aprPercent: null, minPaymentCents: null }], debtsConfirmedNone: false })}><Plus /> Add debt</Button>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={manual.debtsConfirmedNone} disabled={manual.debts.length > 0} onCheckedChange={(v) => updateManual({ debtsConfirmedNone: v === true })} /> I have no debt
            </label>
          </div>
          <Note>With no debts listed and the box unchecked, debt is "Unknown" — not zero.</Note>
        </section>

        <section aria-labelledby="ob-h">
          <h3 id="ob-h" className="mb-2 font-display font-bold">Upcoming obligations</h3>
          {manual.obligations.map((o) => (
            <div key={o.id} className="mb-2 grid gap-2 sm:grid-cols-[1fr_8rem_9rem_auto]">
              <Input aria-label="Obligation" value={o.label} onChange={(e) => updateManual({ obligations: manual.obligations.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })} className="bg-card" />
              <MoneyInput label="Amount" value={o.amountCents} onChange={(v) => updateManual({ obligations: manual.obligations.map((x) => (x.id === o.id ? { ...x, amountCents: v } : x)) })} />
              <Input aria-label="Due date" type="date" value={o.dueDate ?? ""} onChange={(e) => updateManual({ obligations: manual.obligations.map((x) => (x.id === o.id ? { ...x, dueDate: e.target.value || null } : x)) })} className="bg-card" />
              <Button variant="ghost" size="icon" aria-label="Remove obligation" onClick={() => updateManual({ obligations: manual.obligations.filter((x) => x.id !== o.id) })}><Trash2 /></Button>
            </div>
          ))}
          <Button variant="glass" size="sm" onClick={() => updateManual({ obligations: [...manual.obligations, { id: uid(), label: "Upcoming expense", amountCents: null, dueDate: null }] })}><Plus /> Add obligation</Button>
        </section>

        <section aria-labelledby="g-h"><h3 id="g-h" className="mb-2 font-display font-bold">Goals</h3><GoalsFields /></section>

        <section aria-labelledby="h-h" className="grid gap-3 sm:grid-cols-2">
          <h3 id="h-h" className="col-span-full font-display font-bold">Investing preferences</h3>
          <div>
            <Label htmlFor="hz">Investment time horizon (years)</Label>
            <Input id="hz" inputMode="numeric" placeholder="Unknown" value={manual.timeHorizonYears ?? ""} onChange={(e) => updateManual({ timeHorizonYears: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) })} className="bg-card" />
          </div>
          <div>
            <Label htmlFor="rc">Risk comfort</Label>
            <Select value={manual.riskComfort} onValueChange={(v) => updateManual({ riskComfort: v as RiskComfort })}>
              <SelectTrigger id="rc" className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="conservative">Prefer stability</SelectItem>
                <SelectItem value="moderate">Balanced</SelectItem>
                <SelectItem value="growth">Comfortable with swings</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>
      </div>
      <Note>Last updated: {manual.updatedAt ? new Date(manual.updatedAt).toLocaleString() : "Never"}</Note>
    </GlassCard>
  );
}
