/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * SEC EDGAR access (server-only). Uses the official EDGAR JSON APIs with a declared
 * User-Agent per SEC access policy, and caches results in fin.company_fundamentals
 * (24h TTL) so repeated views never re-hit SEC servers.
 */
import { extractFundamentals, type FundamentalMetrics } from "@/lib/risk/fundamentals";

const TTL_MS = 24 * 60 * 60 * 1000;
const UA = "Clearwater financial planning app (contact: support@clearwater.app)";

export interface FundamentalsResult {
  symbol: string;
  status: "ok" | "no_filings" | "unavailable";
  metrics: FundamentalMetrics | null;
  fetchedAt: string;
}

type Tx = { <T = any[]>(strings: TemplateStringsArray, ...values: any[]): Promise<T> & any; json(v: unknown): unknown };

async function secJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "identity" } });
  if (!res.ok) throw new Error(`SEC EDGAR responded ${res.status}`);
  return res.json();
}

let tickerMapPromise: Promise<Map<string, { cik: string; name: string }>> | null = null;
/** ticker → CIK map from SEC's company_tickers.json, memoized per process. */
function tickerMap(): Promise<Map<string, { cik: string; name: string }>> {
  tickerMapPromise ??= secJson("https://www.sec.gov/files/company_tickers.json").then((data) => {
    const map = new Map<string, { cik: string; name: string }>();
    for (const row of Object.values<any>(data)) {
      map.set(String(row.ticker).toUpperCase(), { cik: String(row.cik_str).padStart(10, "0"), name: String(row.title) });
    }
    return map;
  });
  return tickerMapPromise;
}

/** Returns cached fundamentals when fresh; otherwise fetches EDGAR companyfacts and caches them. */
export async function getCompanyFundamentals(tx: Tx, symbol: string): Promise<FundamentalsResult> {
  const sym = symbol.toUpperCase();
  const [cached] = await tx<any[]>`SELECT metrics, status, fetched_at FROM fin.company_fundamentals WHERE symbol = ${sym}`;
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS) {
    return { symbol: sym, status: cached.status, metrics: cached.metrics, fetchedAt: new Date(cached.fetched_at).toISOString() };
  }

  let result: { status: FundamentalsResult["status"]; metrics: FundamentalMetrics | null; cik: string | null; name: string | null };
  try {
    const map = await tickerMap();
    const hit = map.get(sym);
    if (!hit) {
      result = { status: "no_filings", metrics: null, cik: null, name: null };
    } else {
      const facts = await secJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${hit.cik}.json`);
      const metrics = extractFundamentals(facts);
      result = { status: "ok", metrics, cik: hit.cik, name: hit.name };
    }
  } catch {
    result = { status: "unavailable", metrics: null, cik: null, name: null };
  }

  await tx`INSERT INTO fin.company_fundamentals (symbol, cik, company_name, metrics, status, fetched_at)
    VALUES (${sym}, ${result.cik}, ${result.name}, ${result.metrics ? tx.json(result.metrics) : null}, ${result.status}, now())
    ON CONFLICT (symbol) DO UPDATE SET cik = EXCLUDED.cik, company_name = EXCLUDED.company_name,
      metrics = EXCLUDED.metrics, status = EXCLUDED.status, fetched_at = now()`;

  return { symbol: sym, status: result.status, metrics: result.metrics, fetchedAt: new Date().toISOString() };
}
