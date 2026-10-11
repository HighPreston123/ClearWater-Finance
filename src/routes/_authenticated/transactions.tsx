import { AudioSummaryControls } from "@/components/integrations/AudioSummaryControls";
import { transactionsAudioText } from "@/lib/finance/pageAudioText";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Undo2 } from "lucide-react";
import { useDerived } from "@/store/useDerived";
import { useFinanceStore } from "@/store/FinanceStore";
import { PageHeader, GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { CsvSettingsLink } from "@/components/common/CsvHelp";
import { ManualTransactionCard } from "@/components/transactions/ManualTransactionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/types/finance";
import { formatCents, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Clearwater Financial Wellness" },
      { name: "description", content: "Browse, filter, and recategorize your transactions, or import your own CSV export." },
      { property: "og:title", content: "Transactions — Clearwater Financial Wellness" },
      { property: "og:description", content: "Browse, filter, and recategorize your transactions, or import your own CSV export." },
    ],
  }),
  component: TransactionsPage,
});

const PAGE_SIZE = 200;

function TransactionsPage() {
  const d = useDerived();
  const store = useFinanceStore();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return d.inRange.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (q && !`${t.merchant} ${t.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [d.inRange, search, typeFilter, categoryFilter]);

  const shown = filtered.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle={`Showing ${filtered.length} of ${d.inRange.length} transaction(s) for ${d.label}.`}
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AudioSummaryControls text={transactionsAudioText({ periodLabel: d.label, summary: d.summary, shown: filtered.length, total: d.inRange.length })} />
            <StatusBadge tone="info">
              {store.transactionSource === "csv" ? "Your CSV data" : store.transactionSource === "nessie" ? "Connected data" : "Sample data"}
            </StatusBadge>
            <Button variant="glass" size="sm" onClick={store.undo} disabled={!store.undoLabel}>
              <Undo2 className="h-4 w-4" aria-hidden /> {store.undoLabel ? `Undo: ${store.undoLabel}` : "Undo"}
            </Button>
          </div>
        }
      />

      <GlassCard>
        <CardTitle>Find and recategorize</CardTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="txn-search" className="text-xs text-muted-foreground">Search</Label>
            <Input
              id="txn-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Merchant or description…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="txn-type" className="text-xs text-muted-foreground">Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger id="txn-type" className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="txn-category" className="text-xs text-muted-foreground">Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger id="txn-category" className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-2 font-semibold">Date</th>
                <th className="p-2 font-semibold">Merchant</th>
                <th className="p-2 font-semibold">Description</th>
                <th className="p-2 font-semibold">Category</th>
                <th className="p-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className="border-b last:border-b-0">
                  <td className="p-2 whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="p-2 font-medium">{t.merchant}</td>
                  <td className="p-2 text-muted-foreground">{t.description}</td>
                  <td className="p-2">
                    <Select
                      value={t.category}
                      onValueChange={(c) => store.recategorize([t.id], c as (typeof CATEGORIES)[number], `Reclassify ${t.merchant}`)}
                    >
                      <SelectTrigger className="h-8 w-36 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className={cn("p-2 text-right tabular-nums", t.type === "income" && "text-success")}>
                    {t.type === "income" ? "+" : t.type === "expense" ? "−" : "⇄ "}{formatCents(t.amount)}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No transactions match these filters.</td></tr>
              )}
            </tbody>
          </table>
          {filtered.length > shown.length && (
            <p className="p-2 text-xs text-muted-foreground">Showing the first {PAGE_SIZE} of {filtered.length} matching rows — narrow the filters to see more.</p>
          )}
        </div>

        <Note>
          Changing a category here recalculates every page, and the change is saved to your account. Undo restores the previous categories.
        </Note>
      </GlassCard>

      <ManualTransactionCard />
      <CsvSettingsLink section="csv-transactions" title="Import transactions" text="Upload your bank or card statement CSV in Settings. It explains each column and where to download it." />
    </div>
  );
}
