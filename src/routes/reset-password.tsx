import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Droplets } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Clearwater Financial Wellness" },
      { name: "description", content: "Set a new password for your Clearwater account." },
      { property: "og:title", content: "Reset password — Clearwater Financial Wellness" },
      { property: "og:description", content: "Set a new password for your Clearwater account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

type LinkState = "checking" | "valid" | "invalid";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [link, setLink] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resent, setResent] = useState(false);

  // Recovery links arrive with a hash like #access_token=...&type=recovery
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setLink(hash.get("type") === "recovery" ? "valid" : "invalid");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match. Please re-enter them.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the reset email. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="aero-sky bubbles flex min-h-screen items-center justify-center p-4">
      <div className="glass-surface w-full max-w-md rounded-3xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="aero-leaf gloss-highlight flex h-11 w-11 items-center justify-center rounded-full shadow-aero">
            <Droplets className="relative h-5 w-5 text-primary-foreground" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-xl font-extrabold text-foreground">Clearwater</h1>
            <p className="text-xs text-muted-foreground">Password reset</p>
          </div>
        </div>

        {link === "checking" && <p className="text-sm text-muted-foreground">Checking your link…</p>}

        {link === "valid" && done && (
          <div className="text-sm" role="status">
            <p className="font-semibold">Your password is updated</p>
            <p className="mt-1 text-muted-foreground">You're signed in with your new password.</p>
            <Button variant="aero" className="mt-4 w-full" onClick={() => navigate({ to: "/", replace: true })}>
              Continue to your dashboard
            </Button>
          </div>
        )}

        {link === "valid" && !done && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
            <div className="space-y-1">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
              />
            </div>
            {error && (
              <p className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">{error}</p>
            )}
            <Button type="submit" variant="aero" className="w-full" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}

        {link === "invalid" && !resent && (
          <form onSubmit={resend} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This reset link is missing or has expired. Enter your email and we'll send you a fresh one.
            </p>
            <div className="space-y-1">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
              />
            </div>
            {error && (
              <p className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">{error}</p>
            )}
            <Button type="submit" variant="aero" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Email me a new reset link"}
            </Button>
            <button
              type="button"
              onClick={() => navigate({ to: "/auth" })}
              className="block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Back to sign in
            </button>
          </form>
        )}

        {link === "invalid" && resent && (
          <div className="text-sm" role="status">
            <p className="font-semibold">Reset link sent</p>
            <p className="mt-1 text-muted-foreground">If an account exists for {email}, a fresh reset link is on its way.</p>
            <Button variant="glass" className="mt-4 w-full" onClick={() => navigate({ to: "/auth" })}>
              Back to sign in
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
