import { explainOverview } from "@/lib/insights.functions";
import type { InsightPayload } from "@/lib/insights/payload";
import type { ServiceResult } from "@/services/types";
import type { InsightsResponse } from "./types";

/** Calls the server function; the Gemini key never reaches the browser. */
export async function requestInsights(payload: InsightPayload): Promise<ServiceResult<InsightsResponse> | { status: "error"; message: string }> {
  const r = await explainOverview({ data: payload });
  if (r.ok) return { status: "ok", data: { explanation: r.explanation, model: r.model, generatedAt: r.generatedAt } } as never;
  return { status: "error", message: r.message };
}
