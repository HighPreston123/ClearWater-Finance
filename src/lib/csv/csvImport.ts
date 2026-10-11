/**
 * CSV transaction import — pure parsing/mapping only. No UI, no storage.
 *
 * Rules:
 * - Requires a header row with at least date, merchant (or description), and amount columns.
 * - Amounts are parsed into positive integer cents; `type` carries the meaning.
 * - `null` = unknown; rows with unparseable required fields are skipped and reported, never coerced.
 * - Categories come from the file when provided and valid, otherwise from the shared rules.
 */
import type { Category, Transaction, TransactionType } from "@/types/finance";
import { CATEGORIES } from "@/types/finance";
import { categorizeByRules } from "@/lib/finance/categorization";
import { CHECKING } from "@/data/sampleTransactions";

export interface CsvColumns {
  date: number;
  merchant: number;
  amount: number;
  description: number | null;
  type: number | null;
  category: number | null;
}

export interface CsvImportOptions {
  /** When amount is positive and no type column says otherwise: income or expense? */
  positiveMeansIncome: boolean;
}

export interface ParsedRow {
  line: number;
  merchant: string;
  date: string;
  amountCents: number;
  type: TransactionType;
  category: Category;
  issue?: string;
}

export type CsvParseResult =
  | { status: "error"; error: string }
  | {
      status: "ok";
      delimiter: string;
      columns: CsvColumns;
      rows: ParsedRow[];
      transactions: Transaction[];
      skipped: number;
    };

const HEADER_ALIASES: { field: keyof CsvColumns | "unused"; patterns: RegExp[] }[] = [
  { field: "date", patterns: [/^date$/, /^transaction ?date$/, /^posted ?date$/, /^posting ?date$/, /^post ?date$/] },
  { field: "merchant", patterns: [/^merchant$/, /^payee$/, /^name$/, /^vendor$/, /^title$/] },
  { field: "amount", patterns: [/^amount$/, /^transaction ?amount$/, /^value$/, /^amount ?\(usd\)$/, /^amount ?\(.+\)?$/] },
  { field: "description", patterns: [/^description$/, /^memo$/, /^note$/, /^details$/, /^narrative$/] },
  { field: "type", patterns: [/^type$/, /^transaction ?type$/, /^debit\/credit$/, /^credit ?or ?debit$/] },
  { field: "category", patterns: [/^category$/] },
];

/** Split a single CSV line honoring double quotes and "" escapes. */
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
  return counts.sort((a, b) => b[1] - a[1])[0]![1] > 0 ? counts.sort((a, b) => b[1] - a[1])[0]![0] : ",";
}

function detectColumns(header: string[]): CsvColumns | null {
  const cols: Partial<CsvColumns> = {};
  const claimed = new Set<number>();
  for (let i = 0; i < header.length; i++) {
    const name = (header[i] ?? "").trim().toLowerCase();
    if (!name || claimed.has(i)) continue;
    for (const alias of HEADER_ALIASES) {
      if (alias.field === "unused" || cols[alias.field as keyof CsvColumns] !== undefined) continue;
      if (alias.patterns.some((p) => p.test(name))) {
        cols[alias.field as keyof CsvColumns] = i;
        claimed.add(i);
        break;
      }
    }
  }
  // A "description"-like column can stand in for merchant when no merchant column exists.
  if (cols.merchant === undefined && typeof cols.description === "number") {
    cols.merchant = cols.description;
    cols.description = null;
  }
  if (cols.date === undefined || cols.merchant === undefined || cols.amount === undefined) return null;
  return cols as CsvColumns;
}

/** Returns YYYY-MM-DD or null. Accepted: YYYY-MM-DD, YYYY/MM/DD, M/D/YYYY, M/D/YY (→ 20YY). */
export function parseCsvDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    return valid(y, mo, d) ? iso(y, mo, d) : null;
  }
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const mo = Number(m[1]), d = Number(m[2]), y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return valid(y, mo, d) ? iso(y, mo, d) : null;
  }
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    return valid(y, mo, d) ? iso(y, mo, d) : null;
  }
  return null;
}

const iso = (y: number, mo: number, d: number) =>
  `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function valid(y: number, mo: number, d: number): boolean {
  if (y < 1970 || y > 2100 || mo < 1 || mo > 12 || d < 1) return false;
  const dim = new Date(y, mo, 0).getDate(); // day count of month `mo`
  return d <= dim;
}

/** Returns positive integer cents plus sign info, or null when unparseable. */
export function parseCsvAmount(raw: string): { cents: number; negative: boolean } | null {
  let s = raw.trim().replace(/^\$/, "").replace(/\s/g, "");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  if (s.endsWith("-")) { negative = true; s = s.slice(0, -1); }
  if (s.startsWith("+")) s = s.slice(1);
  if (!/^\d*(\.\d{0,2})?$/.test(s) || s === "" || s === ".") return null;
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  if (cents < 0) return null;
  return { cents, negative };
}

function parseCsvType(raw: string, negative: boolean, opts: CsvImportOptions): TransactionType {
  const s = raw.trim().toLowerCase();
  if (s) {
    if (/^(income|credit|deposit|payment received|in)$/.test(s)) return "income";
    if (/^(expense|debit|withdrawal|purchase|charge|out)$/.test(s)) return "expense";
    if (/^transfer/.test(s)) return "transfer";
  }
  if (negative) return "expense";
  return opts.positiveMeansIncome ? "income" : "expense";
}

function parseCsvCategory(raw: string, merchant: string, description: string, type: TransactionType): Category {
  const s = raw.trim().toLowerCase();
  if (s) {
    const hit = CATEGORIES.find((c) => c.toLowerCase() === s);
    if (hit) return hit;
  }
  return categorizeByRules(merchant, description, type);
}

export function parseTransactionsCsv(text: string, opts: CsvImportOptions): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l, i, arr) => l.trim() !== "" || i < arr.length - 1);
  while (lines.length && lines[lines.length - 1]!.trim() === "") lines.pop();
  if (!lines.length) return { status: "error", error: "The file is empty." };

  const delimiter = detectDelimiter(text);
  const header = splitLine(lines[0]!, delimiter).map((h) => h.trim());
  const columns = detectColumns(header);
  if (!columns) {
    return {
      status: "error",
      error: `Couldn't find the required columns. The first row must include date, merchant (or description), and amount. Found: ${header.filter(Boolean).join(", ") || "no columns"}.`,
    };
  }

  const rows: ParsedRow[] = [];
  const transactions: Transaction[] = [];
  let skipped = 0;

  for (let li = 1; li < lines.length; li++) {
    const cells = splitLine(lines[li]!, delimiter);
    const line = li + 1;
    const rawDate = cells[columns.date] ?? "";
    const merchant = (cells[columns.merchant] ?? "").trim();
    const rawAmount = cells[columns.amount] ?? "";
    const description = columns.description !== null ? (cells[columns.description] ?? "").trim() : merchant;
    const rawType = columns.type !== null ? (cells[columns.type] ?? "") : "";
    const rawCategory = columns.category !== null ? (cells[columns.category] ?? "") : "";

    const date = parseCsvDate(rawDate);
    const amount = parseCsvAmount(rawAmount);
    const base = { line, merchant, date: date ?? rawDate.trim(), amountCents: amount?.cents ?? 0, type: "expense" as TransactionType, category: "Other" as Category };

    if (!merchant) {
      rows.push({ ...base, type: "expense", category: "Other", issue: "Missing merchant/description" });
      skipped++;
      continue;
    }
    if (!date) {
      rows.push({ ...base, type: "expense", category: "Other", issue: `Unreadable date "${rawDate.trim()}"` });
      skipped++;
      continue;
    }
    if (!amount) {
      rows.push({ ...base, date, type: "expense", category: "Other", issue: `Unreadable amount "${rawAmount.trim()}"` });
      skipped++;
      continue;
    }
    if (amount.cents === 0) {
      rows.push({ ...base, date, type: "expense", category: "Other", issue: "Amount is zero" });
      skipped++;
      continue;
    }

    const type = parseCsvType(rawType, amount.negative, opts);
    const category = parseCsvCategory(rawCategory, merchant, description, type);
    const txn: Transaction = {
      id: `txn-csv-${String(transactions.length + 1).padStart(4, "0")}`,
      date,
      merchant,
      amount: amount.cents,
      type,
      category,
      categorySource: rawCategory.trim() && CATEGORIES.some((c) => c.toLowerCase() === rawCategory.trim().toLowerCase()) ? "manual" : "rule",
      description: description || merchant,
      accountId: CHECKING,
    };
    rows.push({ line, merchant, date, amountCents: amount.cents, type, category });
    transactions.push(txn);
  }

  return { status: "ok", delimiter, columns, rows, transactions, skipped };
}
