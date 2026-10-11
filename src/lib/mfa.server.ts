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

/**
 * Read-only variant: runs the MFA check and the owner-scoped read concurrently so the auth round trip
 * overlaps the database round trip. Nothing is returned unless the MFA check passes. Writes must keep
 * calling assertMfa before touching data.
 */
export async function withMfaRead<T>(context: unknown, read: () => Promise<T>): Promise<T> {
  const [, data] = await Promise.all([assertMfa(context), read()]);
  return data;
}
