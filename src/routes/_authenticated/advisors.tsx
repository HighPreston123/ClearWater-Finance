import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, GlassCard } from "@/components/common/Glass";
import { AdvisorDirectory } from "@/components/advisors/AdvisorDirectory";

export const Route = createFileRoute("/_authenticated/advisors")({
  head: () => ({
    meta: [
      { title: "Advisor directory — Clearwater" },
      { name: "description", content: "Browse fictional demo advisor profiles. Personalized matching coming later." },
      { property: "og:title", content: "Advisor directory — Clearwater" },
      { property: "og:description", content: "Browse fictional demo advisor profiles. Personalized matching coming later." },
    ],
  }),
  component: Advisors,
});

function Advisors() {
  return (
    <div className="space-y-6">
      <PageHeader title="Advisor directory" subtitle="Ten fictional demo advisors and their specialties." />
      <GlassCard><p className="text-sm">Personalized matching isn't available yet — no advisor has been selected for you. Nothing is booked or shared automatically.</p></GlassCard>
      <AdvisorDirectory />
    </div>
  );
}
