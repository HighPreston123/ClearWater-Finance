import { useState } from "react";
import { Sparkles } from "lucide-react";
import { GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/config/features";
import type { AIInsightsState } from "@/services/ai/types";

/** Placeholder. Future AI explains computed results only — no new math, risk ratings, or competing recommendation. */
export function AIInsightsPanel() {
  const [state] = useState<AIInsightsState>(FEATURES.aiInsights ? { status: "ready" } : { status: "not_configured" });
  return (
    <GlassCard>
      <CardTitle right={<StatusBadge tone="off">Not connected</StatusBadge>}>
        <Sparkles className="h-4 w-4 text-primary" aria-hidden /> AI insights
      </CardTitle>
      {state.status === "not_configured" && <p className="text-sm">AI analysis is not connected yet.</p>}
      {state.status === "loading" && <p className="text-sm">Generating explanation…</p>}
      {state.status === "success" && <p className="text-sm">{state.explanation}</p>}
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <Button variant="glass" size="sm" className="mt-3" disabled title="Available after an AI service is connected">Explain my numbers</Button>
      <Note>When connected, AI will only explain the numbers calculated here.</Note>
    </GlassCard>
  );
}
