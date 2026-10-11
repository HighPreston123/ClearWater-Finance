import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp } from "lucide-react";
import { useFinanceStore } from "@/store/FinanceStore";
import { GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { parseHoldingsCsv } from "@/lib/csv/holdingsImport";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";

const REQUIRED_HEADERS = "Symbol (or Name), Quantity, and Price or Value. Optional: Account, Asset class, Cost basis, Date.";

export function HoldingsImportCard() {
  const store = useFinanceStore();
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
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

  const result = useMemo(() => (text ? parseHoldingsCsv(text) : null), [text]);

  const importNow = () => {
    if (!result || result.status !== "ok" || !result.holdings.length) return;
    store.importHoldings(result.accounts, result.holdings);
    toast.success(`Imported ${result.holdings.length} holding(s) from ${fileName ?? "CSV"}${result.skipped ? ` · ${result.skipped} row(s) skipped` : ""}`);
    setFileName(null);
    setText(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const error = result && result.status === "error" ? result.error : null;
  const ok = result && result.status === "ok" ? result : null;
  const issues = ok ? ok.rows.filter((r) => r.issue) : [];

  return (
    <GlassCard>
      <CardTitle>Import investments from CSV</CardTitle>
      <p className="text-sm text-muted-foreground">
        Bring your own brokerage export. This replaces your current investment accounts and holdings — it never touches your bank transactions. Expected headers: {REQUIRED_HEADERS}
      </p>

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
          id="holdings-csv-file-input"
          aria-label="Choose a holdings CSV file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
        />
        <Button variant="glass" onClick={() => inputRef.current?.click()}>Choose file</Button>
      </div>

      {fileName && ok && (
        <div className="mt-4 space-y-3">
          <StatusBadge tone={ok.skipped ? "warn" : "ok"}>
            {ok.holdings.length} importable · {ok.skipped} skipped · {ok.accounts.length} account(s)
          </StatusBadge>

          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-2 font-semibold">Symbol</th>
                  <th className="p-2 font-semibold">Name</th>
                  <th className="p-2 text-right font-semibold">Quantity</th>
                  <th className="p-2 text-right font-semibold">Price</th>
                  <th className="p-2 text-right font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                {ok.holdings.slice(0, 8).map((h) => (
                  <tr key={h.id} className="border-b last:border-b-0">
                    <td className="p-2 font-semibold">{h.symbol ?? "—"}</td>
                    <td className="p-2">{h.name}</td>
                    <td className="p-2 text-right tabular-nums">{h.quantity}</td>
                    <td className="p-2 text-right tabular-nums">{h.latestPrice ? formatCents(Math.round(Number(h.latestPrice) * 100)) : "—"}</td>
                    <td className="p-2 text-right tabular-nums">
                      {h.suppliedValueCents != null
                        ? formatCents(h.suppliedValueCents)
                        : h.latestPrice
                          ? formatCents(Math.round(Number(h.latestPrice) * Number(h.quantity) * 100))
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ok.holdings.length > 8 && <p className="p-2 text-xs text-muted-foreground">Showing the first 8 of {ok.holdings.length} rows.</p>}
          </div>

          {issues.length > 0 && (
            <div className="rounded-2xl border bg-card p-3">
              <p className="text-sm font-semibold">{issues.length} row(s) will be skipped:</p>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                {issues.slice(0, 10).map((r) => (
                  <li key={r.line}>Line {r.line}: {r.issue}{r.label ? ` — ${r.label}` : ""}</li>
                ))}
                {issues.length > 10 && <li>…and {issues.length - 10} more.</li>}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="aero" onClick={importNow} disabled={!ok.holdings.length}>
              Import {ok.holdings.length} holding(s)
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
        Rows are grouped into accounts by the optional account column; without one, everything lands in a single "Imported portfolio" account. Unreadable rows are skipped, never guessed.
      </Note>
    </GlassCard>
  );
}
