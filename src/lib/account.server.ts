import postgres from "postgres";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Removes every TigerData row owned by `ownerId` in one transaction.
 * Runs as the connecting role (fin_app has no DELETE on some owner tables, e.g. the locked quiz),
 * so every statement carries an explicit user_id filter. ownerId must come from the verified session.
 */
export async function deleteOwnerTigerData(ownerId: string): Promise<void> {
  if (!UUID.test(ownerId)) throw new Error("Unauthorized: invalid owner");
  const url = process.env["TIGER_DATABASE_URL"];
  if (!url) throw new Error("not_configured: TIGER_DATABASE_URL is not set");
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false, connect_timeout: 10, idle_timeout: 5, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      await tx`DELETE FROM fin.transaction_category_overrides WHERE user_id = ${ownerId}`;
      await tx`DELETE FROM fin.transactions WHERE user_id = ${ownerId}`; // trigger clears txn_activity
      await tx`DELETE FROM fin.txn_activity WHERE user_id = ${ownerId}`;
      await tx`DELETE FROM fin.analytics_dirty_days WHERE user_id = ${ownerId}`;
      await tx`DELETE FROM fin.wellness_score_history WHERE user_id = ${ownerId}`;
      await tx`DELETE FROM fin.investment_holdings WHERE user_id = ${ownerId}`;
      await tx`DELETE FROM fin.financial_accounts WHERE user_id = ${ownerId}`;
      await tx`DELETE FROM fin.recurring_overrides WHERE user_id = ${ownerId}`;
      await tx`DELETE FROM fin.user_settings WHERE user_id = ${ownerId}`;
      await tx`DELETE FROM fin.onboarding_quiz WHERE user_id = ${ownerId}`;
      await tx`DELETE FROM fin.user_profiles WHERE auth_user_id = ${ownerId}`;
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.error("[account] tiger delete failed", err.code ?? "", String(err.message ?? "").replace(/postgres(ql)?:\/\/\S+/g, "[redacted]"));
    throw new Error("Could not delete your saved financial data");
  } finally {
    await sql.end({ timeout: 2 });
  }
}
