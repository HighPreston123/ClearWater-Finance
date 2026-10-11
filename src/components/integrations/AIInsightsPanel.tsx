import { useState } from "react";
import { Sparkles } from "lucide-react";
import { GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/config/features";
import { requestInsights } from "@/services/ai/insightsClient";
import type { InsightPayload } from "@/lib/insights/payload";
import type { AIInsightsState } from "@/services/ai/types";

/** Gemini explains the already-computed numbers only — no new math, risk ratings, or competing recommendation. */
export function AIInsightsPanel({ payload }: { payload?: InsightPayload }) {
  const [state, setState] = useState<AIInsightsState>(FEATURES.aiInsights ? { status: "ready" } : { status: "not_configured" });
  const [last, setLast] = useState<Extract<AIInsightsState, { status: "success" }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!payload) return;
    setError(null);
    setState({ status: "loading" });
    try {
      const r = await requestInsights(payload);
      if (r.ok) {
        const ok = { status: "success" as const, explanation: r.explanation, generatedAt: r.generatedAt, model: r.model };
        setLast(ok); setState(ok);
      } else {
        setError(r.message);
        setState(last ?? { status: "ready" });
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setState(last ?? { status: "ready" });
    }
  }

  const loading = state.status === "loading";
  const shown = state.status === "success" ? state : last;
  return (
    <GlassCard>
      <CardTitle right={<StatusBadge tone={FEATURES.aiInsights ? "info" : "off"}>{FEATURES.aiInsights ? "AI-generated" : "Not connected"}</StatusBadge>}>
        <Sparkles className="h-4 w-4 text-primary" aria-hidden /> AI insights
      </CardTitle>
      {state.status === "not_configured" && <p className="text-sm">AI analysis is not connected yet.</p>}
      {state.status === "ready" && !shown && <p className="text-sm text-muted-foreground">Get a plain-language explanation of the numbers on this page.</p>}
      {loading && <p className="text-sm" role="status">Generating explanation…</p>}
      {shown && !loading && (
        <div className="whitespace-pre-line text-sm" aria-live="polite">
          {shown.explanation.replace(/\*\*/g, "")}
        </div>
      )}
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}{shown ? " Your previous explanation is shown above." : ""}
        </p>
      )}
      <Button variant="glass" size="sm" className="mt-3" disabled={!FEATURES.aiInsights || !payload || loading} onClick={run}>
        {loading ? "Working…" : error ? "Try again" : shown ? "Refresh explanation" : "Explain my numbers"}
      </Button>
      <Note>AI-generated explanation of the figures shown here. It can make mistakes and is not financial advice.</Note>
    </GlassCard>
  );
}
