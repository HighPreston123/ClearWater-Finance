import { Link } from "@tanstack/react-router";
import { FileUp } from "lucide-react";
import { GlassCard } from "@/components/common/Glass";

export type CsvSection = "csv-transactions" | "csv-holdings" | "csv-risk-inputs";

export type CsvColumn = { name: string; required?: boolean; what: string; example: string };

/** Column-by-column guide: what to type in each column and where to find it. */
export function CsvGuide({ columns, whereToFind }: { columns: CsvColumn[]; whereToFind: string[] }) {
  return (
    <details className="mt-3 rounded-2xl border bg-card p-3 text-sm">
      <summary className="cursor-pointer font-semibold">What goes in each column, and where to find it</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr><th className="py-1 pr-3">Column</th><th className="py-1 pr-3">What to enter</th><th className="py-1">Example</th></tr>
          </thead>
          <tbody>
            {columns.map((c) => (
              <tr key={c.name} className="border-t align-top">
                <td className="py-1.5 pr-3 font-mono font-semibold">{c.name}{c.required ? " *" : ""}</td>
                <td className="py-1.5 pr-3">{c.what}</td>
                <td className="py-1.5 font-mono text-muted-foreground">{c.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-muted-foreground">* required</p>
      </div>
      <p className="mt-3 text-xs font-semibold">Where to find this data</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        {whereToFind.map((w) => <li key={w}>{w}</li>)}
      </ul>
    </details>
  );
}

/** Button card that sends the user to the matching CSV import on the Settings page. */
export function CsvSettingsLink({ section, title, text }: { section: CsvSection; title: string; text: string }) {
  return (
    <GlassCard className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="font-display text-sm font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
      <CsvMiniLink section={section} />
    </GlassCard>
  );
}

/** Small inline button that jumps to the matching CSV import on the Settings page. */
export function CsvMiniLink({ section, label = "Import CSV" }: { section: CsvSection; label?: string }) {
  return (
    <Link
      to="/settings"
      hash={section}
      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
    >
      <FileUp className="h-3 w-3" aria-hidden /> {label}
    </Link>
  );
}
