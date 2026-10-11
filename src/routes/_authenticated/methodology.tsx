import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassCard, CardTitle, PageHeader, Note } from "@/components/common/Glass";
import { PILLAR_WEIGHTS, RESILIENCE_VERSION } from "@/lib/risk/resilience";

export const Route = createFileRoute("/_authenticated/methodology")({
  head: () => ({
    meta: [
      { title: "Score methodology — Clearwater" },
      { name: "description", content: "How Clearwater's Future Resilience Score is calculated, how missing data is handled, and how comparisons work." },
      { property: "og:title", content: "Score methodology — Clearwater" },
      { property: "og:description", content: "How Clearwater's Future Resilience Score is calculated and compared." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Methodology,
});

const PILLARS: { id: keyof typeof PILLAR_WEIGHTS; label: string; text: string }[] = [
  { id: "liquidity", label: "Liquidity and runway", text: "How many months of essential spending your cash could cover, and how full your emergency fund is versus its target. 6+ months scores near the top." },
  { id: "cashflow", label: "Cash flow and income stability", text: "Your savings rate, how much your income varies, how often you spend more than you earn, and how much of your income is already committed to recurring bills." },
  { id: "debt", label: "Debt burden", text: "Debt compared to your cash and investments, debt payments compared to income, and the average interest rate you pay." },
  { id: "goals", label: "Goal and retirement progress", text: "Your retirement simulation result, whether your savings goals are on track, and whether bills due in the next 12 months are covered." },
  { id: "portfolio", label: "Portfolio resilience", text: "How a market drop compares to the loss you said you can tolerate, and how concentrated your investments are." },
];

function Methodology() {
  return (
    <div className="space-y-6">
      <PageHeader title="Score methodology" subtitle={`Future Resilience Score · ${RESILIENCE_VERSION}`} />
      <GlassCard>
        <CardTitle>What the score is</CardTitle>
        <p className="text-sm">A 0–100 estimate of how well your finances could handle surprises and stay on track for your goals. Higher is more resilient. Bands: 80+ Strong, 60–79 Stable, 40–59 Vulnerable, under 40 At risk.</p>
        <p className="mt-2 text-sm text-muted-foreground">It's an educational wellness indicator — not financial, investment, lending, credit or tax advice, and it says nothing about your worth as a person.</p>
      </GlassCard>
      <GlassCard>
        <CardTitle>The five pillars</CardTitle>
        <div className="mb-4 flex h-4 overflow-hidden rounded-full" role="img" aria-label="Pillar weights">
          {PILLARS.map((p, i) => (
            <div key={p.id} className={i % 2 ? "bg-primary/60" : "bg-primary"} style={{ width: `${PILLAR_WEIGHTS[p.id] * 100}%` }} title={p.label} />
          ))}
        </div>
        <ul className="space-y-3">
          {PILLARS.map((p) => (
            <li key={p.id} className="rounded-2xl border bg-card p-3">
              <p className="text-sm font-semibold">{p.label} — {Math.round(PILLAR_WEIGHTS[p.id] * 100)} points</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">Safety caps: if a serious warning sign appears (for example almost no cash runway), the score is capped no matter how strong the other pillars are.</p>
      </GlassCard>
      <GlassCard>
        <CardTitle>Missing data</CardTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Missing information is never counted as zero and never assumed to be bad.</li>
          <li>Unknown measures are left out and the remaining ones in that pillar are reweighted.</li>
          <li>If less than 60% of the total weight can be scored, no number is shown.</li>
          <li>A confidence label (High / Medium / Low) and a range show how much of the score rests on real data.</li>
        </ul>
      </GlassCard>
      <GlassCard>
        <CardTitle>How comparisons work</CardTitle>
        <p className="text-sm">You're compared with 100 fictional sample profiles scored by exactly the same formula. Because those profiles only have monthly averages, some measures (income variability, interest rates, portfolio risk, goals) stay unknown for them and are handled with the same missing-data rules.</p>
        <p className="mt-2 text-sm">Your percentile is the share of the group scoring below you (ties count half). Only totals are shown — never names, IDs or individual scores. If fewer than 10 profiles can be scored, a warning appears.</p>
      </GlassCard>
      <Note><Link to="/risk" className="font-semibold text-primary hover:underline">Back to Future risk</Link></Note>
    </div>
  );
}
