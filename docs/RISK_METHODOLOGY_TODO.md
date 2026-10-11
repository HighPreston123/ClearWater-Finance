# Future-Risk Methodology — TODO for the methodology owner

Nothing here is decided. The app currently shows "Methodology pending" and calculates no risk.

## Available input categories (`computeCoverage` in `src/lib/risk/buildFinancialSnapshot.ts`)
Income amount/variability/history · Spending by category & change · Recurring commitments · Cash-flow deficits · Cash & emergency reserves (manual) · Debts (manual) · Goals & upcoming obligations (manual) · Investment accounts & holdings · Portfolio concentration/exposure · Historical market data (not connected) · Time horizon & risk comfort (manual).

## Interfaces (`src/types/risk.ts`)
- Input: `FinancialSnapshot` (cash flow, recurring, manual inputs, investments, coverage, `marketHistory: null`).
- Engine: `RiskEngine.assess(snapshot) → RiskAssessment`.
- Output: `RiskAssessment { status: not_implemented | insufficient_data | ready | error, methodologyVersion, inputTimestamp, dataCoverage, overall, categories, assumptions, limitations, scenarios, potentialActions }`. `overall.value` and `contribution` are typed `unknown` on purpose — no scale is fixed.
- Composition: `composeWellnessScore(historical, risk)` in `src/lib/risk/composeWellnessScore.ts`.

## Missing data
`null` = Unknown. Never coerce to 0 debt/assets or "low risk". Coverage reports available / manual / stale (manual >90 days, prices >7 days) / missing.

## Decisions to define
Factors · weights · forecast horizon · numeric scale & direction · thresholds/labels · assumptions · scenarios · how missing data affects results · how historical score and risk combine into the overall wellness score · whether/how advisor matching uses the result.

## Where to implement
1. Write an engine implementing `RiskEngine` in `src/lib/risk/` and bind it to `activeRiskEngine` in `src/lib/risk/riskEngine.ts`.
2. Implement `composeWellnessScore`.
3. Supply `riskContribution` in `src/lib/finance/profileImprovementActions.ts` and rules in `src/lib/advisors/matchAdvisor.ts`.
UI (`src/components/risk/FutureRiskPanel.tsx`) reads only `RiskAssessment` and needs no rewrite.
