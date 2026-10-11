import { AudioSummaryControls } from "@/components/integrations/AudioSummaryControls";
import { ADVISORS_AUDIO_TEXT } from "@/lib/finance/pageAudioText";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/Glass";
import { AdvisorDirectory } from "@/components/advisors/AdvisorDirectory";

export const Route = createFileRoute("/_authenticated/advisors")({
  head: () => ({
    meta: [
      { title: "Advisor directory — Clearwater" },
      { name: "description", content: "Advisors recommended for your current goals, plus a searchable directory of every advisor." },
      { property: "og:title", content: "Advisor directory — Clearwater" },
      { property: "og:description", content: "Advisors recommended for your current goals, plus a searchable directory of every advisor." },
    ],
  }),
  component: Advisors,
});

function Advisors() {
  return (
    <div className="space-y-6">
      <PageHeader title="Advisor directory" subtitle="Advisors whose specialties fit your current focus, plus everyone in the directory." right={<AudioSummaryControls text={ADVISORS_AUDIO_TEXT} />} />
      <AdvisorDirectory />
    </div>
  );
}
