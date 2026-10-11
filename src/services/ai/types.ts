import type { InsightContext } from "@/lib/finance/buildInsightContext";

export type AIInsightsState =
  | { status: "not_configured" }
  | { status: "ready" }
  | { status: "loading" }
  | { status: "success"; explanation: string; generatedAt: string; model: string }
  | { status: "error"; message: string };

/** Body of future POST /api/insights. Provider-agnostic. */
export interface InsightsRequest {
  context: InsightContext;
}
export interface InsightsResponse {
  explanation: string;
  model: string;
  generatedAt: string;
}
