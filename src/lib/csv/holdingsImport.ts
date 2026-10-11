/**
 * CSV holdings import — pure parsing/mapping only. No UI, no storage.
 *
 * Rules:
 * - Requires a header row with at least symbol (or name) and quantity columns,
 *   plus either a price or a total value column.
 * - Quantities stay decimal strings to preserve fractional shares; money becomes integer cents.
 * - Rows with unparseable required fields are skipped and reported, never coerced.
 * - Rows are grouped into investment accounts by the optional account column;
 *   without one, everything lands in a single "Imported portfolio" account.
 */
import type { AssetClass, Holding, InvestmentAccount } from "@/types/investments";
import { ASSET_CLASSES } from "@/types/investments";
import { parseCsvAmount, parseCsvDate } from "@/lib/csv/csvImport";

export interface HoldingsColumns {
  symbol: number | null;
  name: number | null;
  quantity: number;
  price: number | null;
  value: number | null;
  account: number | null;
  assetClass: number | null;
  costBasis: number | null;
  date: number | null;
}

export interface ParsedHoldingRow {
  line: number;
  label: string;
  issue?: string;
}

export type HoldingsParseResult =
  | { status: "error"; error: string }
  | {
      status: "ok";
      accounts: InvestmentAccount[];
      holdings: Holding[];
      rows: ParsedHoldingRow[];
      skipped: number;
    };

const HEADER_ALIASES: { field: keyof HoldingsColumns; patterns: RegExp[] }[] = [
  { field: "symbol", patterns: [/^symbol$/, /^ticker$/, /^ticker ?symbol$/, /^security ?symbol$/] },
  { field: "name", patterns: [/^name$/, /^security ?name$/, /^description$/, /^holding$/, /^security$/] },
  { field: "quantity", patterns: [/^quantity$/, /^shares$/, /^units$/, /^qty$/] },
  { field: "price", patterns: [/^price$/, /^latest ?price$/, /^share ?price$/, /^price ?per ?share$/, /^current ?price$/] },
  { field: "value", patterns: [/^value$/, /^market ?value$/, /^current ?value$/, /^total ?value$/, /^amount ?\(.+\)?$/, /^amount$/] },
  { field: "account", patterns: [/^account$/, /^account ?name$/, /^portfolio$/, /^account ?type$/] },
  { field: "assetClass", patterns: [/^asset ?class$/, /^class$/, /^type$/] },
  { field: "costBasis", patterns: [/^cost ?basis$/, /^basis$/, /^total ?cost$/] },
  { field: "date", patterns: [/^date$/, /^as ?of$/, /^valuation ?date$/, /^price ?date$/] },
];

function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: [string, number][] = [
    [",", (first.match(/,/g) ?? []).length],
    [";", (first.match(/;/g) ?? []).length],
    ["\t", (first.match(/\t/g) ?? []).length],
  ];
  const best = counts.sort((a, b) => b[1] - a[1])[0]!;
  return best[1] > 0 ? best[0] : ",";
}

function detectColumns(header: string[]): HoldingsColumns | null {
  const cols: Partial<HoldingsColumns> = {};
  const claimed = new Set<number>();
  for (let i = 0; i < header.length; i++) {
    const name = (header[i] ?? "").trim().toLowerCase();
    if (!name || claimed.has(i)) continue;
    for (const alias of HEADER_ALIASES) {
      if (cols[alias.field] !== undefined) continue;
      if (alias.patterns.some((p) => p.test(name))) {
        cols[alias.field] = i;
        claimed.add(i);
        break;
      }
    }
  }
  if (cols.symbol === undefined) cols.symbol = null;
  if (cols.name === undefined) cols.name = null;
  if (cols.price === undefined) cols.price = null;
  if (cols.value === undefined) cols.value = null;
  if (cols.account === undefined) cols.account = null;
  if (cols.assetClass === undefined) cols.assetClass = null;
  if (cols.costBasis === undefined) cols.costBasis = null;
  if (cols.date === undefined) cols.date = null;
  if (cols.symbol === null && cols.name === null) return null;
  if (cols.quantity === undefined) return null;
  if (cols.price === null && cols.value === null) return null;
  return cols as HoldingsColumns;
}

/** Decimal string quantity, or null. Accepts "12", "12.5", "1,234.56". */
function parseQuantity(raw: string): string | null {
  const s = raw.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return s;
}

function parseAssetClass(raw: string): AssetClass {
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const hit = ASSET_CLASSES.find((c) => c === s);
  if (hit) return hit;
  if (/^(etf|exchange_traded)/.test(s)) return "etf";
  if (/^mutual/.test(s)) return "mutual_fund";
  if (/^stock|^equity|^share/.test(s)) return "stock";
  if (/^bond/.test(s)) return "bond";
  if (/^cash/.test(s)) return "cash";
  return "unknown";
}

export function parseHoldingsCsv(text: string): HoldingsParseResult {
  const lines = text.split(/\r?\n/).filter((l, i, arr) => l.trim() !== "" || i < arr.length - 1);
  while (lines.length && lines[lines.length - 1]!.trim() === "") lines.pop();
  if (!lines.length) return { status: "error", error: "The file is empty." };

  const delimiter = detectDelimiter(text);
  const header = splitLine(lines[0]!, delimiter).map((h) => h.trim());
  const columns = detectColumns(header);
  if (!columns) {
    return {
      status: "error",
      error: `Couldn't find the required columns. The first row must include symbol (or name), quantity, and either price or value. Found: ${header.filter(Boolean).join(", ") || "no columns"}.`,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const accountIds = new Map<string, string>();
  const accounts: InvestmentAccount[] = [];
  const holdings: Holding[] = [];
  const rows: ParsedHoldingRow[] = [];
  let skipped = 0;

  const accountIdFor = (name: string): string => {
    const key = name.toLowerCase();
    const existing = accountIds.get(key);
    if (existing) return existing;
    const id = `acct-csv-${String(accounts.length + 1).padStart(3, "0")}`;
    accountIds.set(key, id);
    accounts.push({
      id,
      name,
      type: "other",
      currency: "USD",
      cashCents: 0,
      valuationTimestamp: today,
      source: "imported",
    });
    return id;
  };

  for (let li = 1; li < lines.length; li++) {
    const cells = splitLine(lines[li]!, delimiter);
    const line = li + 1;
    const symbol = columns.symbol !== null ? (cells[columns.symbol] ?? "").trim().toUpperCase() : "";
    const name = columns.name !== null ? (cells[columns.name] ?? "").trim() : "";
    const label = name || symbol;
    const rawQty = columns.quantity !== null ? (cells[columns.quantity] ?? "") : "";
    const rawPrice = columns.price !== null ? (cells[columns.price] ?? "") : "";
    const rawValue = columns.value !== null ? (cells[columns.value] ?? "") : "";

    const base: ParsedHoldingRow = { line, label: label || "(blank)" };

    if (!label) {
      rows.push({ ...base, issue: "Missing symbol and name" });
      skipped++;
      continue;
    }
    const quantity = parseQuantity(rawQty);
    if (!quantity) {
      rows.push({ ...base, issue: `Unreadable quantity "${rawQty.trim()}"` });
      skipped++;
      continue;
    }
    const price = rawPrice.trim() ? parseCsvAmount(rawPrice) : null;
    const value = rawValue.trim() ? parseCsvAmount(rawValue) : null;
    if (rawPrice.trim() && !price) {
      rows.push({ ...base, issue: `Unreadable price "${rawPrice.trim()}"` });
      skipped++;
      continue;
    }
    if (rawValue.trim() && !value) {
      rows.push({ ...base, issue: `Unreadable value "${rawValue.trim()}"` });
      skipped++;
      continue;
    }
    if (!price && !value) {
      rows.push({ ...base, issue: "Needs a price or a total value" });
      skipped++;
      continue;
    }

    const accountName = columns.account !== null ? (cells[columns.account] ?? "").trim() : "";
    const accountId = accountIdFor(accountName || "Imported portfolio");
    const assetClass = columns.assetClass !== null ? parseAssetClass(cells[columns.assetClass] ?? "") : "unknown";
    const costBasis = columns.costBasis !== null && (cells[columns.costBasis] ?? "").trim()
      ? parseCsvAmount(cells[columns.costBasis] ?? "")
      : null;
    const rawDate = columns.date !== null ? (cells[columns.date] ?? "") : "";
    const date = rawDate.trim() ? parseCsvDate(rawDate) : null;

    const holding: Holding = {
      id: `hold-csv-${String(holdings.length + 1).padStart(4, "0")}`,
      accountId,
      symbol: symbol || null,
      name: label,
      assetClass,
      quantity,
      latestPrice: price ? (price.cents / 100).toString() : null,
      priceTimestamp: price ? (date ?? today) : null,
      suppliedValueCents: value ? value.cents : null,
      suppliedValueDate: value ? (date ?? today) : null,
      costBasisCents: costBasis ? costBasis.cents : null,
      source: "imported",
    };
    rows.push(base);
    holdings.push(holding);
  }

  return { status: "ok", accounts, holdings, rows, skipped };
}
