import type { AdvisorMatch, AdvisorProfile } from "@/types/advisors";
import type { ScoreResult } from "@/lib/finance/score";
import type { RiskAssessment } from "@/types/risk";
import type { ProfileImprovementAction } from "@/lib/finance/profileImprovementActions";

export interface MatchInput {
  score: ScoreResult;
  risk: RiskAssessment;
  goals: { label: string }[];
  preferences: { meetingFormat?: AdvisorProfile["meetingFormat"] };
  advisors: AdvisorProfile[];
  negativeFactors: ProfileImprovementAction[];
}

/**
 * Matching rules are defined later by the team. Until then: not_configured.
 * Never picks randomly; never treats missing risk as zero risk.
 */
export function matchAdvisor(input: MatchInput): AdvisorMatch {
  const missing: string[] = [];
  if (input.risk.status !== "ready") missing.push("Future-risk assessment (methodology pending)");
  if (!input.advisors.length) missing.push("Advisor profiles");
  return {
    status: "not_configured",
    recommendedAdvisorId: null,
    matchReasons: [],
    factorsUsed: [],
    missingInformation: missing,
    methodologyVersion: null,
    message: "Personalized advisor matching isn't available yet. You can browse the directory.",
  };
}
