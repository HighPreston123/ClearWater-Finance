import { createServerFn } from "@tanstack/react-start";
import { requireAuthWithMfa } from "@/lib/mfa-middleware";
import type { ServiceResult } from "@/services/types";
import type { AdvisorRecord, ReferenceDiagnostics } from "@/lib/reference.server";

export const listAdvisorRecords = createServerFn({ method: "GET" })
  .middleware([requireAuthWithMfa])
  .handler(async ({ context }): Promise<ServiceResult<AdvisorRecord[]>> => {
    const { readAdvisors } = await import("@/lib/reference.server");
    try {
      return { status: "ok", data: await readAdvisors(context.supabase), source: "database", fetchedAt: new Date().toISOString() } as ServiceResult<AdvisorRecord[]>;
    } catch {
      return { status: "error", message: "Advisor directory is unavailable right now." };
    }
  });

export const getReferenceDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireAuthWithMfa])
  .handler(async ({ context }): Promise<ServiceResult<ReferenceDiagnostics>> => {
    const { readDiagnostics } = await import("@/lib/reference.server");
    try {
      return { status: "ok", data: await readDiagnostics(context.supabase), source: "database", fetchedAt: new Date().toISOString() } as ServiceResult<ReferenceDiagnostics>;
    } catch {
      return { status: "error", message: "Diagnostics are unavailable right now." };
    }
  });
