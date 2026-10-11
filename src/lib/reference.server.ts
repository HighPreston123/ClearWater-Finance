/* eslint-disable @typescript-eslint/no-explicit-any */
import { check, type Db } from "@/lib/db.server";

/** Read-only access to reference data (advisors, comparison population). Signed-in users can read; only the server changes it. */
export interface AdvisorRecord {
  id: string; fullName: string; title: string; biography: string; experience: string;
  education: string | null; certifications: string[]; strengths: string[]; advisoryStyle: string;
  bestSuitedFor: string[]; meetingFormat: "virtual" | "in_person" | "hybrid" | null; isFictional: boolean; isActive: boolean;
  categories: { code: string; label: string; role: "primary" | "secondary" }[];
}

export async function readAdvisors(db: Db): Promise<AdvisorRecord[]> {
  const rows = (check(await db.from("fin_advisors")
    .select("*, fin_advisor_categories(role, fin_financial_categories(code, label))")
    .order("created_at").order("id"), "advisors_read") ?? []) as any[];
  return rows.map((r) => ({
    id: r.id, fullName: r.full_name, title: r.title, biography: r.biography, experience: r.experience,
    education: r.education, certifications: r.certifications, strengths: r.strengths, advisoryStyle: r.advisory_style,
    bestSuitedFor: r.best_suited_for, meetingFormat: r.meeting_format, isFictional: r.is_fictional, isActive: r.is_active,
    categories: (r.fin_advisor_categories ?? [])
      .filter((c: any) => c.fin_financial_categories)
      .map((c: any) => ({ code: c.fin_financial_categories.code, label: c.fin_financial_categories.label, role: c.role }))
      .sort((a: any, b: any) => a.role.localeCompare(b.role) || a.label.localeCompare(b.label)),
  }));
}

export interface ReferenceDiagnostics {
  advisorCount: number; profileCount: number; profilesWithScore: number;
  profilesWithCategories: number; profilesWithMatches: number; pendingAssessments: number;
}

export async function readDiagnostics(db: Db): Promise<ReferenceDiagnostics> {
  const count = async (q: PromiseLike<{ count: number | null; error: any }>, what: string) => {
    const r = await q;
    check({ data: null, error: r.error }, what);
    return r.count ?? 0;
  };
  const head = { count: "exact" as const, head: true };
  const [a, p, s, pe, cats, matches] = await Promise.all([
    count(db.from("fin_advisors").select("id", head), "diag_advisors"),
    count(db.from("fin_comparison_profiles").select("id", head), "diag_profiles"),
    count(db.from("fin_comparison_profiles").select("id", head).not("overview_score", "is", null), "diag_scored"),
    count(db.from("fin_comparison_profiles").select("id", head).eq("risk_assessment_status", "pending"), "diag_pending"),
    db.from("fin_profile_categories").select("profile_id"),
    db.from("fin_profile_advisor_matches").select("profile_id"),
  ]);
  const distinct = (r: any, what: string) => new Set(((check(r, what) ?? []) as any[]).map((x) => x.profile_id)).size;
  return { advisorCount: a, profileCount: p, profilesWithScore: s, profilesWithCategories: distinct(cats, "diag_cats"),
    profilesWithMatches: distinct(matches, "diag_matches"), pendingAssessments: pe };
}

/** Scores of the comparison population; excludes null/pending scores (never treated as 0). */
export async function readComparisonScores(db: Db, category?: string): Promise<{ profileId: string; score: number; subset: string | null }[]> {
  let rows: any[];
  if (category) {
    const ids = ((check(await db.from("fin_profile_categories").select("profile_id").eq("category_code", category), "cmp_cats") ?? []) as any[]).map((r) => r.profile_id);
    rows = ids.length ? (check(await db.from("fin_comparison_profiles").select("id, overview_score, comparison_subset").in("id", ids).not("overview_score", "is", null), "cmp_scores") ?? []) : [];
  } else {
    rows = check(await db.from("fin_comparison_profiles").select("id, overview_score, comparison_subset").not("overview_score", "is", null), "cmp_scores") ?? [];
  }
  return rows.map((r) => ({ profileId: r.id, score: Number(r.overview_score), subset: r.comparison_subset }));
}

/** Advisors sharing a category with a person, read from the matching view. */
export async function readProfileMatches(db: Db, profileId: string) {
  const rows = (check(await db.from("fin_profile_advisor_matches").select("advisor_id, shared_categories").eq("profile_id", profileId).order("advisor_id"), "profile_matches") ?? []) as any[];
  return rows.map((r) => ({ advisorId: r.advisor_id as string, sharedCategories: r.shared_categories as string[] }));
}

/** Raw financial fields of the fictional comparison profiles — server-only; callers must return aggregates only. */
export async function readComparisonProfileInputs(db: Db) {
  const rows = (check(await db.from("fin_comparison_profiles")
    .select("id, annual_income_cents, monthly_spending_cents, savings_cents, debt_cents, debt_breakdown, investments_cents"), "cmp_inputs") ?? []) as any[];
  return rows.map((r) => ({ id: r.id, annualIncomeCents: r.annual_income_cents, monthlySpendingCents: r.monthly_spending_cents,
    savingsCents: r.savings_cents, debtCents: r.debt_cents, debtBreakdown: r.debt_breakdown, investmentsCents: r.investments_cents }));
}
