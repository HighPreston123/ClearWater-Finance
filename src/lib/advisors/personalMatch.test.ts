import { describe, expect, it } from "vitest";
import { recommendAdvisors, type SpecialtyAdvisor } from "./personalMatch";

const adv = (id: string, primary: string, ...secondary: string[]): SpecialtyAdvisor => ({
  id, fullName: `${id} Person`, title: "t", isActive: true,
  categories: [{ code: primary, label: primary, role: "primary" }, ...secondary.map((c) => ({ code: c, label: c, role: "secondary" as const }))],
});
const A = [adv("saver", "saving", "budgeting", "emergency_funds"), adv("investor", "investing", "wealth_building")];
const base = { quizStatus: "completed" as const, strengths: [], assessmentVersion: null, updatedAt: null };

describe("recommendAdvisors", () => {
  it("needs quiz first", () => expect(recommendAdvisors({ ...base, quizStatus: "in_progress", needs: ["saving"] }, A, {}).status).toBe("quiz_needed"));
  it("pending when no needs yet — never invents", () => expect(recommendAdvisors({ ...base, needs: [] }, A, {}).status).toBe("pending"));
  it("prefers advisor covering more needs", () => {
    const r = recommendAdvisors({ ...base, needs: ["saving", "budgeting", "emergency_funds"] }, A, {});
    expect(r.status === "ready" && r.best?.advisorId).toBe("saver");
  });
  it("changes when needs change", () => {
    const r = recommendAdvisors({ ...base, needs: ["investing", "wealth_building"] }, A, {});
    expect(r.status === "ready" && r.best?.advisorId).toBe("investor");
  });
  it("flags no exact match", () => {
    const r = recommendAdvisors({ ...base, needs: ["retirement_planning"] }, A, {});
    expect(r.status === "ready" && r.exact).toBe(false);
  });
});
