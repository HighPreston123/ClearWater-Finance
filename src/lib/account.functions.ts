import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently deletes the signed-in user's own account. The user id comes only from the
 * verified session. Order: financial data → backup copy/profile → login, so a failure never
 * leaves a login-less orphan; any error is returned and nothing claims success.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await (await import("./mfa.server")).assertMfa(context);
    const { deleteOwnerTigerData } = await import("./account.server");
    await deleteOwnerTigerData(userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await supabaseAdmin.from("user_state").delete().eq("user_id", userId);
    if (s.error) throw new Error("Could not delete your saved backup data");
    const p = await supabaseAdmin.from("profiles").delete().eq("id", userId);
    if (p.error) throw new Error("Could not delete your profile");
    const a = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (a.error) throw new Error("Could not delete your login");
    return { ok: true as const };
  });
