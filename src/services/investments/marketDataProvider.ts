import { notConfigured, type ServiceResult } from "@/services/types";

/**
 * Market data supplies prices/metadata for securities the user ALREADY holds.
 * It must never add securities to the user's holdings.
 * Body of future POST /api/market-data/quotes.
 */
export interface QuotesRequest {
  symbols: string[];
}
export interface Quote {
  symbol: string;
  price: string; // decimal string
  currency: "USD";
  timestamp: string;
  name?: string;
  sector?: string;
}
export interface QuotesResponse {
  quotes: Quote[];
  missing: string[];
}
/** Dated valuation history; a performance chart is shown only when this exists. */
export interface ValuationHistoryPoint {
  date: string;
  valueMicros: string;
}
export interface MarketDataProvider {
  getQuotes(req: QuotesRequest): Promise<ServiceResult<QuotesResponse>>;
}

export const marketDataProvider: MarketDataProvider = {
  async getQuotes() {
    return notConfigured("Market data");
  },
};
