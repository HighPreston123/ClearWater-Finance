import { AudioSummaryControls } from "@/components/integrations/AudioSummaryControls";
import { riskAudioText } from "@/lib/finance/pageAudioText";
import { createFileRoute } from "@tanstack/react-router";
import { useDerived } from "@/store/useDerived";
import { PageHeader } from "@/components/common/Glass";
import { FutureRiskPanel, FutureResultSections } from "@/components/risk/FutureRiskPanel";
import { CsvSettingsLink } from "@/components/common/CsvHelp";
import { PortfolioRiskCard } from "@/components/risk/PortfolioRiskCard";
import { RiskSurveyCard } from "@/components/risk/RiskSurveyCard";
import { FundamentalsCard } from "@/components/risk/FundamentalsCard";
import { RetirementSimulationCard } from "@/components/risk/RetirementSimulationCard";
import { WellnessScoreCard } from "@/components/risk/WellnessScoreCard";
import { AdvisorMatchCard } from "@/components/risk/AdvisorMatchCard";

export const Route = createFileRoute("/_authenticated/risk")({
  head: () => ({
    meta: [
      { title: "Future risk — Clearwater" },
      { name: "description", content: "Your Future Resilience Score: liquidity, cash flow, debt, goals and portfolio resilience." },
      { property: "og:title", content: "Future risk — Clearwater" },
      { property: "og:description", content: "Your Future Resilience Score: liquidity, cash flow, debt, goals and portfolio resilience." },
    ],
  }),
  component: Risk,
});

function Risk() {
  const { risk } = useDerived();
  return (
    <div className="space-y-6">
      <PageHeader title="Future risk" subtitle="Covers your whole financial situation, including investments — not just stocks." right={<AudioSummaryControls text={riskAudioText({ risk })} />} />
      <FutureRiskPanel risk={risk} />
      <WellnessScoreCard />
      <PortfolioRiskCard />
      <RiskSurveyCard />
      <FundamentalsCard />
      <RetirementSimulationCard />
      <AdvisorMatchCard />
      <CsvSettingsLink section="csv-risk-inputs" title="Your Future risk inputs" text="Emergency fund, cash reserves, debts, bills, goals, time horizon and risk comfort are loaded from a CSV in Settings." />
      <FutureResultSections />
    </div>
  );
}
