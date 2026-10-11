/**
 * Personal advisor recommendations: USER NEEDS → ADVISOR SPECIALTIES.
 * Pure and read-only. It never interprets quiz answers, never scores risk, and
 * never changes advisor or user categories. The user's current needs come from
 * the separate assessment system (see UserAssessmentOutputs).
 */

/** Structured outputs the assessment system provides. Fields stay empty until it produces them — never invented. */
export interface UserAssessmentOutputs {
  quizStatus: "not_started" | "in_progress" | "completed";
  /** Areas the user needs help with (shared category codes). */
  needs: string[];
  /** Areas of strength (shared category codes), optional. */
  strengths: string[];
  assessmentVersion: string | null;
  updatedAt: string | null;
}

export interface SpecialtyAdvisor {
  id: string; fullName: string; title: string; isActive: boolean;
  categories: { code: string; label: string; role: "primary" | "secondary" }[];
}

export interface PersonalMatch {
  advisorId: string;
  /** User needs this advisor covers, primary-specialty overlaps first. */
  coveredNeeds: string[];
  primaryCovered: boolean;
  why: string;
}

export type Recommendation =
  | { status: "quiz_needed" }
  | { status: "pending" }
  | { status: "ready"; exact: boolean; best: PersonalMatch | null; others: PersonalMatch[]; needs: string[] };

/** Ordering rule kept separate so weighting can change later: more needs covered first, then primary-specialty overlap. */
export type MatchComparator = (a: PersonalMatch, b: PersonalMatch) => number;
export const byCoverage: MatchComparator = (a, b) =>
  b.coveredNeeds.length - a.coveredNeeds.length || Number(b.primaryCovered) - Number(a.primaryCovered);

const list = (xs: string[]) => xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

export function explain(needLabels: string[], advisor: SpecialtyAdvisor): string {
  const specialties = list(advisor.categories.map((c) => c.label.toLowerCase()));
  if (!needLabels.length) return `${advisor.fullName.split(" ")[0]} focuses on ${specialties}.`;
  return `Recommended because your current focus includes ${list(needLabels.map((l) => l.toLowerCase()))}. ${advisor.fullName.split(" ")[0]} specializes in ${specialties}.`;
}

export function recommendAdvisors(
  input: UserAssessmentOutputs, advisors: readonly SpecialtyAdvisor[], labels: Record<string, string>,
  compare: MatchComparator = byCoverage, othersLimit = 3,
): Recommendation {
  if (input.quizStatus !== "completed") return { status: "quiz_needed" };
  if (!input.needs.length) return { status: "pending" };
  const wanted = new Set(input.needs);
  const active = advisors.filter((a) => a.isActive);
  const matches = active.map((a) => {
    const primary = a.categories.filter((c) => c.role === "primary" && wanted.has(c.code)).map((c) => c.code);
    const secondary = a.categories.filter((c) => c.role === "secondary" && wanted.has(c.code)).map((c) => c.code);
    const coveredNeeds = [...primary, ...secondary];
    return { advisorId: a.id, coveredNeeds, primaryCovered: primary.length > 0, why: explain(coveredNeeds.map((c) => labels[c] ?? c), a) };
  });
  const ordered = matches.filter((m) => m.coveredNeeds.length).sort((a, b) => compare(a, b) || a.advisorId.localeCompare(b.advisorId));
  if (!ordered.length) {
    // No exact specialty overlap: show the directory's advisors as closest options, clearly flagged.
    const closest = matches.slice(0, othersLimit + 1);
    return { status: "ready", exact: false, best: null, others: closest, needs: input.needs };
  }
  return { status: "ready", exact: true, best: ordered[0] ?? null, others: ordered.slice(1, 1 + othersLimit), needs: input.needs };
}

/** Why a specific advisor may be relevant to this user (for profile views). */
export function relevanceFor(input: UserAssessmentOutputs, advisor: SpecialtyAdvisor, labels: Record<string, string>) {
  const covered = advisor.categories.filter((c) => input.needs.includes(c.code)).map((c) => labels[c.code] ?? c.label);
  return { strong: covered.length > 0, covered, why: covered.length ? explain(covered, advisor) : null };
}
