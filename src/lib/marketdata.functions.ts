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
    const { check } = await import("./db.server");
    const rows = check(await context.supabase.from("fin_watchlist").select("symbol").eq("user_id", context.userId).order("added_at"), "watchlist_read") ?? [];
    return rows.map((r) => r.symbol);
  });

export const setWatchSymbol = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbol: sym, add: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMfa(context);
    const { check } = await import("./db.server");
    const db = context.supabase;
    if (data.add) {
      const { count, error } = await db.from("fin_watchlist").select("symbol", { count: "exact", head: true }).eq("user_id", context.userId);
      check({ data: null, error }, "watchlist_count");
      if ((count ?? 0) >= 25) throw new Error("Watchlist limit");
      check(await db.from("fin_watchlist").upsert({ user_id: context.userId, symbol: data.symbol }, { onConflict: "user_id,symbol", ignoreDuplicates: true }), "watchlist_add");
    } else {
      check(await db.from("fin_watchlist").delete().eq("user_id", context.userId).eq("symbol", data.symbol), "watchlist_remove");
    }
    return { ok: true };
  });

export const getLatestPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbols: z.array(sym).min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMfa(context);
    const { getLatest } = await import("./marketdata.server");
    return run(() => getLatest(context.supabase, [...new Set(data.symbols)]));
  });

export const getDailyBars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ symbol: sym, days: z.number().int().min(5).max(1825) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMfa(context);
    const { syncDailyBars } = await import("./marketdata.server");
    return run(() => syncDailyBars(context.supabase, data.symbol, data.days));
  });
