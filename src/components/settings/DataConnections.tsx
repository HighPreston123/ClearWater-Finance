import { useEffect, useState } from "react";
import { GlassCard, CardTitle, StatusBadge, Note } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { useFinanceStore } from "@/store/FinanceStore";
import { FUTURE_ROUTES } from "@/config/features";
import { getNessieStatus } from "@/lib/nessie.functions";

export function DataConnections() {
  const { transactionSource, setTransactionSource } = useFinanceStore();
  const [nessie, setNessie] = useState<{ configured: boolean; reachable: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    getNessieStatus()
      .then((s) => alive && setNessie(s))
      .catch(() => alive && setNessie({ configured: false, reachable: false }));
    return () => {
      alive = false;
    };
  }, []);
  const nessieRow = !nessie
    ? { status: "off" as const, text: "Checking…", detail: "Contacting the banking-data layer." }
    : !nessie.configured
      ? { status: "off" as const, text: "Not connected", detail: "No API key configured on the server." }
      : nessie.reachable
        ? { status: "ok" as const, text: "Connected", detail: "Background banking-data layer is live (accounts, transactions, bills, loans)." }
        : { status: "off" as const, text: "Unavailable", detail: "Configured, but the service is not responding. Existing data is preserved." };
  const rows: { id: string; name: string; status: "ok" | "off"; text: string; detail: string }[] = [
    { id: "csv", name: "CSV import", status: transactionSource === "csv" ? "ok" : "off", text: transactionSource === "csv" ? "Active" : "Not used", detail: "Import your own bank export below." },
    { id: "nessie", name: "Nessie (transactions & advisors)", ...nessieRow },
    { id: "holdings", name: "Holdings import", status: "off", text: "Not connected", detail: `Future ${FUTURE_ROUTES.holdingsImport}` },
    { id: "market", name: "Stock / market data", status: "off", text: "Not connected", detail: `Future ${FUTURE_ROUTES.marketQuotes}` },
    { id: "ai", name: "AI explanations", status: "off", text: "Not connected", detail: `Future ${FUTURE_ROUTES.insights}` },
    { id: "audio", name: "Audio summary", status: "off", text: "Not connected", detail: `Future ${FUTURE_ROUTES.audioSummary}` },
  ];

  return (
    <GlassCard>
      <CardTitle>Data connections</CardTitle>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.detail}</p>
            </div>
            <StatusBadge tone={r.status}>{r.text}</StatusBadge>
          </li>
        ))}
      </ul>
      {nessie?.configured && nessie.reachable && (
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => setTransactionSource("nessie")}>
          Load Nessie transactions
        </Button>
      )}
      <Note>
        {transactionSource === "nessie"
          ? "Nessie transactions are active. Importing a CSV or adding transactions manually works alongside it."
          : "Your data comes only from what you import or add yourself."}
      </Note>
    </GlassCard>
  );
}
