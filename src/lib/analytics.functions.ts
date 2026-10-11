import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AnalyticsResult } from "./analytics.server";

/**
 * Authenticated analytics endpoints. Owner id always comes from the verified session;
 * MFA (aal2) is enforced when the user has a verified factor.
 */
const guard = async (context: unknown) => (await import("./mfa.server")).assertMfa(context);

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AnalyticsResult> => {
    const { withMfaRead } = await import("./mfa.server");
    const { getAnalytics: run } = await import("./analytics.server");
    return JSON.parse(JSON.stringify(await withMfaRead(context, () => run(context.supabase))));
  });

export const refreshAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    const { afterTransactionsChanged } = await import("./analytics.server");
    await afterTransactionsChanged(context.supabase);
    return { ok: true as const };
  });

export const demoAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ action: z.enum(["load", "reset"]) }).parse(input))
  .handler(async ({ data, context }) => {
    await guard(context);
    const m = await import("./analytics.server");
    if (data.action === "load") return { ok: true as const, changed: (await m.loadDemo(context.supabase, context.userId)).inserted };
    return { ok: true as const, changed: (await m.resetDemo(context.supabase, context.userId)).removed };
  });
