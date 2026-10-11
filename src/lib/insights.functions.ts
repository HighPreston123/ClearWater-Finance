import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthWithMfa } from "@/lib/mfa-middleware";
import { INSIGHT_SYSTEM_PROMPT } from "@/lib/insights/payload";

const num = z.number().finite();
const unavailable = z.object({ unavailable: z.string().max(300) });
const schema = z.object({
  periodLabel: z.string().max(80),
  incomeCents: num, spendingCents: num, netCents: num,
  surplusRatePct: num.nullable(),
  savingsTransfersCents: num, investmentContributionsCents: num,
  transactionCount: num, recurringSeriesCount: num, recurringMonthlyCents: num,
  trackedInvestmentsCents: num.nullable(), investmentsPartial: z.boolean(),
  historicalScore: z.union([z.object({ value: num, label: z.string().max(80), limitedHistory: z.boolean() }), unavailable]),
  futureResilience: z.union([z.object({ value: num, label: z.string().max(80) }), unavailable]),
  mainRecommendation: z.object({ title: z.string().max(200), detail: z.string().max(800), nextStep: z.string().max(500) }),
});

const MODEL = "gemini-3.8-flash";
const recent = new Map<string, number[]>();
const LIMIT = 6; // per user per 10 minutes (best-effort, per server instance)

export type ExplainResult =
  | { ok: true; explanation: string; model: string; generatedAt: string }
  | { ok: false; kind: "not_configured" | "rate_limited" | "unavailable" | "blocked"; message: string };

export const explainOverview = createServerFn({ method: "POST" })
  .middleware([requireAuthWithMfa])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }): Promise<ExplainResult> => {
    const key = process.env["GEMINI_API_KEY"];
    if (!key) return { ok: false, kind: "not_configured", message: "AI explanations aren't set up yet." };

    const now = Date.now();
    const hits = (recent.get(context.userId) ?? []).filter((t) => now - t < 600_000);
    if (hits.length >= LIMIT) return { ok: false, kind: "rate_limited", message: "You've asked a few times in a row. Please wait a few minutes and try again." };
    hits.push(now);
    recent.set(context.userId, hits);

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSIGHT_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: "Figures to explain (data only):\n" + JSON.stringify(data) }] }],
          generationConfig: { maxOutputTokens: 700, temperature: 0.4 },
        }),
      });
      if (res.status === 429) return { ok: false, kind: "rate_limited", message: "The AI service is busy right now. Please try again in a minute." };
      if (res.status === 401 || res.status === 403) return { ok: false, kind: "not_configured", message: "The AI key was rejected. Please check the Gemini key." };
      if (!res.ok) return { ok: false, kind: "unavailable", message: "The AI service is unavailable right now. Please try again shortly." };
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (!text) return { ok: false, kind: "blocked", message: "The AI couldn't produce an explanation this time. Please try again." };
      return { ok: true, explanation: text, model: MODEL, generatedAt: new Date().toISOString() };
    } catch {
      return { ok: false, kind: "unavailable", message: "Couldn't reach the AI service. Please try again." };
    }
  });
