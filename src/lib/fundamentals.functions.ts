import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FundamentalsResult } from "@/lib/edgar.server";

/** SEC EDGAR fundamentals for the given holding symbols (cached 24h in TigerData). */
export const getFundamentals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ symbols: z.array(z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.]{0,9}$/)).min(1).max(40) }).parse(d))
  .handler(async ({ data, context }): Promise<{ status: "ok"; results: FundamentalsResult[] }> => {
    const { assertMfa } = await import("./mfa.server");
    await assertMfa(context);
    const { withOwner } = await import("./tiger.server");
    const { getCompanyFundamentals } = await import("./edgar.server");
    const symbols = [...new Set(data.symbols)];
    const results: FundamentalsResult[] = [];
    for (const s of symbols) {
      results.push(await withOwner(context.userId, (tx) => getCompanyFundamentals(tx, s)));
    }
    return { status: "ok", results };
  });
