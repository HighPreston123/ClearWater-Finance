import type { ServiceResult } from "@/services/types";
import type { AdvisorProfile } from "@/types/advisors";
import { getNessieAdvisorRecords } from "@/lib/nessie.functions";
import type { AdvisorProvider } from "./advisorProvider";

/**
 * Advisor profiles sourced from Nessie customers under the user's key
 * (all customers beyond the primary banking one). Nessie has no advisor
 * concept, so focus areas are not inferred — profiles are clearly marked
 * as unverified demo records with source "nessie".
 */
export const nessieAdvisorAdapter: AdvisorProvider = {
  id: "nessie",
  async listAdvisors(): Promise<ServiceResult<AdvisorProfile[]>> {
    const res = await getNessieAdvisorRecords();
    if (res.status !== "ok") return res;
    const profiles: AdvisorProfile[] = res.data.map((r) => ({
      id: `nessie-adv-${r.id}`,
      name: r.name,
      description: "Profile loaded from your Nessie connection. Background and specialties are not verified.",
      focusAreas: [],
      supportedNeeds: [],
      source: "nessie",
      isFictional: true,
    }));
    return { status: "ok", data: profiles, source: "nessie", fetchedAt: res.fetchedAt };
  },
};
