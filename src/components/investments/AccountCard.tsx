import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { GlassCard, StatusBadge } from "@/components/common/Glass";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCOUNT_TYPE_LABELS, ASSET_CLASS_LABELS, type Holding } from "@/types/investments";
import type { AccountValuation } from "@/lib/investments/valuation";
import { valueHolding, unrealizedGainMicros, parseDecimal } from "@/lib/investments/valuation";
import { holdingWeightPct } from "@/lib/investments/allocation";
import { formatCents, formatMicros, formatTimestamp } from "@/lib/format";
import { useFinanceStore } from "@/store/FinanceStore";

function HoldingRow({ h, portfolioTotal }: { h: Holding; portfolioTotal: bigint }) {
  const { updateHolding } = useFinanceStore();
  const [edit, setEdit] = useState(false);
  const [qty, setQty] = useState(h.quantity);
  const [price, setPrice] = useState(h.latestPrice ?? "");
  const v = valueHolding(h);
  const gain = unrealizedGainMicros(h, v);
  const w = holdingWeightPct(v.micros, portfolioTotal);
  const save = () => {
    if (parseDecimal(qty) === null || (price !== "" && parseDecimal(price) === null)) return;
    updateHolding(h.id, { quantity: qty, latestPrice: price === "" ? null : price, priceTimestamp: price === "" ? null : price !== h.latestPrice ? new Date().toISOString() : h.priceTimestamp });
    setEdit(false);
  };
  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold">{h.symbol ?? h.externalSecurityId ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{h.name}</p>
        {h.underlyingExposure && <p className="text-xs text-muted-foreground">Exposure: {h.underlyingExposure}</p>}
      </TableCell>
      <TableCell className="text-xs">{ASSET_CLASS_LABELS[h.assetClass]}</TableCell>
      <TableCell className="tabular-nums">
        {edit ? <Input aria-label="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} className="h-8 w-24 bg-card" /> : h.quantity}
      </TableCell>
      <TableCell className="tabular-nums">
        {edit ? <Input aria-label="Latest price" placeholder="No quote" value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 w-24 bg-card" /> : h.latestPrice ? `$${h.latestPrice}` : "No quote"}
      </TableCell>
      <TableCell className="tabular-nums">
        {v.micros === null ? <StatusBadge tone="warn">Valuation unavailable</StatusBadge> : (
          <>
            <p className="font-semibold">{formatMicros(v.micros)}</p>
            <p className="text-xs text-muted-foreground">{v.status === "supplied" ? "Supplied value" : "Quote"} · {formatTimestamp(v.asOf)}</p>
            {v.stale && <StatusBadge tone="pending">Stale</StatusBadge>}
          </>
        )}
      </TableCell>
      <TableCell className="tabular-nums text-xs">{w === null ? "—" : `${w.toFixed(1)}%`}</TableCell>
      <TableCell className="tabular-nums text-xs">
        {gain === null ? <span className="text-muted-foreground">No cost basis</span> : <span>{formatMicros(gain)}<br /><span className="text-muted-foreground">unrealized vs. {formatCents(h.costBasisCents!)} basis</span></span>}
      </TableCell>
      <TableCell className="text-xs"><StatusBadge tone={h.source === "sample" ? "off" : "info"}>{h.source}</StatusBadge></TableCell>
      <TableCell>
        {edit ? <Button size="icon" variant="ghost" aria-label="Save holding" onClick={save}><Check /></Button>
          : <Button size="icon" variant="ghost" aria-label={`Edit ${h.name}`} onClick={() => setEdit(true)}><Pencil /></Button>}
      </TableCell>
    </TableRow>
  );
}

export function AccountCard({ av, holdings, portfolioTotal }: { av: AccountValuation; holdings: Holding[]; portfolioTotal: bigint }) {
  const { updateAccount } = useFinanceStore();
  const a = av.account;
  const [cash, setCash] = useState((a.cashCents / 100).toFixed(2));
  return (
    <GlassCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">{a.name}</h3>
          <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[a.type]} · {a.institution ?? "Institution unknown"} · Valued {formatTimestamp(a.valuationTimestamp)}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-extrabold tabular-nums">{formatMicros(av.totalMicros)}</p>
          <div className="flex flex-wrap justify-end gap-1">
            {av.partial && <StatusBadge tone="warn">Partial total · {av.unvaluedCount} unvalued</StatusBadge>}
            {av.staleCount > 0 && <StatusBadge tone="pending">{av.staleCount} stale</StatusBadge>}
            <StatusBadge tone={a.source === "sample" ? "off" : "info"}>{a.source} data</StatusBadge>
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Valued holdings {formatMicros(av.holdingsMicros)} + account cash {formatMicros(av.cashMicros)}</p>
      <label className="mt-2 flex items-center gap-2 text-sm">
        Account cash $
        <Input aria-label={`Cash balance for ${a.name}`} value={cash} inputMode="decimal" onChange={(e) => setCash(e.target.value)}
          onBlur={() => { const n = Number(cash); if (Number.isFinite(n) && n >= 0) updateAccount(a.id, { cashCents: Math.round(n * 100) }); else setCash((a.cashCents / 100).toFixed(2)); }}
          className="h-8 w-28 bg-card" />
      </label>
      <div className="mt-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Holding</TableHead><TableHead>Asset class</TableHead><TableHead>Qty</TableHead><TableHead>Price</TableHead>
              <TableHead>Value</TableHead><TableHead>Weight</TableHead><TableHead>Unrealized gain/loss</TableHead><TableHead>Source</TableHead><TableHead><span className="sr-only">Edit</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.length ? holdings.map((h) => <HoldingRow key={h.id} h={h} portfolioTotal={portfolioTotal} />)
              : <TableRow><TableCell colSpan={9} className="text-sm text-muted-foreground">No holdings — cash only.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </GlassCard>
  );
}
