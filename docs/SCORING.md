# Historical Cash-Flow Score (0–1,000)

> This score reflects recorded cash flow. Future risk and investment risk are not included yet.
> Educational estimate based on recorded data. Not a credit score or professional financial assessment.

Implementation: `src/lib/finance/score.ts`. Thresholds are product assumptions, not validated standards.

## Period
Latest complete calendar month inside the selected range (and fully covered by the dataset). None → "Select a complete month to calculate a score." Zero income → "Not enough income data."

## Factor A — Monthly cash-flow margin (700)
Surplus rate = (income − spending) / income × 100. Transfers excluded.
- ≥ 20% → 700 · 10–<20% → 560 · 5–<10% → 420 · 0–<5% → 280 · < 0% → 0

## Factor B — Prior-month stability (300)
Up to two complete months immediately before the scored month, only those with income.
Points = round(300 × nonnegative months / eligible months).
No eligible months → factor unavailable; score = round(A × 1000 / 700), labeled "Limited history". Raw and normalized values are both shown.

## Labels
0–100 Needs attention · 101–250 Getting started · 251–450 Building stability · 451–650 Making progress · 651–750 On track · 751–900 Strong · 901–1,000 Very strong

## Not deducted
Investment holdings, missing optional info, number of subscriptions.

## Limitations
Only two factors; monthly granularity; no balances, debt, or volatility. **Future risk is excluded** and the overall wellness score is "Not yet available".
