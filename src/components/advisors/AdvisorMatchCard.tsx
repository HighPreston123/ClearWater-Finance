import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { GlassCard, CardTitle, StatusBadge, Note } from "@/components/common/Glass";
import type { AdvisorMatch } from "@/types/advisors";

/** Separate result — not a second primary action. */
export function AdvisorMatchCard({ match }: { match: AdvisorMatch }) {
  return (
    <GlassCard>
      <CardTitle right={<StatusBadge tone="off">Matching not available</StatusBadge>}>
        <Users className="h-4 w-4 text-primary" aria-hidden /> Financial advisor match
      </CardTitle>
      <p className="text-sm">{match.message}</p>
      {match.missingInformation.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
          {match.missingInformation.map((m) => <li key={m}>Missing: {m}</li>)}
        </ul>
      )}
      <Link to="/advisors" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Browse advisor directory</Link>
      <Note>No advisors are contacted and no data is shared automatically.</Note>
    </GlassCard>
  );
}
