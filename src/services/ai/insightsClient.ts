import { explainOverview, type ExplainResult } from "@/lib/insights.functions";
import type { InsightPayload } from "@/lib/insights/payload";

/** Calls the server function; the Gemini key never reaches the browser. */
export function requestInsights(payload: InsightPayload): Promise<ExplainResult> {
  return explainOverview({ data: payload });
}
