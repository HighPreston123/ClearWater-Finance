import type { Holding, HoldingValuation, InvestmentAccount } from "@/types/investments";

/** Decimal-safe arithmetic using bigint fixed-point. Values are kept in micros (1e-6 USD). */
const SCALE = 8;
const TEN = 10n;

export function parseDecimal(s: string | null | undefined): bigint | null {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [int, frac = ""] = t.split(".");
  const f = (frac + "0".repeat(SCALE)).slice(0, SCALE);
  return BigInt(int ?? "0") * TEN ** BigInt(SCALE) + BigInt(f);
}

/** qty * price → micros, rounded half-up once at micro precision. */
export function multiplyToMicros(qty: string, price: string): bigint | null {
  const q = parseDecimal(qty), p = parseDecimal(price);
  if (q === null || p === null) return null;
  const product = q * p; // scale 1e16
  const divisor = TEN ** BigInt(SCALE * 2 - 6);
  return (product + divisor / 2n) / divisor;
}

export const centsToMicros = (c: number) => BigInt(Math.round(c)) * 10_000n;
export const STALE_DAYS = 7;

export function isStale(asOf: string | null, now = new Date()) {
  if (!asOf) return false;
  const t = Date.parse(asOf.length === 10 ? `${asOf}T00:00:00Z` : asOf);
  return now.getTime() - t > STALE_DAYS * 86_400_000;
}

export function valueHolding(h: Holding, now = new Date()): HoldingValuation {
  if (h.latestPrice) {
    const m = multiplyToMicros(h.quantity, h.latestPrice);
    if (m !== null) return { status: "quoted", micros: m, asOf: h.priceTimestamp, stale: isStale(h.priceTimestamp, now) };
  }
  if (h.suppliedValueCents !== null && h.suppliedValueCents !== undefined) {
    return { status: "supplied", micros: centsToMicros(h.suppliedValueCents), asOf: h.suppliedValueDate ?? null, stale: isStale(h.suppliedValueDate ?? null, now) };
  }
  return { status: "unavailable", micros: null, asOf: null, stale: false };
}

export interface AccountValuation {
  account: InvestmentAccount;
  holdingsMicros: bigint;
  cashMicros: bigint;
  /** = valued holdings + account cash. Cash is never also a holding. */
  totalMicros: bigint;
  partial: boolean;
  unvaluedCount: number;
  staleCount: number;
}

export function valueAccount(account: InvestmentAccount, holdings: Holding[], now = new Date()): AccountValuation {
  let holdingsMicros = 0n, unvaluedCount = 0, staleCount = 0;
  for (const h of holdings.filter((x) => x.accountId === account.id)) {
    const v = valueHolding(h, now);
    if (v.micros === null) unvaluedCount++;
    else holdingsMicros += v.micros;
    if (v.stale) staleCount++;
  }
  const cashMicros = centsToMicros(account.cashCents);
  return { account, holdingsMicros, cashMicros, totalMicros: holdingsMicros + cashMicros, partial: unvaluedCount > 0, unvaluedCount, staleCount };
}

export function valuePortfolio(accounts: InvestmentAccount[], holdings: Holding[], now = new Date()) {
  const perAccount = accounts.map((a) => valueAccount(a, holdings, now));
  const totalMicros = perAccount.reduce((s, a) => s + a.totalMicros, 0n);
  return {
    perAccount,
    totalMicros,
    partial: perAccount.some((a) => a.partial),
    unvaluedCount: perAccount.reduce((s, a) => s + a.unvaluedCount, 0),
    staleCount: perAccount.reduce((s, a) => s + a.staleCount, 0),
  };
}

/** Only when a valid cost basis is supplied. Not a complete performance measure. */
export function unrealizedGainMicros(h: Holding, v: HoldingValuation): bigint | null {
  if (h.costBasisCents === null || h.costBasisCents === undefined || v.micros === null) return null;
  return v.micros - centsToMicros(h.costBasisCents);
}
