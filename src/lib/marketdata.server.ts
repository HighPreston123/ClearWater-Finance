/* eslint-disable @typescript-eslint/no-explicit-any */
import type postgres from "postgres";

/** Server-only Alpaca Market Data (Basic plan, feed=iex). Market data only — no trading. */
type Tx = postgres.TransactionSql;
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

/** Latest trades, served from fin.market_latest when fetched < 60s ago; one batched call for the rest. */
export async function getLatest(tx: Tx, symbols: string[]): Promise<LatestRow[]> {
  const cached = await tx<any[]>`SELECT * FROM fin.market_latest WHERE feed = ${FEED} AND symbol = ANY(${symbols})`;
  const fresh = new Map(cached.filter((r) => Date.now() - new Date(r.fetched_at).getTime() < CACHE_MS).map((r) => [r.symbol, r]));
  const need = symbols.filter((s) => !fresh.has(s));
  if (need.length) {
    const body = await alpaca("/v2/stocks/trades/latest", { symbols: need.join(","), feed: FEED });
    const trades = body?.trades ?? {};
    for (const s of need) {
      const t = trades[s];
      const ok = t && typeof t.p === "number" && t.p > 0;
      const [row] = await tx<any[]>`
        INSERT INTO fin.market_latest (symbol, feed, price, trade_ts, status, fetched_at)
        VALUES (${s}, ${FEED}, ${ok ? String(t.p) : null}, ${ok ? t.t : null}, ${ok ? "ok" : "unsupported"}, now())
        ON CONFLICT (symbol, feed) DO UPDATE SET price = EXCLUDED.price, trade_ts = EXCLUDED.trade_ts,
          status = EXCLUDED.status, fetched_at = EXCLUDED.fetched_at
        RETURNING *`;
      fresh.set(s, row);
    }
  }
  return symbols.map((s) => {
    const r = fresh.get(s);
    return { symbol: s, feed: FEED, status: r.status, price: r.price === null ? null : String(r.price),
      tradeTs: r.trade_ts ? new Date(r.trade_ts).toISOString() : null, fetchedAt: new Date(r.fetched_at).toISOString() };
  });
}

/** Daily bars for the last `days`; fetches only the range after the newest stored bar, following page tokens. */
export async function syncDailyBars(tx: Tx, symbol: string, days: number) {
  const start = new Date(Date.now() - days * 86400_000);
  const [{ max, min }] = await tx<any[]>`SELECT max(ts) AS max, min(ts) AS min FROM fin.market_bars
    WHERE symbol = ${symbol} AND timeframe = '1Day' AND feed = ${FEED}`;
  const coversStart = min && new Date(min).getTime() <= start.getTime() + 5 * 86400_000;
  const from = coversStart && max ? new Date(new Date(max).getTime() + 1000) : start;
  // Skip the call if the newest bar is less than ~20h old.
  let inserted = 0;
  if (!(coversStart && max && Date.now() - new Date(max).getTime() < 20 * 3600_000)) {
    let pageToken: string | undefined;
    let pages = 0;
    do {
      const body = await alpaca(`/v2/stocks/${encodeURIComponent(symbol)}/bars`, {
        timeframe: "1Day", start: from.toISOString(), feed: FEED, adjustment: "raw", limit: "1000",
        ...(pageToken ? { page_token: pageToken } : {}),
      });
      for (const b of body?.bars ?? []) {
        const r = await tx`INSERT INTO fin.market_bars (symbol, ts, timeframe, feed, open, high, low, close, volume)
          VALUES (${symbol}, ${b.t}, '1Day', ${FEED}, ${b.o}, ${b.h}, ${b.l}, ${b.c}, ${b.v})
          ON CONFLICT (symbol, timeframe, feed, ts) DO NOTHING`;
        inserted += r.count;
      }
      pageToken = body?.next_page_token ?? undefined;
    } while (pageToken && ++pages < 20);
  }
  const rows = await tx<any[]>`SELECT ts, open, high, low, close, volume, fetched_at FROM fin.market_bars
    WHERE symbol = ${symbol} AND timeframe = '1Day' AND feed = ${FEED} AND ts >= ${start} ORDER BY ts`;
  return {
    symbol, timeframe: "1Day", feed: FEED, source: "alpaca", inserted,
    bars: rows.map((r) => ({ t: new Date(r.ts).toISOString(), o: Number(r.open), h: Number(r.high), l: Number(r.low),
      c: Number(r.close), v: Number(r.volume), fetchedAt: new Date(r.fetched_at).toISOString() })),
  };
}
