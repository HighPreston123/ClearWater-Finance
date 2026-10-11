/**
 * UI feature flags. These only toggle interface affordances — they are NOT
 * authentication or credential checks. Credentials stay server-side.
 */
export const FEATURES = {
  nessieTransactions: false,
  holdingsImport: false,
  marketData: false,
  aiInsights: true,
  audioSummary: false,
  advisorMatching: false,
  nessieAdvisors: false,
  csvUpload: true,
} as const;

/** Future server routes. Not implemented — clients must not call them yet. */
export const FUTURE_ROUTES = {
  transactions: "GET /api/transactions",
  holdingsImport: "POST /api/holdings/import",
  marketQuotes: "POST /api/market-data/quotes",
  insights: "POST /api/insights",
  audioSummary: "POST /api/audio-summary",
} as const;
