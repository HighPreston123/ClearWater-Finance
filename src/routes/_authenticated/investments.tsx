import { AudioSummaryControls } from "@/components/integrations/AudioSummaryControls";
import { investmentsAudioText } from "@/lib/finance/pageAudioText";
import { formatMicros as fmtMicrosAudio } from "@/lib/format";
import { createFileRoute } from "@tanstack/react-router";
import { CsvSettingsLink } from "@/components/common/CsvHelp";
import { useFinanceStore } from "@/store/FinanceStore";
import { usePortfolio } from "@/store/useDerived";
import { PageHeader, GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { AllocationChart } from "@/components/investments/AllocationChart";
import { MarketDataCard } from "@/components/investments/MarketDataCard";
import { AccountCard } from "@/components/investments/AccountCard";
import { byAccountType, byAssetClass } from "@/lib/investments/allocation";
import { formatMicros } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/investments")({
  head: () => ({
    meta: [
      { title: "Investments — Clearwater" },
      { name: "description", content: "Investment accounts, holdings, and allocation by account type and asset class." },
      { property: "og:title", content: "Investments — Clearwater" },
      { property: "og:description", content: "Investment accounts, holdings, and allocation by account type and asset class." },
    ],
  }),
  component: Investments,
});

function Investments() {
  const { accounts, holdings } = useFinanceStore();
  const portfolio = usePortfolio();
  return (
    <div className="space-y-6">
      <PageHeader title="Investments" subtitle="Your accounts and holdings. Values reflect each displayed valuation date." right={<AudioSummaryControls text={investmentsAudioText({ accountCount: accounts.length, holdingCount: holdings.length, total: fmtMicrosAudio(portfolio.totalMicros), partial: portfolio.partial })} />} />
      <CsvSettingsLink section="csv-holdings" title="Import your investments" text="Upload a brokerage CSV of your holdings in Settings. It explains each column and where to download it." />
      <GlassCard>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total tracked investment value</p>
            <p className="font-display text-4xl font-extrabold tabular-nums">{formatMicros(portfolio.totalMicros)}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {portfolio.partial && <StatusBadge tone="warn">Partial total · {portfolio.unvaluedCount} holding(s) without valuation</StatusBadge>}
            {portfolio.staleCount > 0 && <StatusBadge tone="pending">{portfolio.staleCount} stale valuation(s)</StatusBadge>}
            
          </div>
        </div>
        <Note>Holdings with a symbol are priced from Alpaca / IEX when a valid price exists; others keep their imported value or stay unvalued. Market data never adds securities. Unrealized gains are not income.</Note>
      </GlassCard>
      <MarketDataCard />
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard><CardTitle>By account type</CardTitle><AllocationChart title="Value by account type" slices={byAccountType(accounts, holdings)} /><Note>Account type is the wrapper (e.g. Roth IRA), not what's inside it.</Note></GlassCard>
        <GlassCard><CardTitle>By asset class</CardTitle><AllocationChart title="Value by asset class" slices={byAssetClass(accounts, holdings)} /><Note>ETFs and funds aren't assumed to be all stocks — see each holding's exposure. Account cash counts as cash.</Note></GlassCard>
      </div>
      <GlassCard>
        <CardTitle>Performance</CardTitle>
        <p className="text-sm text-muted-foreground">No dated valuation history is available, so no performance chart is shown. History isn't reconstructed from current holdings.</p>
      </GlassCard>
      <div className="space-y-4">
        {portfolio.perAccount.map((av) => <AccountCard key={av.account.id} av={av} holdings={holdings.filter((h) => h.accountId === av.account.id)} portfolioTotal={portfolio.totalMicros} />)}
      </div>
    </div>
  );
}
