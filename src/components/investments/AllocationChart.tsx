import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AllocationSlice } from "@/lib/investments/allocation";
import { formatMicros } from "@/lib/format";
import { chartColor } from "@/components/charts/SpendingDonut";

export function AllocationChart({ slices, title }: { slices: AllocationSlice[]; title: string }) {
  const data = slices.map((s) => ({ name: s.label, value: Number(s.micros) / 1_000_000, micros: s.micros, weight: s.weightPct }));
  return (
    <figure>
      <div className="h-56">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="85%" paddingAngle={2} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={d.name} fill={chartColor(i)} stroke="var(--card)" />)}
            </Pie>
            <Tooltip formatter={(_v, _n, p) => `${formatMicros((p.payload as { micros: bigint }).micros)} (${(p.payload as { weight: number }).weight.toFixed(1)}%)`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {slices.map((s, i) => (
          <li key={s.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColor(i) }} aria-hidden />{s.label}</span>
            <span className="tabular-nums font-semibold">{formatMicros(s.micros)} · {s.weightPct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">{title}: {slices.map((s) => `${s.label} ${s.weightPct.toFixed(1)} percent`).join("; ")}</figcaption>
    </figure>
  );
}
