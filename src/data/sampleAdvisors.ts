import type { AdvisorProfile } from "@/types/advisors";

/** FICTIONAL demo profiles. No credentials are implied; these are not real or verified professionals. */
export const SAMPLE_ADVISORS: AdvisorProfile[] = [
  { id: "adv-demo-1", name: "Maya Brooks (fictional)", description: "Demo profile focused on building a first budget and spending plan.", focusAreas: ["budgeting", "emergency_savings"], supportedNeeds: ["Negative cash flow", "First budget"], meetingFormat: "virtual", source: "sample", isFictional: true },
  { id: "adv-demo-2", name: "Daniel Okafor (fictional)", description: "Demo profile focused on organizing and paying down debt.", focusAreas: ["debt_management", "budgeting"], supportedNeeds: ["Multiple debts", "High-interest balances"], meetingFormat: "hybrid", source: "sample", isFictional: true },
  { id: "adv-demo-3", name: "Priya Raman (fictional)", description: "Demo profile focused on retirement accounts and long-term saving.", focusAreas: ["retirement_planning", "investment_education"], supportedNeeds: ["401(k) and IRA questions", "Long time horizon"], meetingFormat: "virtual", source: "sample", isFictional: true },
  { id: "adv-demo-4", name: "Sam Whitaker (fictional)", description: "Demo profile focused on investing basics and diversification concepts.", focusAreas: ["investment_education"], supportedNeeds: ["New investor", "Understanding funds"], meetingFormat: "in_person", source: "sample", isFictional: true },
];
