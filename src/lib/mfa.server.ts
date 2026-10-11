type Ctx = { userId: string; claims: Record<string, unknown>; supabase: { auth: { getUser(jwt?: string): Promise<{ data: { user: { factors?: { status: string }[] } | null } }> } } };

/** If the user has a verified MFA factor, the session must be at aal2. */
export async function assertMfa(context: unknown) {
  const c = context as Ctx;
  if (c.claims["aal"] === "aal2") return;
  const { getRequest } = await import("@tanstack/react-start/server");
  const token = getRequest()?.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data } = await c.supabase.auth.getUser(token);
  if (!data.user) throw new Error("Unauthorized");
  if (data.user.factors?.some((f) => f.status === "verified")) {
    throw new Error("MFA required: complete two-factor verification");
  }
}
