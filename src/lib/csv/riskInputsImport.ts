import type { ManualFinancialInputs, RiskComfort } from "@/types/risk";
import { parseCsvAmount, parseCsvDate } from "@/lib/csv/csvImport";

/**
 * Future-risk inputs from one CSV file. Columns: type,name,amount,rate,min_payment,date,linked
 * Types: emergency_fund, emergency_target, cash_reserve, debt, no_debt, obligation, goal,
 * time_horizon (amount = years), risk_comfort (name = conservative|moderate|growth).
 * Blank cells stay Unknown (null) — never zero. The file replaces all previous inputs.
 */
export const RISK_INPUTS_TEMPLATE = `type,name,amount,rate,min_payment,date,linked
emergency_fund,Emergency fund,10000,,,,
emergency_target,Emergency fund target,20000,,,,
cash_reserve,Checking buffer,2500,,,,
debt,Credit card,3200,19.9,90,,
obligation,Car repair,1500,,,2026-12-15,
goal,House down payment,40000,,,2029-06-01,
time_horizon,,25,,,,
risk_comfort,moderate,,,,,
`;

export type RiskInputsParseResult =
  | { ok: true; inputs: Omit<ManualFinancialInputs, "updatedAt">; rows: number; warnings: string[] }
  | { ok: false; error: string };

function splitLine(line: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const COLS = ["type", "name", "amount", "rate", "min_payment", "date", "linked"] as const;
const COMFORT: RiskComfort[] = ["conservative", "moderate", "growth"];

export function parseRiskInputsCsv(text: string): RiskInputsParseResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { ok: false, error: "The file has no rows. Download the template to see the format." };
  const header = splitLine(lines[0]!).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const idx = Object.fromEntries(COLS.map((c) => [c, header.indexOf(c)])) as Record<(typeof COLS)[number], number>;
  if (idx.type < 0) return { ok: false, error: 'Missing a "type" column. Download the template to see the format.' };
  const inputs: Omit<ManualFinancialInputs, "updatedAt"> = {
    emergencyFundCents: null, emergencyFundTargetCents: null, cashReserves: [], debts: [], debtsConfirmedNone: false,
    obligations: [], goals: [], timeHorizonYears: null, riskComfort: "unknown",
  };
  const warnings: string[] = [];
  let n = 0;
  lines.slice(1).forEach((line, i) => {
    const cells = splitLine(line);
    const get = (c: (typeof COLS)[number]) => (idx[c] >= 0 ? cells[idx[c]] ?? "" : "");
    const row = i + 2;
    const money = (c: (typeof COLS)[number]) => {
      const raw = get(c); if (!raw) return null;
      const p = parseCsvAmount(raw); if (!p) { warnings.push(`Row ${row}: "${raw}" isn't a number — left Unknown.`); return null; }
      return p.cents;
    };
    const num = (c: (typeof COLS)[number]) => { const raw = get(c).replace("%", ""); if (!raw) return null; const v = Number(raw); if (!Number.isFinite(v)) { warnings.push(`Row ${row}: "${raw}" isn't a number — left Unknown.`); return null; } return v; };
    const date = () => { const raw = get("date"); if (!raw) return null; const d = parseCsvDate(raw); if (!d) warnings.push(`Row ${row}: date "${raw}" not recognised — left blank.`); return d; };
    const id = `csv-${row}`;
    const name = get("name");
    switch (get("type").toLowerCase()) {
      case "emergency_fund": inputs.emergencyFundCents = money("amount"); break;
      case "emergency_target": inputs.emergencyFundTargetCents = money("amount"); break;
      case "cash_reserve": {
        const l = get("linked").toLowerCase();
        inputs.cashReserves.push({ id, label: name || "Cash reserve", amountCents: money("amount"), linkedAccountId: !l || l === "none" ? null : l === "emergency_fund" ? "emergency-fund" : get("linked") });
        break;
      }
      case "debt": inputs.debts.push({ id, name: name || "Debt", balanceCents: money("amount"), aprPercent: num("rate"), minPaymentCents: money("min_payment") }); break;
      case "no_debt": inputs.debtsConfirmedNone = true; break;
      case "obligation": inputs.obligations.push({ id, label: name || "Obligation", amountCents: money("amount"), dueDate: date() }); break;
      case "goal": inputs.goals.push({ id, label: name || "Goal", amountCents: money("amount"), targetDate: date() }); break;
      case "time_horizon": { const v = num("amount"); inputs.timeHorizonYears = v === null ? null : Math.max(0, v); break; }
      case "risk_comfort": { const v = name.toLowerCase() as RiskComfort; if (COMFORT.includes(v)) inputs.riskComfort = v; else warnings.push(`Row ${row}: risk comfort must be conservative, moderate or growth.`); break; }
      default: warnings.push(`Row ${row}: unknown type "${get("type")}" — skipped.`); return;
    }
    n++;
  });
  if (inputs.debts.length) inputs.debtsConfirmedNone = false;
  if (!n) return { ok: false, error: "No usable rows found. " + (warnings[0] ?? "") };
  return { ok: true, inputs, rows: n, warnings };
}
