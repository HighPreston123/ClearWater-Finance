import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * requireSupabaseAuth + the two-factor rule: if the account has a verified authenticator,
 * the session must have passed the code step (aal2) before the handler runs.
 */
export const requireAuthWithMfa = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { assertMfa } = await import("./mfa.server");
    await assertMfa(context);
    return next();
  });
