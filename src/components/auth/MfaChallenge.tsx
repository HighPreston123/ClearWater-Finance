import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearOnboardingStateCache } from "@/lib/onboarding/stateCache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Sign-in code step for accounts with an authenticator app turned on. */
export function MfaChallenge() {
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data: f, error: fe } = await supabase.auth.mfa.listFactors();
      if (fe) throw fe;
      const factor = f.totp.find((x) => x.status === "verified");
      if (!factor) throw new Error("No authenticator found for this account.");
      const { error: ve } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
      if (ve) throw new Error("That code didn't work. Check your authenticator app and try again.");
      clearOnboardingStateCache();
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="aero-sky bubbles flex min-h-screen items-center justify-center p-4">
      <form onSubmit={verify} className="glass-surface w-full max-w-md space-y-4 rounded-3xl p-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
          <h1 className="font-display text-xl font-extrabold text-foreground">Two-factor check</h1>
        </div>
        <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app to continue.</p>
        <div className="space-y-1">
          <Label htmlFor="mfa-code">Code</Label>
          <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
        </div>
        {error && <p className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground" role="alert">{error}</p>}
        <Button type="submit" variant="aero" className="w-full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify"}</Button>
        <Button type="button" variant="glass" className="w-full" onClick={signOut}>Sign out</Button>
        <p className="text-xs text-muted-foreground">Lost your device? Contact the site owner to reset two-factor for your account.</p>
      </form>
    </div>
  );
}
