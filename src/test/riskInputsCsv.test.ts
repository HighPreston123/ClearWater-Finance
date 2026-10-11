import { expect, it } from "vitest";
import { parseRiskInputsCsv, RISK_INPUTS_TEMPLATE } from "@/lib/csv/riskInputsImport";
it("parses the template into inputs with unknowns kept null", () => {
  const r = parseRiskInputsCsv(RISK_INPUTS_TEMPLATE);
  if (!r.ok) throw new Error(r.error);
  expect(r.inputs.emergencyFundCents).toBe(1_000_000);
  expect(r.inputs.debts[0]).toMatchObject({ balanceCents: 320_000, aprPercent: 19.9, minPaymentCents: 9_000 });
  expect(r.inputs.goals[0]!.targetDate).toBe("2029-06-01");
  expect(r.inputs.riskComfort).toBe("moderate");
  expect(parseRiskInputsCsv("type,amount\ndebt,").ok).toBe(true);
});
