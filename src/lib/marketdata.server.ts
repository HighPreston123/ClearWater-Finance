/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminDb, check, selectAll, type Db } from "./db.server";

/** Server-only Alpaca Market Data (Basic plan, feed=iex). Market data only — no trading. */
export const FEED = "iex";
const BASE = "https://data.alpaca.markets";
const CACHE_MS = 60_000;
export const SYMBOL = /^[A-Z][A-Z0-9.]{0,9}$/;

export class AlpacaError extends Error {
  constructor(public kind: "not_configured" | "auth" | "rate_limited" | "service", msg: string, public retryAfter?: number) {
    super(msg);
  }
}

async function alpaca(path: string, params: Record<string, string>): Promise<any> {
  const key = process.env["ALPACA_API_KEY"];
  const secret = process.env["ALPACA_SECRET_KEY"];
  if (!key || !secret) throw new AlpacaError("not_configured", "Alpaca market data is not connected.");
  const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
    headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret, accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) throw new AlpacaError("auth", "Alpaca rejected the credentials (invalid key or no data access).");
  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after")) || 60;
    throw new AlpacaError("rate_limited", `Alpaca rate limit reached. Try again in about ${ra}s.`, ra);
  }
  if (!res.ok) throw new AlpacaError("service", `Alpaca service error (${res.status}).`);
  return res.json();
}

export interface LatestRow { symbol: string; price: string | null; tradeTs: string | null; fetchedAt: string; status: "ok" | "unsupported"; feed: string }

/** Latest trades, served from fin_market_latest when fetched < 60s ago; one batched call for the rest. Cache writes are server-only. */
export async function getLatest(db: Db, symbols: string[]): Promise<LatestRow[]> {
  const cached = (check(await db.from("fin_market_latest").select("*").eq("feed", FEED).in("symbol", symbols), "latest_read") ?? []) as any[];
  const fresh = new Map(cached.filter((r) => Date.now() - new Date(r.fetched_at).getTime() < CACHE_MS).map((r) => [r.symbol, r]));
  const need = symbols.filter((s) => !fresh.has(s));
  if (need.length) {
    const body = await alpaca("/v2/stocks/trades/latest", { symbols: need.join(","), feed: FEED });
    const trades = body?.trades ?? {};
    const now = new Date().toISOString();
    const rows = need.map((s) => {
      const t = trades[s];
      const ok = t && typeof t.p === "number" && t.p > 0;
      return { symbol: s, feed: FEED, price: ok ? t.p : null, trade_ts: ok ? t.t : null, status: ok ? "ok" : "unsupported", fetched_at: now };
    });
    const saved = (check(await (await adminDb()).from("fin_market_latest").upsert(rows, { onConflict: "symbol,feed" }).select("*"), "latest_write") ?? []) as any[];
    for (const r of saved) fresh.set(r.symbol, r);
  }
  return symbols.map((s) => {
    const r = fresh.get(s);
    return { symbol: s, feed: FEED, status: r.status, price: r.price === null ? null : String(r.price),
      tradeTs: r.trade_ts ? new Date(r.trade_ts).toISOString() : null, fetchedAt: new Date(r.fetched_at).toISOString() };
  });
}

/** Daily bars for the last `days`; fetches only the range after the newest stored bar, following page tokens. */
export async function syncDailyBars(db: Db, symbol: string, days: number) {
  const start = new Date(Date.now() - days * 86400_000);
  const base = () => db.from("fin_market_bars").select("ts").eq("symbol", symbol).eq("timeframe", "1Day").eq("feed", FEED);
  const [maxRow, minRow] = await Promise.all([
    base().order("ts", { ascending: false }).limit(1).maybeSingle(),
    base().order("ts", { ascending: true }).limit(1).maybeSingle(),
  ]);
  const max = (check(maxRow, "bars_max") as any)?.ts ?? null;
  const min = (check(minRow, "bars_min") as any)?.ts ?? null;
  const coversStart = min && new Date(min).getTime() <= start.getTime() + 5 * 86400_000;
  const from = coversStart && max ? new Date(new Date(max).getTime() + 1000) : start;
  // Skip the call if the newest bar is less than ~20h old.
  let inserted = 0;
  if (!(coversStart && max && Date.now() - new Date(max).getTime() < 20 * 3600_000)) {
    const admin = await adminDb();
    let pageToken: string | undefined;
    let pages = 0;
    do {
      const body = await alpaca(`/v2/stocks/${encodeURIComponent(symbol)}/bars`, {
        timeframe: "1Day", start: from.toISOString(), feed: FEED, adjustment: "raw", limit: "1000",
        ...(pageToken ? { page_token: pageToken } : {}),
      });
      const bars: any[] = body?.bars ?? [];
      // Bounded batches (≤500 rows) instead of one request per bar; same key + dedupe.
      for (let i = 0; i < bars.length; i += 500) {
        const rows = bars.slice(i, i + 500).map((b) => ({ symbol, ts: b.t, timeframe: "1Day", feed: FEED, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
        const r = check(await admin.from("fin_market_bars").upsert(rows, { onConflict: "symbol,timeframe,feed,ts", ignoreDuplicates: true }).select("ts"), "bars_write") ?? [];
        inserted += r.length;
      }
      pageToken = body?.next_page_token ?? undefined;
    } while (pageToken && ++pages < 20);
  }
  const rows = await selectAll<any>((a, b) => db.from("fin_market_bars").select("ts, open, high, low, close, volume, fetched_at")
    .eq("symbol", symbol).eq("timeframe", "1Day").eq("feed", FEED).gte("ts", start.toISOString()).order("ts").range(a, b), "bars_read");
  return {
    symbol, timeframe: "1Day", feed: FEED, source: "alpaca", inserted,
    bars: rows.map((r) => ({ t: new Date(r.ts).toISOString(), o: Number(r.open), h: Number(r.high), l: Number(r.low),
      c: Number(r.close), v: Number(r.volume), fetchedAt: new Date(r.fetched_at).toISOString() })),
  };
}
