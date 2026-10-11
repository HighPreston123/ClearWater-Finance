/**
 * "Getting to Know You" onboarding quiz. Collects answers only — interpretation
 * belongs to the separate risk-assessment system. Question/answer ids are stable;
 * never renumber them (add a new QUIZ_VERSION instead).
 */
export const QUIZ_VERSION = "gtky-v1";

export interface QuizQuestion { id: string; text: string; options: { id: string; label: string }[] }

const q = (n: number, slug: string, text: string, labels: string[]): QuizQuestion => {
  const id = `q${String(n).padStart(2, "0")}_${slug}`;
  return { id, text, options: labels.map((label, i) => ({ id: `q${String(n).padStart(2, "0")}_${String.fromCharCode(97 + i)}`, label })) };
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  q(1, "primary_goal", "What is your primary investment goal?", ["Preserving my current wealth", "Generating income", "Balanced growth and income", "Growing my wealth over the long term", "Maximizing long-term growth, even with significant volatility"]),
  q(2, "withdrawal_timing", "When do you expect to begin withdrawing a significant portion of your investments?", ["Within 2 years", "3–5 years", "6–10 years", "11–20 years", "More than 20 years", "I do not anticipate significant withdrawals"]),
  q(3, "years_working", "How many years do you plan to continue working before retirement?", ["Already retired or not planning to work", "0–5 years", "6–10 years", "11–20 years", "More than 20 years", "Unsure"]),
  q(4, "five_year_need", "How much of your investment portfolio do you expect to need during the next five years?", ["Most or all of it", "About half", "A small portion", "None of it", "Unsure"]),
  q(5, "contribution_schedule", "What is your expected investment contribution schedule?", ["No additional contributions planned", "Irregular contributions", "Monthly contributions", "Quarterly contributions", "Annual contributions", "Unsure or not yet determined"]),
  q(6, "annual_contribution", "Approximately how much do you expect to contribute each year?", ["Under $1,000", "1,000–4,999", "5,000–14,999", "15,000–29,999", "$30,000 or more", "Prefer not to say", "Unsure"]),
  q(7, "income_stability", "How stable is your primary source of income?", ["Very unstable or unpredictable", "Somewhat unstable", "Generally stable", "Very stable"]),
  q(8, "emergency_months", "Approximately how many months of essential living expenses could you cover using liquid savings without selling investments?", ["Less than 1 month", "1–3 months", "4–6 months", "7–12 months", "More than 12 months", "Unsure"]),
  q(9, "unexpected_expense", "How would a major unexpected expense affect your ability to meet your financial obligations?", ["I would need to sell investments or borrow money", "I could cover some of it but would face financial strain", "I could cover it with limited disruption", "I could cover it comfortably"]),
  q(10, "risk_attitude", "How would you describe your general attitude toward investment risk?", ["I strongly prefer to avoid losses", "I accept very little risk for modest growth", "I accept moderate risk for reasonable growth", "I accept substantial risk for higher potential returns", "I prioritize long-term growth despite substantial risk"]),
  q(11, "drop_10pct_reaction", "If your portfolio fell 10% in a month because of market conditions, what would you most likely do?", ["Sell most investments to prevent further losses", "Sell some investments and move to safer assets", "Hold my investments and wait for recovery", "Continue investing according to my plan", "Consider investing more if my financial situation allowed"]),
  q(12, "max_tolerable_decline", "What is the largest temporary decline in your portfolio that you believe you could emotionally tolerate?", ["0–5%", "6–10%", "11–15%", "16–25%", "26–35%", "More than 35%", "Unsure"]),
  q(13, "downturn_100k_reaction", "Suppose you invested $100,000 and its value fell to $80,000 during a market downturn. What would you most likely do?", ["Sell the remaining investments", "Reduce risk by selling some investments", "Hold and wait for recovery", "Stay invested and continue regular contributions", "Consider buying more investments"]),
  q(14, "loss_vs_missed_gain", "Which investment outcome would concern you more?", ["A 10% loss, even if the investment could recover", "A temporary 20% loss while pursuing higher long-term returns", "Missing significant gains because I invested too conservatively", "Both losses and missed gains concern me equally"]),
  q(15, "underperformance_reaction", "How would you react if your portfolio underperformed the broader stock market for two consecutive years?", ["I would want to change to safer investments", "I would want to change my strategy quickly", "I would review the reasons before deciding", "I would stay with my long-term strategy if it remained appropriate"]),
  q(16, "experience", "How much investment experience do you have?", ["None or very little", "Some experience with savings accounts, funds, or retirement plans", "Several years of investing in stocks or funds", "Extensive experience with different investment types and market cycles"]),
  q(17, "preferred_approach", "Which statement best describes your preferred investment approach?", ["Prioritize stability, even if returns are lower", "Accept limited volatility for steady growth", "Balance growth with downside protection", "Prioritize growth and accept significant volatility", "Pursue the highest potential long-term return within my financial limits"]),
  q(18, "liquidity_importance", "How important is it to have access to your investments quickly?", ["Extremely important", "Very important", "Moderately important", "Not very important", "Not important for my long-term investments"]),
  q(19, "portfolio_dependence", "How much of your overall financial well-being depends on your investment portfolio?", ["Nearly all of it", "A large portion", "About half", "A smaller portion", "Very little; I have other substantial financial resources", "Prefer not to say"]),
  q(20, "major_obligations", "Do you expect any major financial obligations in the next five years, such as buying a home, paying tuition, or supporting family?", ["Yes, substantial obligations", "Yes, moderate obligations", "Possibly, but not certain", "No major obligations expected", "Prefer not to say"]),
];

export type QuizAnswers = Record<string, string>;

/** Keeps only known question ids mapped to that question's own option ids. */
export function sanitizeAnswers(input: unknown): QuizAnswers {
  const out: QuizAnswers = {};
  if (!input || typeof input !== "object") return out;
  for (const question of QUIZ_QUESTIONS) {
    const v = (input as Record<string, unknown>)[question.id];
    if (typeof v === "string" && question.options.some((o) => o.id === v)) out[question.id] = v;
  }
  return out;
}

/** 0-based indexes of unanswered questions. */
export function missingQuestions(answers: QuizAnswers): number[] {
  return QUIZ_QUESTIONS.flatMap((question, i) => (answers[question.id] ? [] : [i]));
}
