import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshCw, Plus, X } from "lucide-react";
import { GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFinanceStore } from "@/store/FinanceStore";
import { getDailyBars, getLatestPrices, getWatchlist, setWatchSymbol } from "@/lib/marketdata.functions";

type Latest = { symbol: string; price: string | null; tradeTs: string | null; fetchedAt: string; status: string };
const DEFAULT_WATCH = ["AAPL", "MSFT", "SPY"];
const SYM = /^[A-Z][A-Z0-9.]{0,9}$/;
const FAIL = { status: "error" as const, message: "Market data request failed." };

const fmtTs = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const isStale = (iso: string | null) => !iso || Date.now() - new Date(iso).getTime() > 15 * 60_000;

/**
 * Watchlist, latest prices, and daily bars are cached queries scoped to the signed-in user,
 * so returning to Investments shows the last results immediately. Bars are keyed by symbol,
 * so a slow response for a previously clicked symbol can never replace the current chart.
 */
export function MarketDataCard() {
  const { holdings, updateHoldingPrices, userId } = useFinanceStore();
  const qc = useQueryClient();
  const fetchLatest = useServerFn(getLatestPrices);
  const fetchBars = useServerFn(getDailyBars);
  const fetchWatch = useServerFn(getWatchlist);
  const saveWatch = useServerFn(setWatchSymbol);

  const [selected, setSelected] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newSym, setNewSym] = useState("");

  const watchKey = ["market-watchlist", userId] as const;
  const watchQ = useQuery({
    queryKey: watchKey,
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let w = await fetchWatch();
      if (w.length === 0) {
        for (const s of DEFAULT_WATCH) await saveWatch({ data: { symbol: s, add: true } });
        w = DEFAULT_WATCH;
      }
      return w;
    },
  });
  const watch = useMemo(() => watchQ.data ?? [], [watchQ.data]);

  const owned = useMemo(() => [...new Set(holdings.map((h) => h.symbol?.toUpperCase()).filter((s): s is string => !!s && SYM.test(s)))], [holdings]);
  const all = useMemo(() => [...new Set([...watch, ...owned])], [watch, owned]);
  const symbolsKey = all.slice(0, 50).join(",");

  const latestQ = useQuery({
    queryKey: ["market-latest", userId, symbolsKey],
    enabled: !!userId && all.length > 0,
    staleTime: 60_000, // matches the server's ~60s latest-trade cache
    placeholderData: (prev) => prev,
    queryFn: () => fetchLatest({ data: { symbols: symbolsKey.split(",") } }).catch(() => FAIL),
  });
  const latest = useMemo<Record<string, Latest>>(
    () => (latestQ.data?.status === "ok" ? Object.fromEntries(latestQ.data.data.map((q) => [q.symbol, q])) : {}),
    [latestQ.data],
  );

  // Owned symbols the feed cannot quote (some mutual funds, e.g. FXAIX) drop out once the lookup
  // confirms there is no price — they would only ever read "No price available". Watchlist symbols
  // always stay so they can still be removed, and nothing is hidden while a lookup is pending.
  const listed = useMemo(
    () => all.filter((s) => watch.includes(s) || !latest[s] || (latest[s]!.status === "ok" && !!latest[s]!.price)),
    [all, watch, latest],
  );


  // Only holdings the user already owns are re-priced; unsupported symbols keep no price (never zero).
  // updateHoldingPrices returns the same state when prices/timestamps are unchanged.
  useEffect(() => {
    if (latestQ.data?.status !== "ok") return;
    updateHoldingPrices(Object.fromEntries(latestQ.data.data.filter((q) => q.status === "ok" && q.price && owned.includes(q.symbol)).map((q) => [q.symbol, { price: q.price!, ts: q.tradeTs! }])));
  }, [latestQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const barsQ = useQuery({
    queryKey: ["market-bars", userId, selected],
    enabled: !!userId && !!selected,
    staleTime: 10 * 60_000,
    queryFn: () => fetchBars({ data: { symbol: selected!, days: 365 } }).catch(() => FAIL),
  });
  const chart = barsQ.data?.status === "ok" ? barsQ.data.data : null;

  const busy = latestQ.isFetching;
  const error = actionError
    ?? (watchQ.isError ? "Could not load your watchlist." : null)
    ?? (latestQ.data && latestQ.data.status !== "ok" ? latestQ.data.message : null)
    ?? (selected && barsQ.data && barsQ.data.status !== "ok" ? barsQ.data.message : null);

  function refresh() {
    setActionError(null);
    void latestQ.refetch();
  }
  function openChart(symbol: string) {
    setActionError(null);
    setSelected(symbol);
  }
  async function add() {
    const s = newSym.trim().toUpperCase();
    if (!SYM.test(s) || watch.includes(s)) return;
    await saveWatch({ data: { symbol: s, add: true } })
      .then(() => qc.setQueryData<string[]>(watchKey, (w) => [...(w ?? []), s]))
      .catch(() => setActionError("Could not add symbol (limit 25)."));
    setNewSym("");
  }
  async function remove(s: string) {
    await saveWatch({ data: { symbol: s, add: false } })
      .then(() => qc.setQueryData<string[]>(watchKey, (w) => (w ?? []).filter((x) => x !== s)))
      .catch(() => {});
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
        {listed.map((s) => {
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
