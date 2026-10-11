/** Shared result envelope. Stubs return not_configured — never fake success. */
export type ServiceResult<T> =
  | { status: "not_configured"; message: string }
  | { status: "ok"; data: T; source: string; fetchedAt: string }
  | { status: "error"; message: string };

export const notConfigured = (service: string): { status: "not_configured"; message: string } => ({
  status: "not_configured",
  message: `${service} is not connected yet.`,
});
