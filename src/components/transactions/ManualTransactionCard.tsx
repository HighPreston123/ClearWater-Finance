import { useState } from "react";
import { toast } from "sonner";
import { useFinanceStore } from "@/store/FinanceStore";
import { GlassCard, CardTitle } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, type Category, type TransactionType } from "@/types/finance";
import { categorizeByRules } from "@/lib/finance/categorization";
import { CHECKING } from "@/data/sampleTransactions";

const AUTO = "__auto";
const today = () => new Date().toISOString().slice(0, 10);

/** Manual entry with the same fields as a CSV row: date, merchant, amount, description, type, category. */
export function ManualTransactionCard() {
  const store = useFinanceStore();
  const [date, setDate] = useState(today);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [category, setCategory] = useState<string>(AUTO);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(Math.abs(Number(amount.replace(/[$,\s]/g, ""))) * 100);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Enter a valid date.");
    if (!merchant.trim()) return setError("Enter a merchant.");
    if (!Number.isFinite(cents) || cents <= 0) return setError("Enter an amount greater than zero.");
    setError(null);
    const cat: Category =
      category === AUTO
        ? categorizeByRules(merchant.trim(), description.trim(), type)
        : (category as Category);
    store.addTransaction({
      id: `manual-${crypto.randomUUID()}`,
      date,
      merchant: merchant.trim(),
      amount: cents,
      type,
      category: cat,
      categorySource: category === AUTO ? "rule" : "manual",
      description: description.trim(),
      accountId: CHECKING,
    });
    toast.success(`Added ${merchant.trim()}`);
    setMerchant(""); setAmount(""); setDescription(""); setCategory(AUTO);
  };

  return (
    <GlassCard>
      <CardTitle>Add a transaction manually</CardTitle>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="m-date" className="text-xs text-muted-foreground">Date</Label>
          <Input id="m-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="m-merchant" className="text-xs text-muted-foreground">Merchant</Label>
          <Input id="m-merchant" required value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Trader Joe's" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="m-amount" className="text-xs text-muted-foreground">Amount ($)</Label>
          <Input id="m-amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="42.50" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="m-desc" className="text-xs text-muted-foreground">Description (optional)</Label>
          <Input id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="m-type" className="text-xs text-muted-foreground">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
            <SelectTrigger id="m-type" className="bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="m-cat" className="text-xs text-muted-foreground">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="m-cat" className="bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>Auto-detect</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 sm:col-span-3">
          <Button type="submit" variant="aero">Add transaction</Button>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
      </form>
    </GlassCard>
  );
}
