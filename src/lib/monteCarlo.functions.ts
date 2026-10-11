import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { missingMonteCarloInputs, runMonteCarlo, type MonteCarloResult } from "@/lib/risk/monteCarlo";

const inputSchema = z.object({
  currentAge: z.number().min(16).max(100),
  retirementAge: z.number().min(40).max(100),
  horizonAge: z.number().min(50).max(110),
  initialBalance: z.number().min(0),
  annualContribution: z.number().min(0).default(0),
  annualRetirementSpending: z.number().min(0),
  annualDependableIncome: z.number().min(0).default(0),
  meanReturn: z.number().min(-0.1).max(0.2).default(0.04),
  volatility: z.number().min(0.01).max(0.6).default(0.15),
  feeRate: z.number().min(0).max(0.05).default(0.005),
  df: z.number().int().min(3).max(60).default(5),
  paths: z.number().int().min(1000).max(10000).default(10000),
  seed: z.number().int().default(42),
});

/** Runs the Monte Carlo retirement simulation server-side and persists the run. */
export const runRetirementSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ status: "ok"; result: MonteCarloResult } | { status: "insufficient_data"; missing: string[] }> => {
    const missing = missingMonteCarloInputs(data);
    if (missing.length) return { status: "insufficient_data", missing };
    const { assertMfa } = await import("./mfa.server");
    await assertMfa(context);
    if (data.retirementAge > data.horizonAge || data.currentAge >= data.horizonAge) {
      return { status: "insufficient_data", missing: ["ages: retirement and horizon must be after current age"] };
    }
    const result = runMonteCarlo(data);
    const { withOwner } = await import("./tiger.server");
    await withOwner(context.userId, async (tx) => {
      await tx`INSERT INTO fin.monte_carlo_runs (user_id, config, results) VALUES (${context.userId}, ${tx.json(data)}, ${tx.json(result as never)})`;
    });
    return { status: "ok", result };
  });
