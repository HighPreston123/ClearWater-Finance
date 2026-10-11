export const ACCOUNT_TYPES = [
  "taxable_brokerage",
  "401k",
  "roth_401k",
  "traditional_ira",
  "roth_ira",
  "hsa",
  "other",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  taxable_brokerage: "Taxable brokerage",
  "401k": "401(k)",
  roth_401k: "Roth 401(k)",
  traditional_ira: "Traditional IRA",
  roth_ira: "Roth IRA",
  hsa: "HSA investment account",
  other: "Other investment account",
};

export const ASSET_CLASSES = ["stock", "etf", "mutual_fund", "bond", "cash", "other", "unknown"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];
export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  stock: "Individual stocks",
  etf: "ETFs",
  mutual_fund: "Mutual funds",
  bond: "Bonds",
  cash: "Cash / cash equivalents",
  other: "Other",
  unknown: "Unknown / unclassified",
};

export type DataSource = "sample" | "manual" | "imported";

export interface InvestmentAccount {
  id: string;
  name: string;
  type: AccountType;
  institution?: string;
  currency: "USD";
  /** Uninvested cash held in the account, in cents. Not a holding. */
  cashCents: number;
  valuationTimestamp: string;
  source: DataSource;
}

export interface Holding {
  id: string;
  accountId: string;
  symbol: string | null;
  externalSecurityId?: string;
  name: string;
  assetClass: AssetClass;
  /** Decimal strings to preserve fractional precision. */
  quantity: string;
  latestPrice: string | null;
  priceTimestamp: string | null;
  suppliedValueCents?: number | null;
  suppliedValueDate?: string | null;
  costBasisCents?: number | null;
  sector?: string;
  /** e.g. "US investment-grade bonds" — ETFs/funds are not assumed to be stock-only. */
  underlyingExposure?: string;
  source: DataSource;
}

export type ValuationStatus = "quoted" | "supplied" | "unavailable";
export interface HoldingValuation {
  status: ValuationStatus;
  /** millionths of a dollar */
  micros: bigint | null;
  asOf: string | null;
  stale: boolean;
}
