import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Droplets } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Clearwater Financial Wellness" },
      { name: "description", content: "Sign in or create your Clearwater account to save your own financial data." },
      { property: "og:title", content: "Sign in — Clearwater Financial Wellness" },
      { property: "og:description", content: "Sign in or create your Clearwater account to save your own financial data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";
type Notice = "check-email" | "magic-link" | "reset-sent" | null;

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  // Already signed in? Go straight to the app.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { first_name: firstName.trim(), onboarding_pending: true } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/onboarding", replace: true });
        else setNotice("check-email");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("reset-sent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendMagicLink = async () => {
    if (!email) {
      setError("Enter your email address first, then tap the link option.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setNotice("magic-link");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return; // browser is heading to Google
      navigate({ to: "/", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in didn't complete. Please try again.");
      setBusy(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
    setPassword("");
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
            <p className="text-xs text-muted-foreground">Financial wellness</p>
          </div>
        </div>

        {notice === "check-email" && (
          <div className="rounded-2xl border bg-card p-4 text-sm" role="status">
            <p className="font-semibold">Check your email</p>
            <p className="mt-1 text-muted-foreground">
              We sent a confirmation link to {email}. Click it to activate your account, then sign in here.
            </p>
            <Button variant="glass" className="mt-3" onClick={() => switchMode("signin")}>Back to sign in</Button>
          </div>
        )}

        {notice === "magic-link" && (
          <div className="rounded-2xl border bg-card p-4 text-sm" role="status">
            <p className="font-semibold">Sign-in link sent</p>
            <p className="mt-1 text-muted-foreground">
              We emailed a one-time sign-in link to {email}. Open it on this device to sign in.
            </p>
            <Button variant="glass" className="mt-3" onClick={() => switchMode("signin")}>Back to sign in</Button>
          </div>
        )}

        {notice === "reset-sent" && (
          <div className="rounded-2xl border bg-card p-4 text-sm" role="status">
            <p className="font-semibold">Reset link sent</p>
            <p className="mt-1 text-muted-foreground">If an account exists for {email}, a password-reset link is on its way.</p>
            <Button variant="glass" className="mt-3" onClick={() => switchMode("signin")}>Back to sign in</Button>
          </div>
        )}

        {!notice && (
          <>
            <div className="mb-5 flex gap-2" role="tablist" aria-label="Authentication mode">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mode === m ? "aero-gloss gloss-highlight text-primary-foreground shadow-aero" : "text-foreground/70 hover:bg-card",
                  )}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1">
                  <Label htmlFor="auth-first-name">First name</Label>
                  <Input id="auth-first-name" autoComplete="given-name" required maxLength={60} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Your first name" />
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1">
                  <Label htmlFor="auth-password">Password</Label>
                  <Input
                    id="auth-password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                  />
                </div>
              )}

              {error && (
                <p className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" variant="aero" className="w-full" disabled={busy}>
                {busy ? "Working…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
              </Button>
            </form>

            {mode === "signin" && (
              <div className="mt-4 space-y-3 text-center text-sm">
                <button
                  type="button"
                  onClick={sendMagicLink}
                  disabled={busy}
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Email me a one-time sign-in link instead
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="block w-full text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Forgot your password?
                </button>
              </div>
            )}

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="mt-4 block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Back to sign in
              </button>
            )}

            {mode !== "forgot" && (
              <>
                <div className="my-5 flex items-center gap-3" aria-hidden>
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Button type="button" variant="glass" className="w-full" onClick={signInWithGoogle} disabled={busy}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.75 12 .75 7.4.75 3.44 3.4 1.53 7.22l3.66 2.84C6.09 7.31 8.8 5.04 12 5.04z" />
                    <path fill="#4285F4" d="M23.25 12.23c0-.79-.07-1.55-.2-2.28H12v4.51h6.3c-.27 1.46-1.1 2.7-2.33 3.53l3.59 2.78c2.1-1.94 3.69-4.8 3.69-8.54z" />
                    <path fill="#FBBC05" d="M5.19 13.94a6.9 6.9 0 0 1 0-3.88L1.53 7.22a11.26 11.26 0 0 0 0 10.06l3.66-2.84z" />
                    <path fill="#34A853" d="M12 23.25c3.04 0 5.6-1 7.46-2.72l-3.59-2.78c-1 .67-2.28 1.07-3.87 1.07-3.2 0-5.91-2.27-6.81-5.02l-3.66 2.84C3.44 20.6 7.4 23.25 12 23.25z" />
                  </svg>
                  Continue with Google
                </Button>
              </>
            )}
          </>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Educational only.
        </p>
      </div>
    </div>
  );
}
