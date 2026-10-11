import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/** Dollar input bound to cents | null. Empty means Unknown (null), never zero. */
export function MoneyInput({ value, onChange, id, label }: { value: number | null; onChange: (c: number | null) => void; id?: string; label: string }) {
  const [text, setText] = useState(value === null ? "" : (value / 100).toFixed(2));
  useEffect(() => setText(value === null ? "" : (value / 100).toFixed(2)), [value]);
  return (
    <Input
      id={id}
      aria-label={label}
      inputMode="decimal"
      placeholder="Unknown"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const t = text.trim().replace(/[$,]/g, "");
        if (t === "") return onChange(null);
        const n = Number(t);
        if (Number.isFinite(n) && n >= 0) onChange(Math.round(n * 100));
        else setText(value === null ? "" : (value / 100).toFixed(2));
      }}
      className="bg-card"
    />
  );
}
