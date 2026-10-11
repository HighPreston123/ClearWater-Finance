import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computePortfolioRisk, type PortfolioRiskResult, type PriceSeries } from "@/lib/risk/portfolioRisk";

const sym = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.]{0,9}$/);
export const BENCHMARK = "SPY";

/** Pulls Alpaca daily bars (cached in TigerData) for the given positions + SPY, then runs the pure engine. */
export const getPortfolioRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ positions: z.array(z.object({ symbol: sym, marketValue: z.number().finite() })).min(1).max(40), days: z.number().int().min(60).max(1095).default(365) }).parse(d))
  .handler(async ({ data, context }): Promise<{ status: "ok"; result: PortfolioRiskResult } | { status: "error"; message: string }> => {
    const { assertMfa } = await import("./mfa.server");
    await assertMfa(context);
    const { withOwner } = await import("./tiger.server");
    const { syncDailyBars } = await import("./marketdata.server");
    const symbols = [...new Set(data.positions.map((p) => p.symbol))];
    const series: PriceSeries[] = [];
    let benchmark: PriceSeries | null = null;
    let firstError: string | null = null;
    for (const s of [...symbols, BENCHMARK]) {
      try {
        const r = await withOwner(context.userId, (tx) => syncDailyBars(tx, s, data.days));
        const ps = { symbol: s, points: r.bars.map((b) => ({ date: b.t, close: b.c })) };
        if (s === BENCHMARK && !symbols.includes(s)) benchmark = ps; else series.push(ps);
        if (s === BENCHMARK && symbols.includes(s)) benchmark = ps;
      } catch (e) {
        firstError ??= e instanceof Error ? e.message : "Market data request failed.";
      }
    }
    if (!series.length) return { status: "error", message: firstError ?? "No market data available." };
    return { status: "ok", result: computePortfolioRisk(data.positions, series, { benchmark }) };
  });
