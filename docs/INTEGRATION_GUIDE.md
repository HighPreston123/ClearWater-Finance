# Integration Guide

Framework: TanStack Start (React 19, Vite, TypeScript). Pages live in `src/routes/` (file-based routing) instead of a `pages/` folder.

## Run & test
```
bun install
bun run dev        # http://localhost:8080
bunx vitest run    # unit tests (src/test/)
```

## Implemented vs. stubbed

| Area | Status | Files |
|---|---|---|
| Sample transactions (88, Jul–Oct 2026) | Implemented | `src/data/sampleTransactions.ts` |
| Metrics, categorization, recurring, savings, recommendation | Implemented | `src/lib/finance/*` |
| Historical cash-flow score | Implemented | `src/lib/finance/score.ts`, see `SCORING.md` |
| Investments (sample accounts/holdings, valuation, allocation) | Implemented | `src/types/investments.ts`, `src/lib/investments/*`, `src/components/investments/*` |
| Future risk engine | **Stub** (returns `not_implemented`) | `src/lib/risk/riskEngine.ts` |
| Overall wellness composition | **Stub** (`not_available`) | `src/lib/risk/composeWellnessScore.ts` |
| Advisor matching | **Stub** (`not_configured`) | `src/lib/advisors/matchAdvisor.ts` |
| Nessie transactions | **Stub** | `src/services/transactions/nessieProvider.ts` |
| Nessie advisors | **Stub** | `src/services/advisors/nessieAdvisorAdapter.ts` |
| Holdings import | **Stub** | `src/services/investments/holdingsProvider.ts` |
| Market data | **Stub** | `src/services/investments/marketDataProvider.ts` |
| AI explanations | **Stub** | `src/services/ai/insightsClient.ts`, `src/components/integrations/AIInsightsPanel.tsx` |
| Audio summary | **Stub** | `src/services/audio/audioClient.ts`, `src/components/integrations/AudioSummaryControls.tsx` |
| CSV upload | Implemented | `src/lib/csv/csvImport.ts`, `src/components/settings/CsvImportCard.tsx` |

All stubs return `{ status: "not_configured" }` (`src/services/types.ts`) and make no network calls. Flags: `src/config/features.ts` (UI only — not auth).

## Future routes (not implemented — create as TanStack server routes under `src/routes/api/`)
- `GET /api/transactions` → `TransactionsResponse` (`src/services/transactions/types.ts`). Amounts: positive integer cents; meaning via `type`.
- `POST /api/holdings/import` → body `HoldingsImportRequest` (multiple accounts + holdings), response `HoldingsImportResponse`.
- `POST /api/market-data/quotes` → body `{ symbols }`, response `{ quotes, missing }`. Prices only for held securities; never adds holdings.
- `POST /api/insights` → body `{ context: InsightContext }` (`src/lib/finance/buildInsightContext.ts`). AI explains only; no new math, risk ratings, or competing recommendation.
- `POST /api/audio-summary` → body `{ text, voice? }`, response `{ audioUrl, durationSeconds }`. No microphone.

Failures must not silently fall back to sample data; the Settings switch (`src/components/settings/DataConnections.tsx`) is the explicit choice.

## Server-only config (examples, no secrets)
```
NESSIE_API_KEY=...        # read via process.env inside server handlers only
MARKET_DATA_API_KEY=...
AI_PROVIDER_API_KEY=...
TTS_API_KEY=...
```

## Storage
Versioned localStorage key `financial-wellness:state:v1` via `src/services/storage/storageAdapter.ts`. Replace `localStorageAdapter` with a server-backed implementation of `StorageAdapter`; the store (`src/store/FinanceStore.tsx`) depends only on that interface.

## Advisors
Schema: `AdvisorProfile` in `src/types/advisors.ts` (id, name, description, focusAreas, supportedNeeds, meetingFormat?, contactUrl?, source, isFictional). Sample (fictional) profiles: `src/data/sampleAdvisors.ts`. Provider: `src/services/advisors/advisorProvider.ts`. Nessie advisor endpoint/schema are **not assumed** — implement in `nessieAdvisorAdapter.ts` once supplied.

Matching (`matchAdvisor`) returns `AdvisorMatch { status, recommendedAdvisorId, matchReasons, factorsUsed, missingInformation, methodologyVersion }`. **Unfinished:** matching rules are to be defined by the team; never random, never treat missing risk as zero.

Profile actions: `src/lib/finance/profileImprovementActions.ts` — built only from historical-score deductions; `riskContribution` stays null until the risk engine supplies it.

## Path mapping
All requested paths exist as specified. Extra: `src/lib/finance/dates.ts`, `src/lib/format.ts`, `src/store/*`, `src/services/types.ts`, `src/components/common/*`, `src/components/score/*`, `src/components/charts/*`.
