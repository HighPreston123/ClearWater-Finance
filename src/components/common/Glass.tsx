import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function GlassCard({ className, children, as: As = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" } & Record<string, unknown>) {
  return (
    <As className={cn("glass-surface rounded-3xl p-5 text-card-foreground", className)} {...rest}>
      {children}
    </As>
  );
}

export function CardTitle({ children, info, right }: { children: ReactNode; info?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <h2 className="flex items-center gap-1 font-display text-base font-bold text-foreground">
        {children}
        {info}
      </h2>
      {right}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs text-muted-foreground">{children}</p>;
}

export function StatusBadge({ tone, children }: { tone: "pending" | "ok" | "warn" | "off" | "info"; children: ReactNode }) {
  const cls = {
    pending: "bg-warning/20 text-warning-foreground border-warning/40",
    ok: "bg-success/15 text-success border-success/30",
    warn: "bg-destructive/10 text-destructive border-destructive/30",
    off: "bg-muted text-muted-foreground border-border",
    info: "bg-primary/10 text-primary border-primary/30",
  }[tone];
  return <Badge variant="outline" className={cn("rounded-full", cls)}>{children}</Badge>;
}

export function Kv({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {items.map((i) => (
        <div key={i.label} className="contents">
          <dt className="text-muted-foreground">{i.label}</dt>
          <dd className="text-right font-semibold tabular-nums">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
