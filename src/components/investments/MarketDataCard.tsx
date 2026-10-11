import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshCw, Plus, X } from "lucide-react";
import { GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFinanceStore } from "@/store/FinanceStore";
import { getDailyBars, getLatestPrices, getWatchlist, setWatchSymbol } from "@/lib/marketdata.functions";

type Latest = { symbol: string; price: string | null; tradeTs: string | null; fetchedAt: string; status: string };
type Bars = { symbol: string; bars: { t: string; c: number; fetchedAt: string }[] };
const DEFAULT_WATCH = ["AAPL", "MSFT", "SPY"];
const SYM = /^[A-Z][A-Z0-9.]{0,9}$/;

const fmtTs = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const isStale = (iso: string | null) => !iso || Date.now() - new Date(iso).getTime() > 15 * 60_000;

export function MarketDataCard() {
  const { holdings, updateHoldingPrices } = useFinanceStore();
  const fetchLatest = useServerFn(getLatestPrices);
  const fetchBars = useServerFn(getDailyBars);
  const fetchWatch = useServerFn(getWatchlist);
  const saveWatch = useServerFn(setWatchSymbol);

  const [watch, setWatch] = useState<string[]>([]);
  const [latest, setLatest] = useState<Record<string, Latest>>({});
  const [chart, setChart] = useState<Bars | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newSym, setNewSym] = useState("");

  const owned = useMemo(() => [...new Set(holdings.map((h) => h.symbol?.toUpperCase()).filter((s): s is string => !!s && SYM.test(s)))], [holdings]);
  const all = useMemo(() => [...new Set([...watch, ...owned])], [watch, owned]);

  useEffect(() => {
    fetchWatch().then(async (w) => {
      if (w.length === 0) {
        for (const s of DEFAULT_WATCH) await saveWatch({ data: { symbol: s, add: true } });
        w = DEFAULT_WATCH;
      }
      setWatch(w);
    }).catch(() => setError("Could not load your watchlist."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh() {
    if (!all.length) return;
    setBusy(true); setError(null);
    const r = await fetchLatest({ data: { symbols: all.slice(0, 50) } }).catch(() => ({ status: "error" as const, message: "Market data request failed." }));
    setBusy(false);
    if (r.status !== "ok") return setError(r.message);
    const map = Object.fromEntries(r.data.map((q) => [q.symbol, q]));
    setLatest(map);
    // Only holdings the user already owns are re-priced; unsupported symbols keep no price (never zero).
    updateHoldingPrices(Object.fromEntries(r.data.filter((q) => q.status === "ok" && q.price && owned.includes(q.symbol)).map((q) => [q.symbol, { price: q.price!, ts: q.tradeTs! }])));
  }

  async function openChart(symbol: string) {
    setSelected(symbol); setChart(null); setError(null);
    const r = await fetchBars({ data: { symbol, days: 365 } }).catch(() => ({ status: "error" as const, message: "Market data request failed." }));
    if (r.status !== "ok") return setError(r.message);
    setChart(r.data);
  }

  useEffect(() => { if (all.length) refresh(); }, [all.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    const s = newSym.trim().toUpperCase();
    if (!SYM.test(s) || watch.includes(s)) return;
    await saveWatch({ data: { symbol: s, add: true } }).then(() => setWatch((w) => [...w, s])).catch(() => setError("Could not add symbol (limit 25)."));
    setNewSym("");
  }
  async function remove(s: string) {
    await saveWatch({ data: { symbol: s, add: false } }).then(() => setWatch((w) => w.filter((x) => x !== s))).catch(() => {});
  }

  return (
    <GlassCard>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Market prices</CardTitle>
        <div className="flex items-center gap-2">
          <StatusBadge tone="pending">Alpaca / IEX</StatusBadge>
          <Button variant="glass" size="sm" onClick={refresh} disabled={busy}><RefreshCw className={busy ? "animate-spin" : ""} /> Refresh prices</Button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-3 divide-y divide-border/50">
        {all.map((s) => {
          const q = latest[s];
          return (
            <div key={s} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <button className="text-left" onClick={() => openChart(s)}>
                <span className="font-bold">{s}</span>
                <span className="ml-2 text-xs text-muted-foreground">{owned.includes(s) ? "In your holdings" : "Watchlist"}</span>
              </button>
              <div className="flex items-center gap-3 text-sm">
                {q?.status === "ok" ? (
                  <>
                    <span className="tabular-nums font-semibold">${Number(q.price).toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">Last trade {fmtTs(q.tradeTs)}{isStale(q.tradeTs) ? " · market closed / most recent" : ""}</span>
                  </>
                ) : q ? <span className="text-xs text-muted-foreground">No price available</span> : <span className="text-xs text-muted-foreground">—</span>}
                {watch.includes(s) && <button aria-label={`Remove ${s}`} onClick={() => remove(s)}><X className="h-4 w-4 text-muted-foreground" /></button>}
              </div>
            </div>
          );
        })}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input value={newSym} onChange={(e) => setNewSym(e.target.value)} placeholder="Add symbol, e.g. NVDA" className="max-w-48" />
        <Button variant="glass" size="sm" type="submit"><Plus /> Watch</Button>
      </form>
      {selected && (
        <div className="mt-5">
          <p className="text-sm font-bold">{selected} · daily closes, last 12 months</p>
          {chart ? (
            chart.bars.length ? (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chart.bars.map((b) => ({ d: b.t.slice(0, 10), c: b.c }))}>
                      <XAxis dataKey="d" tick={{ fontSize: 11 }} minTickGap={40} />
                      <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={50} />
                      <Tooltip />
                      <Line type="monotone" dataKey="c" dot={false} stroke="var(--primary)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground">Alpaca / IEX · {chart.bars.length} bars · latest bar {chart.bars.at(-1)!.t.slice(0, 10)} · stored {fmtTs(chart.bars.at(-1)!.fetchedAt)}</p>
              </>
            ) : <p className="text-sm text-muted-foreground">No history available for this symbol.</p>
          ) : !error && <p className="text-sm text-muted-foreground">Loading history…</p>}
        </div>
      )}
      <Note>Prices come from Alpaca's free IEX feed and may differ slightly from consolidated prices. Watchlist symbols are tracked, not owned. Charts show the symbol's price, not your portfolio's past performance.</Note>
    </GlassCard>
  );
}
