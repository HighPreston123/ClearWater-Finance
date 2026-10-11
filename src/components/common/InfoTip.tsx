import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Click/tap/keyboard-accessible explainer for unfamiliar metrics. */
export function InfoTip({ title, means, calc, excludes }: { title: string; means: string; calc: string; excludes?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`About ${title}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm">
        <p className="font-display font-bold text-foreground">{title}</p>
        <dl className="mt-2 space-y-2">
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What it means</dt><dd>{means}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">How it's calculated</dt><dd>{calc}</dd></div>
          {excludes && <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What it excludes</dt><dd>{excludes}</dd></div>}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
