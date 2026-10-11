import { CalendarRange } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanceStore, defaultRange } from "@/store/FinanceStore";
import { datasetBounds, datasetCompleteMonths, monthRange, monthsBetween } from "@/lib/finance/dates";
import { monthLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";

/** Shared date range used by all transaction-based metrics and filters. */
export function RangePicker() {
  const { transactions, range, setRange } = useFinanceStore();
  const b = datasetBounds(transactions);
  const months = b ? monthsBetween(b) : [];
  const complete = new Set(datasetCompleteMonths(transactions));
  const currentKey = months.find((m) => { const r = monthRange(m); return r.start === range.start && r.end === range.end; })
    ?? (b && range.start === b.start && range.end === b.end ? "all" : "custom");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarRange className="h-4 w-4 text-primary" aria-hidden />
      <label className="sr-only" htmlFor="range-select">Date range</label>
      <Select
        value={currentKey}
        onValueChange={(v) => {
          if (v === "all" && b) setRange(b);
          else if (v === "default") setRange(defaultRange(transactions));
          else if (v !== "custom") setRange(monthRange(v));
        }}
      >
        <SelectTrigger id="range-select" className="h-9 w-52 rounded-full bg-card"><SelectValue /></SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={m}>{monthLabel(m, true)}{complete.has(m) ? "" : " (partial)"}</SelectItem>
          ))}
          <SelectItem value="all">All available data</SelectItem>
          <SelectItem value="custom" disabled>Custom range</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1 text-xs">
        <Input aria-label="Range start" type="date" value={range.start} max={range.end} onChange={(e) => e.target.value && setRange({ ...range, start: e.target.value })} className="h-9 w-36 rounded-full bg-card" />
        <span aria-hidden>–</span>
        <Input aria-label="Range end" type="date" value={range.end} min={range.start} onChange={(e) => e.target.value && setRange({ ...range, end: e.target.value })} className="h-9 w-36 rounded-full bg-card" />
      </div>
    </div>
  );
}
