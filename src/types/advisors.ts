export type AdvisorFocus = "budgeting" | "debt_management" | "emergency_savings" | "retirement_planning" | "investment_education";
export const FOCUS_LABELS: Record<AdvisorFocus, string> = {
  budgeting: "Budgeting",
  debt_management: "Debt management",
  emergency_savings: "Emergency savings",
  retirement_planning: "Retirement planning",
  investment_education: "Investment education",
};

export interface AdvisorProfile {
  id: string;
  name: string;
  description: string;
  focusAreas: AdvisorFocus[];
  supportedNeeds: string[];
  meetingFormat?: "virtual" | "in_person" | "hybrid";
  contactUrl?: string;
  source: "sample" | "nessie";
  isFictional: boolean;
}

export type AdvisorMatchStatus = "not_configured" | "insufficient_data" | "no_match" | "matched";

export interface AdvisorMatch {
  status: AdvisorMatchStatus;
  recommendedAdvisorId: string | null;
  matchReasons: string[];
  factorsUsed: string[];
  missingInformation: string[];
  methodologyVersion: string | null;
  message: string;
}
