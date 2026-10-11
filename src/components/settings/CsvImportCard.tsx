import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp } from "lucide-react";
import { useFinanceStore } from "@/store/FinanceStore";
import { GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseTransactionsCsv, type CsvImportOptions } from "@/lib/csv/csvImport";
import { formatCents, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CsvGuide } from "@/components/common/CsvHelp";
import type { Transaction } from "@/types/finance";

const REQUIRED_HEADERS = "Date, Merchant (or Description), Amount. Optional: Description, Type, Category.";

export function CsvImportCard() {
  const store = useFinanceStore();
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [opts, setOpts] = useState<CsvImportOptions>({ positiveMeansIncome: true });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setFileName(file.name);
      setText(String(reader.result ?? ""));
    };
    reader.onerror = () => toast.error(`Couldn't read ${file.name}`);
    reader.readAsText(file);
  }, []);

  const result = useMemo(
    () => (text ? parseTransactionsCsv(text, opts) : null),
    [text, opts],
  );

  const importNow = () => {
    if (!result || result.status !== "ok" || !result.transactions.length) return;
    const txns: Transaction[] = result.transactions;
    store.importTransactions(txns);
    toast.success(`Imported ${txns.length} transaction(s) from ${fileName ?? "CSV"}${result.skipped ? ` · ${result.skipped} row(s) skipped` : ""}`);
    setFileName(null);
    setText(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const error = result && result.status === "error" ? result.error : null;
  const ok = result && result.status === "ok" ? result : null;
  const issues = ok ? ok.rows.filter((r) => r.issue) : [];

  return (
    <GlassCard id="csv-transactions" className="scroll-mt-24">
      <CardTitle>Import transactions from CSV</CardTitle>
      <p className="text-sm text-muted-foreground">
        Bring your own bank export. The file's data replaces the current transaction set (undoable). Expected headers: {REQUIRED_HEADERS}
      </p>
      <CsvGuide
        columns={[
          { name: "Date", required: true, what: "The day the purchase or deposit posted.", example: "2026-09-14" },
          { name: "Merchant", required: true, what: "Who you paid or who paid you. A Description column works instead.", example: "Trader Joe's" },
          { name: "Amount", required: true, what: "Dollar amount. Choose below whether positive numbers mean money in or money out.", example: "-54.20" },
          { name: "Description", what: "Extra memo text from your bank.", example: "Groceries" },
          { name: "Type", what: "income, expense or transfer. Left blank, it is worked out from the amount's sign.", example: "expense" },
          { name: "Category", what: "Spending category. Left blank, it is guessed from the merchant.", example: "Groceries" },
        ]}
        whereToFind={[
          "Your bank or credit-card website: open the account, find Statements or Activity, and choose Download / Export as CSV.",
          "Pick a date range (the last 3–12 months works best). Export each account separately if needed.",
          "Budgeting apps (Mint exports, YNAB, Monarch) also offer a CSV export with these columns.",
        ]}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
        className={cn(
          "mt-3 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
          dragOver && "border-primary bg-secondary",
        )}
      >
        <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-semibold">{fileName ?? "Drag a .csv file here, or choose one"}</p>
        <p className="text-xs text-muted-foreground">Parsed entirely in your browser — nothing is uploaded.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          id="csv-file-input"
          aria-label="Choose a CSV file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
        />
        <Button variant="glass" onClick={() => inputRef.current?.click()}>Choose file</Button>
      </div>

      {fileName && ok && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge tone={ok.skipped ? "warn" : "ok"}>
              {ok.transactions.length} importable · {ok.skipped} skipped
            </StatusBadge>
            <div className="flex items-center gap-2">
              <Label htmlFor="csv-sign" className="text-xs text-muted-foreground">Positive amounts mean</Label>
              <Select value={opts.positiveMeansIncome ? "income" : "expense"} onValueChange={(v) => setOpts({ positiveMeansIncome: v === "income" })}>
                <SelectTrigger id="csv-sign" className="h-8 w-44 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-2 font-semibold">Date</th>
                  <th className="p-2 font-semibold">Merchant</th>
                  <th className="p-2 font-semibold">Type</th>
                  <th className="p-2 font-semibold">Category</th>
                  <th className="p-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ok.transactions.slice(0, 8).map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0">
                    <td className="p-2 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="p-2">{t.merchant}</td>
                    <td className="p-2">{t.type}</td>
                    <td className="p-2">{t.category}</td>
                    <td className={cn("p-2 text-right tabular-nums", t.type === "income" && "text-success")}>
                      {t.type === "income" ? "+" : t.type === "expense" ? "−" : "⇄ "}{formatCents(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ok.transactions.length > 8 && <p className="p-2 text-xs text-muted-foreground">Showing the first 8 of {ok.transactions.length} rows.</p>}
          </div>

          {issues.length > 0 && (
            <div className="rounded-2xl border bg-card p-3">
              <p className="text-sm font-semibold">{issues.length} row(s) will be skipped:</p>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                {issues.slice(0, 10).map((r) => (
                  <li key={r.line}>Line {r.line}: {r.issue}{r.merchant ? ` — ${r.merchant}` : ""}</li>
                ))}
                {issues.length > 10 && <li>…and {issues.length - 10} more.</li>}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="aero" onClick={importNow} disabled={!ok.transactions.length}>
              Import {ok.transactions.length} transaction(s)
            </Button>
            <Button variant="ghost" onClick={() => { setFileName(null); setText(null); if (inputRef.current) inputRef.current.value = ""; }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {fileName && error && (
        <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
          <p className="font-semibold">Couldn't parse {fileName}</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
      )}

      <Note>
        Negative amounts (or parentheses) always map to expenses; a type column (income/expense/debit/credit/transfer) overrides both. Unreadable rows are skipped, never guessed.
      </Note>
    </GlassCard>
  );
}
