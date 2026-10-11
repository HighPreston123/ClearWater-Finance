import { createFileRoute } from "@tanstack/react-router";
import { useDerived } from "@/store/useDerived";
import { PageHeader } from "@/components/common/Glass";
import { FutureRiskPanel, FutureResultSections } from "@/components/risk/FutureRiskPanel";
import { RiskInputsForm } from "@/components/risk/RiskInputsForm";
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
      { name: "description", content: "Inputs for the upcoming future-risk analysis. No assessment is calculated yet." },
      { property: "og:title", content: "Future risk — Clearwater" },
      { property: "og:description", content: "Inputs for the upcoming future-risk analysis. No assessment is calculated yet." },
    ],
  }),
  component: Risk,
});

function Risk() {
  const { risk } = useDerived();
  return (
    <div className="space-y-6">
      <PageHeader title="Future risk" subtitle="Covers your whole financial situation, including investments — not just stocks." />
      <FutureRiskPanel risk={risk} />
      <WellnessScoreCard />
      <PortfolioRiskCard />
      <RiskSurveyCard />
      <FundamentalsCard />
      <RetirementSimulationCard />
      <AdvisorMatchCard />
      <RiskInputsForm />
      <FutureResultSections />
    </div>
  );
}
