import type { AdvisorProfile } from "@/types/advisors";
import { SAMPLE_ADVISORS } from "@/data/sampleAdvisors";
import type { ServiceResult } from "@/services/types";
import { nessieAdvisorAdapter } from "./nessieAdvisorAdapter";

export interface AdvisorProvider {
  id: "sample" | "nessie";
  listAdvisors(): Promise<ServiceResult<AdvisorProfile[]>>;
}

export const sampleAdvisorProvider: AdvisorProvider = {
  id: "sample",
  async listAdvisors() {
    return { status: "ok", data: SAMPLE_ADVISORS, source: "sample", fetchedAt: new Date().toISOString() };
  },
};

export function getAdvisorProvider(kind: "sample" | "nessie"): AdvisorProvider {
  return kind === "nessie" ? nessieAdvisorAdapter : sampleAdvisorProvider;
}
