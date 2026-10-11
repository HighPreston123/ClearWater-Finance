import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Alpaca / IEX market data. Owner id from the verified session; credentials stay server-side. */
const sym = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.]{0,9}$/);
const assertMfa = async (c: unknown) => (await import("./mfa.server")).assertMfa(c);

type Fail = { status: "not_configured" | "auth" | "rate_limited" | "service" | "error"; message: string };
async function run<T>(fn: () => Promise<T>): Promise<{ status: "ok"; data: T } | Fail> {
  try {
    return { status: "ok", data: await fn() };
  } catch (e) {
    const { AlpacaError } = await import("./marketdata.server");
    if (e instanceof AlpacaError) return { status: e.kind, message: e.message };
    return { status: "error", message: "Market data request failed." };
  }
}

export const getWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMfa(context);
    const { withOwner } = await import("./tiger.server");
    return withOwner(context.userId, async (tx) =>
      (await tx<{ symbol: string }[]>`SELECT symbol FROM fin.watchlist WHERE user_id = ${context.userId} ORDER BY added_at`).map((r) => r.symbol));
  });

export const setWatchSymbol = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbol: sym, add: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMfa(context);
    const { withOwner } = await import("./tiger.server");
    await withOwner(context.userId, async (tx) => {
      if (data.add) {
        const [row] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM fin.watchlist WHERE user_id = ${context.userId}`;
        if ((row?.n ?? 0) >= 25) throw new Error("Watchlist limit");
        await tx`INSERT INTO fin.watchlist (user_id, symbol) VALUES (${context.userId}, ${data.symbol}) ON CONFLICT DO NOTHING`;
      } else await tx`DELETE FROM fin.watchlist WHERE user_id = ${context.userId} AND symbol = ${data.symbol}`;
    });
    return { ok: true };
  });

export const getLatestPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbols: z.array(sym).min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMfa(context);
    const { withOwner } = await import("./tiger.server");
    const { getLatest } = await import("./marketdata.server");
    return run(() => withOwnerRaw(withOwner, context.userId, (tx) => getLatest(tx, [...new Set(data.symbols)])));
  });

export const getDailyBars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbol: sym, days: z.number().int().min(5).max(1825) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMfa(context);
    const { withOwner } = await import("./tiger.server");
    const { syncDailyBars } = await import("./marketdata.server");
    return run(() => withOwnerRaw(withOwner, context.userId, (tx) => syncDailyBars(tx, data.symbol, data.days)));
  });

/** withOwner masks errors as "Database request failed"; keep Alpaca errors distinguishable. */
async function withOwnerRaw<T>(withOwner: typeof import("./tiger.server").withOwner, owner: string, fn: Parameters<typeof withOwner<T>>[1]) {
  let alpacaErr: unknown;
  try {
    return await withOwner(owner, async (tx) => {
      try { return await fn(tx); } catch (e) { alpacaErr = e; throw e; }
    });
  } catch (e) {
    throw alpacaErr ?? e;
  }
}
