import type { Db } from "@/lib/db.server";

/**
 * Removes every financial-data row owned by the caller in one database transaction (fin_delete_my_data).
 * The owner is auth.uid() from the caller's verified session — no id is passed in.
 */
export async function deleteOwnerFinancialData(db: Db): Promise<void> {
  const { error } = await db.rpc("fin_delete_my_data");
  if (error) {
    console.error("[account] data delete failed", error.code ?? "", error.message ?? "");
    throw new Error("Could not delete your saved financial data");
  }
}
