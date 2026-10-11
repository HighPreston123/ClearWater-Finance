import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { Category } from "@/types/finance";
import { formatCents } from "@/lib/format";

export const chartColor = (i: number) => `var(--chart-${(i % 8) + 1})`;

export function SpendingDonut({ data, onSelect }: { data: { category: Category; cents: number }[]; onSelect?: (c: Category) => void }) {
  const total = data.reduce((s, d) => s + d.cents, 0);
  if (!data.length) return <p className="text-sm text-muted-foreground">No spending in this range.</p>;
  return (
    <figure>
      <div className="h-72">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="cents" nameKey="category" innerRadius="55%" outerRadius="85%" paddingAngle={2} isAnimationActive={false}
              onClick={(d: { category?: Category }) => d.category && onSelect?.(d.category)} className="cursor-pointer">
              {data.map((d, i) => <Cell key={d.category} fill={chartColor(i)} stroke="var(--card)" />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatCents(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Spending by category, total {formatCents(total)}: {data.map((d) => `${d.category} ${formatCents(d.cents)}`).join("; ")}.
      </figcaption>
      {onSelect && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Filter transactions by category">
          {data.map((d, i) => (
            <button key={d.category} onClick={() => onSelect(d.category)} className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColor(i) }} aria-hidden />
              {d.category} · {formatCents(d.cents)}
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}
