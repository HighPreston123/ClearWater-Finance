import { useQuery } from "@tanstack/react-query";
import { listAdvisorRecords } from "@/lib/reference.functions";
import { getMyAssessmentOutputs } from "@/lib/needs.functions";
import { recommendAdvisors } from "@/lib/advisors/personalMatch";

/** Advisors (static) + the user's current needs (dynamic); the recommendation is computed fresh, never stored. */
export function useAdvisorRecommendation() {
  const advisors = useQuery({
    queryKey: ["advisor-directory"],
    queryFn: async () => { const r = await listAdvisorRecords(); return r.status === "ok" ? r.data : null; },
    staleTime: Infinity,
  });
  const assessment = useQuery({ queryKey: ["my-assessment-outputs"], queryFn: () => getMyAssessmentOutputs(), staleTime: 60_000 });
  const rec = advisors.data && assessment.data
    ? recommendAdvisors(assessment.data.outputs, advisors.data, assessment.data.labels)
    : null;
  return { advisors: advisors.data ?? null, assessment: assessment.data ?? null, rec,
    loading: advisors.isLoading || assessment.isLoading, error: advisors.isError || assessment.isError };
}
