import type { DateRange, Transaction } from "@/types/finance";

/** Calendar-date helpers. All math is done in UTC on YYYY-MM-DD strings. */
export const toDayNumber = (d: string) => {
  const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
};
export const daysBetween = (a: string, b: string) => toDayNumber(b) - toDayNumber(a);
export const monthKey = (d: string) => d.slice(0, 7);
export function monthStart(month: string) {
  return `${month}-01`;
}
export function monthEnd(month: string) {
  const [y = 0, m = 1] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}
export function prevMonth(month: string) {
  const [y = 0, m = 1] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
export const inRange = (d: string, r: DateRange) => d >= r.start && d <= r.end;

export function datasetBounds(txns: Transaction[]): DateRange | null {
  if (!txns.length) return null;
  let start = txns[0]!.date;
  let end = txns[0]!.date;
  for (const t of txns) {
    if (t.date < start) start = t.date;
    if (t.date > end) end = t.date;
  }
  return { start, end };
}

export function monthsBetween(r: DateRange): string[] {
  const out: string[] = [];
  let m = monthKey(r.start);
  const last = monthKey(r.end);
  while (m <= last) {
    out.push(m);
    const [y = 0, mo = 1] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  return out;
}

/** Months fully covered by the dataset's first..last transaction date. */
export function datasetCompleteMonths(txns: Transaction[]): string[] {
  const b = datasetBounds(txns);
  if (!b) return [];
  return monthsBetween(b).filter((m) => monthStart(m) >= b.start && monthEnd(m) <= b.end);
}

/** Months complete in the dataset and fully inside the selected range. */
export function completeMonthsInRange(txns: Transaction[], range: DateRange): string[] {
  return datasetCompleteMonths(txns).filter((m) => monthStart(m) >= range.start && monthEnd(m) <= range.end);
}

export function monthRange(month: string): DateRange {
  return { start: monthStart(month), end: monthEnd(month) };
}
