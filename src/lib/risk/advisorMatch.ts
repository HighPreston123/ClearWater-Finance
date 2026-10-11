import type { SurveyAnswers } from "@/lib/risk/survey";

/**
 * Advisor matching. Derives the user's relevant financial-category codes from
 * their survey answers, then ranks advisors by shared categories (an advisor's
 * primary category counts double). Deterministic and transparent: an advisor
 * with no shared category is never shown, and nothing is scored that the user
 * did not answer.
 */

export interface AdvisorRecord {
  id: string;
  fullName: string;
  title: string;
  biography: string;
  experience: string;
  education: string | null;
  certifications: string[];
  strengths: string[];
  advisoryStyle: string;
  bestSuitedFor: string[];
  meetingFormat: "virtual" | "in_person" | "hybrid" | null;
  categories: { code: string; role: "primary" | "secondary" }[];
}

export interface AdvisorMatch {
  advisor: AdvisorRecord;
  /** Shared category codes, primary-role matches first. */
  sharedCategories: string[];
  /** 2 per shared primary category, 1 per shared secondary. */
  score: number;
}

/**
 * Maps survey answers to shared category codes. Only answers the user actually
 * gave contribute; "unsure"/"prefer not to say" map to nothing.
 */
export function deriveUserCategories(answers: SurveyAnswers): string[] {
  const cats = new Set<string>();
  const a = (id: string) => answers[id];

  // Debt load → debt management
  if (a("s09_total_debt") && ["s09_b", "s09_c", "s09_d", "s09_e"].includes(a("s09_total_debt")!)) cats.add("debt_management");

  // Thin liquid savings vs essential expenses → emergency funds + saving
  const savingsAnswer = a("s08_liquid_savings");
  const savingsIdx = savingsAnswer ? savingsAnswer.charCodeAt(savingsAnswer.length - 1) - 97 : -1;
  if (savingsIdx >= 0 && savingsIdx <= 2) cats.add("emergency_funds").add("saving");

  // Employment instability → cash flow
  if (a("s04_employment_status") === "s04_b" || a("s04_employment_status") === "s04_c") cats.add("cash_flow");
  if (a("s12_income_change") === "s12_a" || a("s12_income_change") === "s12_b") cats.add("cash_flow");

  // Retirement intent / horizon → retirement + long-term planning
  if (a("s02_retirement_age") && a("s02_retirement_age") !== "s02_g") cats.add("retirement_planning");
  if (a("s03_planning_horizon") && a("s03_planning_horizon") !== "s03_f") cats.add("long_term_planning");

  // Dependable income sources → retirement planning reinforcement
  if (a("s10_dependable_income") === "s10_b" || a("s10_dependable_income") === "s10_c") cats.add("retirement_planning");

  // Loss capacity & near-term reliance → risk management / investing
  const loss = a("s13_max_financial_loss");
  if (loss === "s13_a" || loss === "s13_b") cats.add("risk_management");
  if (loss && ["s13_c", "s13_d", "s13_e", "s13_f"].includes(loss)) cats.add("investing");
  if (a("s14_near_term_reliance") === "s14_a" || a("s14_near_term_reliance") === "s14_b") cats.add("risk_management").add("cash_flow");

  // Higher income with room to grow → wealth building
  if (a("s05_gross_income") === "s05_d" || a("s05_gross_income") === "s05_e") cats.add("wealth_building");

  // Retirement spending expectations set → goal setting
  if (a("s11_retirement_spending") && a("s11_retirement_spending") !== "s11_f") cats.add("goal_setting");

  return [...cats].sort();
}

/** Ranks advisors by shared categories; advisors with none are excluded. */
export function rankAdvisors(advisors: AdvisorRecord[], userCategories: string[], limit = 5): AdvisorMatch[] {
  const wanted = new Set(userCategories);
  const matches: AdvisorMatch[] = [];
  for (const advisor of advisors) {
    const primary = advisor.categories.filter((c) => c.role === "primary" && wanted.has(c.code)).map((c) => c.code);
    const secondary = advisor.categories.filter((c) => c.role === "secondary" && wanted.has(c.code)).map((c) => c.code);
    if (!primary.length && !secondary.length) continue;
    matches.push({
      advisor,
      sharedCategories: [...primary.sort(), ...secondary.sort()],
      score: primary.length * 2 + secondary.length,
    });
  }
  return matches
    .sort((x, y) => y.score - x.score || y.sharedCategories.length - x.sharedCategories.length || x.advisor.fullName.localeCompare(y.advisor.fullName))
    .slice(0, limit);
}
