/**
 * Extended financial assessment survey. Collects the circumstances, goals, and
 * constraints the onboarding quiz does not cover (ages, employment, income,
 * expenses, savings, debt, dependable income, retirement spending, financial
 * loss capacity). Question/answer ids are stable; never renumber them
 * (add a new SURVEY_VERSION instead).
 *
 * "Unknown" / "prefer not to say" answers stay unknown — they are never
 * silently treated as zero, and derived profile fields they feed become null.
 */
export const SURVEY_VERSION = "risk-survey-v1";

export interface SurveyQuestion { id: string; text: string; options: { id: string; label: string }[] }

const q = (n: number, slug: string, text: string, labels: string[]): SurveyQuestion => {
  const id = `s${String(n).padStart(2, "0")}_${slug}`;
  return { id, text, options: labels.map((label, i) => ({ id: `s${String(n).padStart(2, "0")}_${String.fromCharCode(97 + i)}`, label })) };
};

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  q(1, "current_age", "What is your current age?", ["Under 25", "25–34", "35–44", "45–54", "55–64", "65 or older", "Prefer not to say"]),
  q(2, "retirement_age", "At what age do you intend to retire (or did you retire)?", ["Already retired", "Before 55", "55–59", "60–64", "65–69", "70 or later", "Unsure"]),
  q(3, "planning_horizon", "Through what age should your financial plan remain sustainable?", ["Through age 80", "Through age 85", "Through age 90", "Through age 95", "Age 100 or beyond", "Unsure"]),
  q(4, "employment_status", "Which best describes your current employment situation?", ["Employed", "Self-employed", "Unemployed", "Retired", "Another situation"]),
  q(5, "gross_income", "Approximately what is your annual gross household income?", ["Under $25,000", "$25,000–$49,999", "$50,000–$99,999", "$100,000–$199,999", "$200,000 or more", "Prefer not to say", "Unsure"]),
  q(6, "essential_expenses", "Approximately how much are your essential monthly expenses (housing, food, utilities, insurance, required payments)?", ["Under $1,500", "$1,500–$2,999", "$3,000–$4,999", "$5,000–$7,999", "$8,000 or more", "Unsure"]),
  q(7, "discretionary_spending", "Approximately how much do you spend each month on non-essential (discretionary) items?", ["Under $500", "$500–$999", "$1,000–$1,999", "$2,000–$3,999", "$4,000 or more", "Unsure"]),
  q(8, "liquid_savings", "Approximately how much do you hold in cash and other liquid savings?", ["Under $1,000", "$1,000–$4,999", "$5,000–$19,999", "$20,000–$49,999", "$50,000 or more", "Prefer not to say", "Unsure"]),
  q(9, "total_debt", "Approximately how much total outstanding debt do you carry (mortgage, loans, cards)?", ["None", "Under $10,000", "$10,000–$49,999", "$50,000–$199,999", "$200,000 or more", "Prefer not to say", "Unsure"]),
  q(10, "dependable_income", "Besides work, how many dependable income sources do you expect in retirement (pension, Social Security, annuity, rental income)?", ["None", "One", "Two or more", "Unsure"]),
  q(11, "retirement_spending", "Approximately how much do you expect to spend each month in retirement?", ["Under $2,000", "$2,000–$3,999", "$4,000–$5,999", "$6,000–$9,999", "$10,000 or more", "Unsure"]),
  q(12, "income_change", "How do you expect your income to change over the next five years?", ["Decrease significantly", "Decrease somewhat", "Stay about the same", "Increase somewhat", "Increase significantly", "Unsure"]),
  q(13, "max_financial_loss", "What is the largest investment loss you could financially absorb without missing essential obligations?", ["I could not absorb any loss", "Up to 5% of my portfolio", "Up to 10%", "Up to 20%", "Up to 35%", "More than 35%", "Unsure"]),
  q(14, "near_term_reliance", "Do you expect to rely on your investments for living expenses within the next three years?", ["Yes, heavily", "Yes, partially", "No", "Unsure"]),
];

export type SurveyAnswers = Record<string, string>;

/** Approximate numeric midpoints for banded answers (annual dollars unless noted).
 *  Used only to prefill simulation assumptions — always labeled as approximations
 *  the user can override. Unknown / prefer-not-to-say → null, never zero. */
const BAND_VALUES: Record<string, (number | null)[]> = {
  s01_current_age: [20, 29.5, 39.5, 49.5, 59.5, 70, null],
  s02_retirement_age: [null, 52, 57, 62, 67, 72, null], // "already retired" handled by caller
  s03_planning_horizon: [80, 85, 90, 95, 102, null],
  s05_gross_income: [12_500, 37_500, 75_000, 150_000, 250_000, null, null],
  s06_essential_expenses: [750, 2_250, 4_000, 6_500, 9_000, null], // monthly
  s08_liquid_savings: [500, 3_000, 12_500, 35_000, 75_000, null, null],
  s11_retirement_spending: [1_000, 3_000, 5_000, 8_000, 12_000, null], // monthly
};

export function bandValue(questionId: string, answerId: string | undefined): number | null {
  if (!answerId) return null;
  const vals = BAND_VALUES[questionId];
  if (!vals) return null;
  const idx = answerId.charCodeAt(answerId.length - 1) - 97;
  return idx >= 0 && idx < vals.length ? (vals[idx] ?? null) : null;
}

/** Keeps only known question ids mapped to that question's own option ids. */
export function sanitizeSurveyAnswers(input: unknown): SurveyAnswers {
  const out: SurveyAnswers = {};
  if (!input || typeof input !== "object") return out;
  for (const question of SURVEY_QUESTIONS) {
    const v = (input as Record<string, unknown>)[question.id];
    if (typeof v === "string" && question.options.some((o) => o.id === v)) out[question.id] = v;
  }
  return out;
}

/** 0-based indexes of unanswered questions. */
export function missingSurveyQuestions(answers: SurveyAnswers): number[] {
  return SURVEY_QUESTIONS.flatMap((question, i) => (answers[question.id] ? [] : [i]));
}

/** Midpoint age for an age-band answer; null for unknown / prefer-not-to-say. */
function ageBand(answer: string | undefined, mids: (number | null)[]): number | null {
  if (!answer) return null;
  const idx = answer.charCodeAt(answer.length - 1) - 97; // trailing a/b/c...
  return idx >= 0 && idx < mids.length ? (mids[idx] ?? null) : null;
}

export interface TargetProfile {
  /** Desired investment horizon in years (retirement age minus current age); null if either is unknown. */
  horizonYears: number | null;
  /** Age through which the plan should remain sustainable; null if unknown. */
  planningHorizonAge: number | null;
  /** Growth vs preservation priority 0 (full preservation) – 1 (full growth); null if unknown. */
  growthPreference: number | null;
  /** Preferred volatility band derived from financially absorbable loss; null if unknown. */
  preferredVolatility: "very_low" | "low" | "moderate" | "high" | "very_high" | null;
  /** Liquidity need derived from near-term reliance on investments; null if unknown. */
  liquidityNeed: "high" | "medium" | "low" | null;
  /** Maximum financially tolerable loss as a fraction (0–1); null if unknown. */
  maxTolerableLoss: number | null;
  /** Answer ids that were unknown/prefer-not-to-say and limited the derivation. */
  unknowns: string[];
}

/**
 * Derives the user's desired/target profile from survey answers only.
 * Deterministic and transparent; any field whose inputs are unknown is null,
 * never a fabricated default. This is a preferences profile — it says nothing
 * about whether the actual portfolio is suitable.
 */
export function deriveTargetProfile(answers: SurveyAnswers): TargetProfile {
  const unknowns: string[] = [];
  const a = (id: string) => answers[id];

  const currentAge = ageBand(a("s01_current_age"), [20, 29.5, 39.5, 49.5, 59.5, 70, null]);
  if (currentAge === null) unknowns.push("s01_current_age");
  const retired = a("s02_retirement_age") === "s02_a";
  const retirementAge = retired ? currentAge : ageBand(a("s02_retirement_age"), [null, 52, 57, 62, 67, 72, null]);
  if (retirementAge === null) unknowns.push("s02_retirement_age");
  const horizonYears = currentAge !== null && retirementAge !== null ? Math.max(0, retirementAge - currentAge) : null;

  const planningHorizonAge = ageBand(a("s03_planning_horizon"), [80, 85, 90, 95, 102, null]);
  if (planningHorizonAge === null) unknowns.push("s03_planning_horizon");

  const lossMap: Record<string, { vol: TargetProfile["preferredVolatility"]; max: number }> = {
    s13_a: { vol: "very_low", max: 0 },
    s13_b: { vol: "very_low", max: 0.05 },
    s13_c: { vol: "low", max: 0.1 },
    s13_d: { vol: "moderate", max: 0.2 },
    s13_e: { vol: "high", max: 0.35 },
    s13_f: { vol: "very_high", max: 0.5 },
  };
  const loss = lossMap[a("s13_max_financial_loss") ?? ""] ?? null;
  if (!loss) unknowns.push("s13_max_financial_loss");

  const relianceMap: Record<string, TargetProfile["liquidityNeed"]> = { s14_a: "high", s14_b: "medium", s14_c: "low" };
  const liquidityNeed = relianceMap[a("s14_near_term_reliance") ?? ""] ?? null;
  if (!liquidityNeed) unknowns.push("s14_near_term_reliance");

  // Growth preference blends horizon length with absorbable loss; null when either is unknown.
  let growthPreference: number | null = null;
  if (horizonYears !== null && loss) {
    const horizonScore = Math.min(1, horizonYears / 25); // 25+ years → fully growth-leaning
    growthPreference = Math.round(((horizonScore + loss.max / 0.5) / 2) * 100) / 100;
  }

  return { horizonYears, planningHorizonAge, growthPreference, preferredVolatility: loss?.vol ?? null, liquidityNeed, maxTolerableLoss: loss?.max ?? null, unknowns };
}
