/* eslint-disable @typescript-eslint/no-explicit-any */
import { withOwner } from "@/lib/tiger.server";

/** Read-only access to TigerData reference data (advisors, comparison population). */
export interface AdvisorRecord {
  id: string; fullName: string; title: string; biography: string; experience: string;
  education: string | null; certifications: string[]; strengths: string[]; advisoryStyle: string;
  bestSuitedFor: string[]; meetingFormat: "virtual" | "in_person" | "hybrid" | null; isFictional: boolean; isActive: boolean;
  categories: { code: string; label: string; role: "primary" | "secondary" }[];
}

export async function readAdvisors(ownerId: string): Promise<AdvisorRecord[]> {
  return withOwner(ownerId, async (tx) => {
    const rows = await tx<any[]>`
      SELECT a.*, coalesce(json_agg(json_build_object('code', c.code, 'label', c.label, 'role', ac.role)
               ORDER BY ac.role, c.label) FILTER (WHERE c.code IS NOT NULL), '[]') AS cats
      FROM fin.advisors a
      LEFT JOIN fin.advisor_categories ac ON ac.advisor_id = a.id
      LEFT JOIN fin.financial_categories c ON c.code = ac.category_code
      GROUP BY a.id ORDER BY a.created_at, a.id`;
    return rows.map((r) => ({
      id: r.id, fullName: r.full_name, title: r.title, biography: r.biography, experience: r.experience,
      education: r.education, certifications: r.certifications, strengths: r.strengths, advisoryStyle: r.advisory_style,
      bestSuitedFor: r.best_suited_for, meetingFormat: r.meeting_format, isFictional: r.is_fictional, isActive: r.is_active,
      categories: r.cats,
    }));
  });
}

export interface ReferenceDiagnostics {
  advisorCount: number; profileCount: number; profilesWithScore: number;
  profilesWithCategories: number; profilesWithMatches: number; pendingAssessments: number;
}

export async function readDiagnostics(ownerId: string): Promise<ReferenceDiagnostics> {
  return withOwner(ownerId, async (tx) => {
    const [r] = await tx<any[]>`SELECT
      (SELECT count(*) FROM fin.advisors)::int AS a,
      (SELECT count(*) FROM fin.comparison_profiles)::int AS p,
      (SELECT count(*) FROM fin.comparison_profiles WHERE overview_score IS NOT NULL)::int AS s,
      (SELECT count(DISTINCT profile_id) FROM fin.profile_categories)::int AS c,
      (SELECT count(DISTINCT profile_id) FROM fin.profile_advisor_matches)::int AS m,
      (SELECT count(*) FROM fin.comparison_profiles WHERE risk_assessment_status = 'pending')::int AS pe`;
    return { advisorCount: r.a, profileCount: r.p, profilesWithScore: r.s, profilesWithCategories: r.c, profilesWithMatches: r.m, pendingAssessments: r.pe };
  });
}

/** Scores of the comparison population; excludes null/pending scores (never treated as 0). */
export async function readComparisonScores(ownerId: string, category?: string): Promise<{ profileId: string; score: number; subset: string | null }[]> {
  return withOwner(ownerId, async (tx) => {
    const rows = category
      ? await tx<any[]>`SELECT p.id, p.overview_score, p.comparison_subset FROM fin.comparison_profiles p
          JOIN fin.profile_categories pc ON pc.profile_id = p.id AND pc.category_code = ${category}
          WHERE p.overview_score IS NOT NULL`
      : await tx<any[]>`SELECT id, overview_score, comparison_subset FROM fin.comparison_profiles WHERE overview_score IS NOT NULL`;
    return rows.map((r) => ({ profileId: r.id, score: Number(r.overview_score), subset: r.comparison_subset }));
  });
}

/** Advisors sharing a category with a person, read from the matching view. */
export async function readProfileMatches(ownerId: string, profileId: string) {
  return withOwner(ownerId, async (tx) => {
    const rows = await tx<any[]>`SELECT advisor_id, shared_categories FROM fin.profile_advisor_matches WHERE profile_id = ${profileId} ORDER BY advisor_id`;
    return rows.map((r) => ({ advisorId: r.advisor_id as string, sharedCategories: r.shared_categories as string[] }));
  });
}
