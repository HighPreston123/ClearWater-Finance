import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthSummary } from "@/types/finance";
import { formatCents, formatCentsShort, monthLabel } from "@/lib/format";

export function MonthlyBars({ months }: { months: MonthSummary[] }) {
  const data = months.map((m) => ({ month: monthLabel(m.month), Income: m.income, Spending: m.spending }));
  return (
    <figure>
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis tickFormatter={(v) => formatCentsShort(v)} stroke="var(--muted-foreground)" fontSize={12} width={70} />
            <Tooltip formatter={(v: number) => formatCents(v)} />
            <Legend />
            <Bar dataKey="Income" fill="var(--chart-2)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="Spending" fill="var(--chart-1)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {months.map((m) => `${monthLabel(m.month, true)}: income ${formatCents(m.income)}, spending ${formatCents(m.spending)}`).join("; ")}
      </figcaption>
    </figure>
  );
}
