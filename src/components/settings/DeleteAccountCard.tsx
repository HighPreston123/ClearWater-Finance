import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, Loader2 } from "lucide-react";
import { GlassCard, CardTitle } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";

const CONSEQUENCES: [string, string][] = [
  ["Account access", "You will lose access to your account and will be signed out. Your email and password (or Google sign-in) will no longer work here."],
  ["Personal information", "Your profile, including your name and email, will be deleted."],
  ["Financial dashboard", "Your bank accounts, investment holdings, settings, savings and risk inputs, recurring-payment edits, and onboarding quiz answers will be deleted."],
  ["Saved history", "All saved transactions, category changes, spending history, and past score history will be permanently deleted."],
  ["Recovery", "This cannot be undone. Your account and its data cannot be recovered."],
  ["Data retention", "Shared information that isn't yours (advisors, sample comparison profiles) is not affected. Cached audio summaries aren't linked to your name. Routine system logs may be kept briefly for security and operations."],
];

export function DeleteAccountCard() {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const del = useServerFn(deleteMyAccount);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const close = () => { if (busy) return; setStage(0); setAgreed(false); setError(null); };

  const confirmDelete = async () => {
    setBusy(true); setError(null);
    try {
      await del();
    } catch (e) {
      setBusy(false);
      setError(`${e instanceof Error ? e.message : "Deletion failed"}. Your account was not fully deleted and you are still signed in. Please try again.`);
      return;
    }
    try {
      Object.keys(window.localStorage).filter((k) => k.startsWith("financial-wellness")).forEach((k) => window.localStorage.removeItem(k));
    } catch { /* storage unavailable */ }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut({ scope: "local" });
    navigate({ to: "/auth", replace: true });
  };

  return (
    <GlassCard>
      <CardTitle>Delete account</CardTitle>
      <p className="text-sm">Permanently delete your account and all of your saved data.</p>
      <Button variant="destructive" className="mt-3 rounded-full" onClick={() => setStage(1)}><Trash2 /> Delete Account</Button>

      <AlertDialog open={stage === 1} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete your account?</AlertDialogTitle>
            <AlertDialogDescription>Deleting your account is a serious action. On the next step you'll see exactly what will be removed before anything happens.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => setStage(2)}>Continue to Delete Account</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={stage === 2} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Permanent Account Deletion</AlertDialogTitle>
            <AlertDialogDescription>Here is what will happen if you continue:</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-2 text-sm">
            {CONSEQUENCES.map(([t, d]) => <li key={t}><span className="font-semibold">{t}:</span> {d}</li>)}
          </ul>
          <label className="flex items-start gap-2 text-sm font-medium">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} disabled={busy} aria-label="I understand the consequences and want to permanently delete my account." />
            <span>I understand the consequences and want to permanently delete my account.</span>
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Go Back</Button>
            <Button variant="destructive" disabled={!agreed || busy} onClick={confirmDelete}>
              {busy && <Loader2 className="animate-spin" />} Delete My Account Permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GlassCard>
  );
}
