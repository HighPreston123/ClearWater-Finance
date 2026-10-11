import { describe, expect, it } from "vitest";
import { deriveUserCategories, rankAdvisors, type AdvisorRecord } from "@/lib/risk/advisorMatch";

const advisor = (id: string, name: string, categories: { code: string; role: "primary" | "secondary" }[]): AdvisorRecord => ({
  id,
  fullName: name,
  title: "CFP",
  biography: "bio",
  experience: "10 years",
  education: null,
  certifications: [],
  strengths: [],
  advisoryStyle: "holistic",
  bestSuitedFor: [],
  meetingFormat: "virtual",
  categories,
});

describe("deriveUserCategories", () => {
  it("maps debt, thin savings, and retirement intent to categories", () => {
    const cats = deriveUserCategories({
      s09_total_debt: "s09_d",
      s08_liquid_savings: "s08_a",
      s02_retirement_age: "s02_d",
      s13_max_financial_loss: "s13_a",
    });
    expect(cats).toContain("debt_management");
    expect(cats).toContain("emergency_funds");
    expect(cats).toContain("saving");
    expect(cats).toContain("retirement_planning");
    expect(cats).toContain("risk_management");
  });

  it("maps unsure/prefer-not-to-say answers to nothing", () => {
    expect(deriveUserCategories({ s09_total_debt: "s09_f", s02_retirement_age: "s02_g" })).toEqual([]);
    expect(deriveUserCategories({})).toEqual([]);
  });
});

describe("rankAdvisors", () => {
  const advisors = [
    advisor("a1", "Alice Primary", [{ code: "debt_management", role: "primary" }]),
    advisor("a2", "Bob Secondary", [{ code: "debt_management", role: "secondary" }]),
    advisor("a3", "Carol None", [{ code: "investing", role: "primary" }]),
    advisor("a4", "Dana Both", [
      { code: "debt_management", role: "primary" },
      { code: "saving", role: "secondary" },
    ]),
  ];

  it("excludes advisors with no shared category", () => {
    const matches = rankAdvisors(advisors, ["debt_management"]);
    expect(matches.map((m) => m.advisor.id)).not.toContain("a3");
  });

  it("ranks primary matches above secondary and multi-category above single", () => {
    const matches = rankAdvisors(advisors, ["debt_management", "saving"]);
    expect(matches.map((m) => m.advisor.id)).toEqual(["a4", "a1", "a2"]);
    expect(matches[0]!.score).toBe(3);
  });

  it("respects the limit", () => {
    expect(rankAdvisors(advisors, ["debt_management", "saving"], 2)).toHaveLength(2);
  });
});
