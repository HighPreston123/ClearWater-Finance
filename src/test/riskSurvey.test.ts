import { describe, expect, it } from "vitest";
import {
  SURVEY_QUESTIONS,
  deriveTargetProfile,
  missingSurveyQuestions,
  sanitizeSurveyAnswers,
} from "@/lib/risk/survey";

describe("sanitizeSurveyAnswers", () => {
  it("keeps only known question/option id pairs", () => {
    const out = sanitizeSurveyAnswers({
      s01_current_age: "s01_b",
      s02_retirement_age: "not-an-option",
      hacker: "s01_a",
      s03_planning_horizon: 42,
    });
    expect(out).toEqual({ s01_current_age: "s01_b" });
  });
});

describe("missingSurveyQuestions", () => {
  it("lists indexes of unanswered questions", () => {
    expect(missingSurveyQuestions({})).toHaveLength(SURVEY_QUESTIONS.length);
    expect(missingSurveyQuestions({ s01_current_age: "s01_a" })).toHaveLength(SURVEY_QUESTIONS.length - 1);
  });
});

describe("deriveTargetProfile", () => {
  it("derives a full profile from complete answers", () => {
    const profile = deriveTargetProfile({
      s01_current_age: "s01_b", // 25–34 → 29.5
      s02_retirement_age: "s02_e", // 65–69 → 67
      s03_planning_horizon: "s03_c", // 90
      s13_max_financial_loss: "s13_d", // up to 20%
      s14_near_term_reliance: "s14_c", // no reliance → low liquidity need
    });
    expect(profile.horizonYears).toBeCloseTo(37.5);
    expect(profile.planningHorizonAge).toBe(90);
    expect(profile.preferredVolatility).toBe("moderate");
    expect(profile.liquidityNeed).toBe("low");
    expect(profile.maxTolerableLoss).toBe(0.2);
    expect(profile.growthPreference).not.toBeNull();
    expect(profile.unknowns).toEqual([]);
  });

  it("never fabricates values for unknown or prefer-not-to-say answers", () => {
    const profile = deriveTargetProfile({
      s01_current_age: "s01_g", // prefer not to say
      s02_retirement_age: "s02_g", // unsure
      s13_max_financial_loss: "s13_g", // unsure
      s14_near_term_reliance: "s14_d", // unsure
    });
    expect(profile.horizonYears).toBeNull();
    expect(profile.preferredVolatility).toBeNull();
    expect(profile.liquidityNeed).toBeNull();
    expect(profile.maxTolerableLoss).toBeNull();
    expect(profile.growthPreference).toBeNull();
    expect(profile.unknowns).toContain("s01_current_age");
    expect(profile.unknowns).toContain("s13_max_financial_loss");
  });

  it("treats already-retired as a zero-year horizon", () => {
    const profile = deriveTargetProfile({ s01_current_age: "s01_f", s02_retirement_age: "s02_a" });
    expect(profile.horizonYears).toBe(0);
  });
});
