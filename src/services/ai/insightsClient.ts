import { FEATURES } from "@/config/features";
import { notConfigured, type ServiceResult } from "@/services/types";
import type { InsightsRequest, InsightsResponse } from "./types";

/**
 * Future: POST /api/insights (server route holds the AI provider key).
 * Not called until FEATURES.aiInsights is enabled and the route exists.
 */
export async function requestInsights(_req: InsightsRequest): Promise<ServiceResult<InsightsResponse>> {
  if (!FEATURES.aiInsights) return notConfigured("AI explanations");
  return notConfigured("AI explanations");
}
