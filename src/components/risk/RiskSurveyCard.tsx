import { useEffect, useState } from "react";
import { GlassCard } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { SURVEY_QUESTIONS, type SurveyAnswers, type TargetProfile } from "@/lib/risk/survey";
import { getRiskSurvey, saveRiskSurvey } from "@/lib/riskSurvey.functions";
import { publishRiskResult } from "@/lib/risk/resultsStore";
import { toast } from "sonner";

const VOLATILITY_LABELS: Record<string, string> = {
  very_low: "Very low", low: "Low", moderate: "Moderate", high: "High", very_high: "Very high",
};
const LIQUIDITY_LABELS: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

export function RiskSurveyCard() {
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [target, setTarget] = useState<TargetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRiskSurvey()
      .then((state) => {
        if (cancelled) return;
        setAnswers(state.answers);
        setTarget(state.targetProfile);
        publishRiskResult("surveyAnswers", state.answers);
        publishRiskResult("targetProfile", state.targetProfile);
      })
      .catch(() => !cancelled && toast.error("Could not load your assessment survey."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const answered = SURVEY_QUESTIONS.filter((q) => answers[q.id]).length;

  async function save() {
    setSaving(true);
    try {
      const result = await saveRiskSurvey({ data: { answers } });
      setTarget(result.targetProfile);
      publishRiskResult("surveyAnswers", answers);
      publishRiskResult("targetProfile", result.targetProfile);
      toast.success(result.missing.length ? `Saved — ${result.missing.length} question(s) still unanswered.` : "Assessment survey saved.");
    } catch {
      toast.error("Could not save the survey. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Financial assessment survey</h2>
        <p className="text-sm text-muted-foreground">
          Your circumstances, goals, and constraints. You can update these answers at any time — “unsure” answers are
          left unknown rather than treated as zero. {answered}/{SURVEY_QUESTIONS.length} answered.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your answers…</p>
      ) : (
        <div className="space-y-5">
          {SURVEY_QUESTIONS.map((question) => (
            <fieldset key={question.id} className="space-y-2">
              <legend className="text-sm font-medium">{question.text}</legend>
              <div className="flex flex-wrap gap-2">
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background/40 text-foreground hover:border-primary/60"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <Button onClick={save} disabled={saving || answered === 0}>
            {saving ? "Saving…" : "Save survey"}
          </Button>

          {target && (
            <div className="rounded-lg border border-border bg-background/40 p-4 text-sm">
              <p className="font-medium">Your target profile (from your answers)</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Investment horizon: {target.horizonYears !== null ? `~${target.horizonYears} years` : "Unknown"}</li>
                <li>Plan sustainable through age: {target.planningHorizonAge ?? "Unknown"}</li>
                <li>Preferred volatility: {target.preferredVolatility ? VOLATILITY_LABELS[target.preferredVolatility] : "Unknown"}</li>
                <li>Liquidity need: {target.liquidityNeed ? LIQUIDITY_LABELS[target.liquidityNeed] : "Unknown"}</li>
                <li>
                  Max financially absorbable loss:{" "}
                  {target.maxTolerableLoss !== null ? `${Math.round(target.maxTolerableLoss * 100)}%` : "Unknown"}
                </li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                This describes what you want and are comfortable with — it is separate from your actual portfolio
                measurements and does not prove your current portfolio is suitable.
              </p>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
