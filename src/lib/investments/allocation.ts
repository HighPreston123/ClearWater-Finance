import { ACCOUNT_TYPE_LABELS, ASSET_CLASS_LABELS, type AccountType, type AssetClass, type Holding, type InvestmentAccount } from "@/types/investments";
import { centsToMicros, valueHolding } from "./valuation";

export interface AllocationSlice {
  key: string;
  label: string;
  micros: bigint;
  weightPct: number;
}

function toSlices(map: Map<string, { label: string; micros: bigint }>): AllocationSlice[] {
  const total = [...map.values()].reduce((s, v) => s + v.micros, 0n);
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: v.label, micros: v.micros, weightPct: total === 0n ? 0 : (Number(v.micros) / Number(total)) * 100 }))
    .filter((s) => s.micros > 0n)
    .sort((a, b) => Number(b.micros - a.micros));
}

/** Account type = the wrapper (Roth IRA, 401(k)…). Includes account cash. */
export function byAccountType(accounts: InvestmentAccount[], holdings: Holding[], now = new Date()) {
  const m = new Map<string, { label: string; micros: bigint }>();
  for (const a of accounts) {
    const key: AccountType = a.type;
    const cur = m.get(key) ?? { label: ACCOUNT_TYPE_LABELS[key], micros: 0n };
    cur.micros += centsToMicros(a.cashCents);
    for (const h of holdings.filter((x) => x.accountId === a.id)) cur.micros += valueHolding(h, now).micros ?? 0n;
    m.set(key, cur);
  }
  return toSlices(m);
}

/** Asset class = what is held. Uninvested account cash is reported as cash. */
export function byAssetClass(accounts: InvestmentAccount[], holdings: Holding[], now = new Date()) {
  const m = new Map<string, { label: string; micros: bigint }>();
  const add = (k: AssetClass, v: bigint) => {
    const cur = m.get(k) ?? { label: ASSET_CLASS_LABELS[k], micros: 0n };
    cur.micros += v;
    m.set(k, cur);
  };
  for (const h of holdings) add(h.assetClass, valueHolding(h, now).micros ?? 0n);
  for (const a of accounts) add("cash", centsToMicros(a.cashCents));
  return toSlices(m);
}

export function holdingWeightPct(micros: bigint | null, totalMicros: bigint) {
  if (micros === null || totalMicros === 0n) return null;
  return (Number(micros) / Number(totalMicros)) * 100;
}
