import { createServerFn } from "@tanstack/react-start";
import { requireAuthWithMfa } from "@/lib/mfa-middleware";
import type { ServiceResult } from "@/services/types";

/**
 * Authenticated server functions for the Nessie background banking layer.
 * The API key never leaves the server; the browser only receives mapped data
 * plus source/freshness metadata. Errors are returned, never thrown into the UI.
 */
export const getNessieStatus = createServerFn({ method: "GET" })
  .middleware([requireAuthWithMfa])
  .handler(async (): Promise<{ configured: boolean; reachable: boolean }> => {
    const { probeNessie } = await import("@/services/transactions/nessie.server");
    return probeNessie();
  });

export const getNessieOverview = createServerFn({ method: "GET" })
  .middleware([requireAuthWithMfa])
  .handler(async (): Promise<ServiceResult<Awaited<ReturnType<typeof import("@/services/transactions/nessie.server").fetchNessieOverview>>>> => {
    const { fetchNessieOverview, NessieNotConfiguredError } = await import("@/services/transactions/nessie.server");
    try {
      const data = await fetchNessieOverview();
      return { status: "ok", data, source: "nessie", fetchedAt: new Date().toISOString() };
    } catch (e) {
      if (e instanceof NessieNotConfiguredError) {
        return { status: "not_configured", message: "Nessie is not connected yet." };
      }
      return { status: "error", message: "Nessie data is unavailable right now." };
    }
  });

export const getNessieAdvisorRecords = createServerFn({ method: "GET" })
  .middleware([requireAuthWithMfa])
  .handler(async (): Promise<ServiceResult<Awaited<ReturnType<typeof import("@/services/transactions/nessie.server").fetchNessieAdvisorRecords>>>> => {
    const { fetchNessieAdvisorRecords, NessieNotConfiguredError } = await import("@/services/transactions/nessie.server");
    try {
      const data = await fetchNessieAdvisorRecords();
      return { status: "ok", data, source: "nessie", fetchedAt: new Date().toISOString() };
    } catch (e) {
      if (e instanceof NessieNotConfiguredError) {
        return { status: "not_configured", message: "Nessie is not connected yet." };
      }
      return { status: "error", message: "Nessie advisor profiles are unavailable right now." };
    }
  });
