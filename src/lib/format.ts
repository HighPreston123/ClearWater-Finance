const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const formatCents = (c: number) => usd.format(c / 100);
export const formatCentsShort = (c: number) => usd0.format(c / 100);
/** micros = millionths of a dollar (bigint). Rounded only for display. */
export const formatMicros = (m: bigint) => usd.format(Number(m) / 1_000_000);
export const formatPct = (p: number | null, digits = 1) => (p === null ? "Unavailable" : `${p.toFixed(digits)}%`);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDate(d: string) {
  const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}
export function monthLabel(month: string, long = false) {
  const [y = 0, m = 1] = month.split("-").map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`;
}
export function formatTimestamp(ts: string | null) {
  if (!ts) return "No timestamp";
  return formatDate(ts.slice(0, 10));
}
