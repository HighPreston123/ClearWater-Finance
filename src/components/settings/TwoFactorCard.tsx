import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Factor = { id: string; friendly_name?: string; status: string; created_at: string };
type Enrolling = { factorId: string; qr: string; secret: string };

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

/** Authenticator-app (TOTP) two-factor using the built-in auth system's MFA support. */
export function TwoFactorCard() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeCode, setRemoveCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return setError("Couldn't load two-factor status.");
    setFactors(data.totp.filter((f) => f.status === "verified") as Factor[]);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const enabled = (factors?.length ?? 0) > 0;

  const start = async () => {
    setError(null); setBusy(true);
    try {
      // Clear abandoned, never-verified setups so a fresh one can start.
      const { data: all } = await supabase.auth.mfa.listFactors();
      for (const f of all?.all ?? []) if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toLocaleDateString()} ${Date.now() % 10000}` });
      if (error) throw error;
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start setup.");
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!enrolling) return;
    setError(null); setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.factorId, code });
    setBusy(false);
    if (error) return setError("That code didn't work. Two-factor is not turned on yet — try the current code.");
    setEnrolling(null); setCode("");
    toast.success("Two-factor authentication is on");
    void refresh();
  };

  const cancel = async () => {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    setEnrolling(null); setCode(""); setError(null);
  };

  const remove = async (factorId: string) => {
    setError(null); setBusy(true);
    try {
      // Fresh code required before removing a device.
      const { error: ve } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: removeCode });
      if (ve) throw new Error("That code didn't work. The device was not removed.");
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await supabase.auth.refreshSession();
      setRemoving(null); setRemoveCode("");
      toast.success("Authenticator removed");
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove the device.");
    } finally { setBusy(false); }
  };

  return (
    <GlassCard>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Two-factor authentication</CardTitle>
        {factors && <StatusBadge tone={enabled ? "info" : "pending"}>{enabled ? "On" : "Off"}</StatusBadge>}
      </div>
      <p className="text-sm">Ask for a 6-digit code from an authenticator app (Google Authenticator, 1Password, Authy) each time you sign in.</p>

      {factors && factors.length > 0 && (
        <ul className="mt-3 space-y-2">
          {factors.map((f) => (
            <li key={f.id} className="rounded-2xl border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{f.friendly_name || "Authenticator"} · added {new Date(f.created_at).toLocaleDateString()}</span>
                {removing !== f.id && <Button variant="glass" size="sm" onClick={() => { setRemoving(f.id); setRemoveCode(""); setError(null); }}>Remove</Button>}
              </div>
              {removing === f.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`rm-${f.id}`} className="text-xs">Code from this device</Label>
                    <Input id={`rm-${f.id}`} inputMode="numeric" autoComplete="one-time-code" value={removeCode} onChange={(e) => setRemoveCode(digits(e.target.value))} className="w-32" />
                  </div>
                  <Button variant="destructive" size="sm" disabled={busy || removeCode.length !== 6} onClick={() => remove(f.id)}>Confirm remove</Button>
                  <Button variant="glass" size="sm" onClick={() => setRemoving(null)}>Cancel</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {enrolling ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold">1. Scan this QR code with your authenticator app</p>
          <img src={enrolling.qr} alt="Two-factor setup QR code" className="h-44 w-44 rounded-xl bg-card p-2" />
          <p className="text-xs text-muted-foreground">Can't scan? Enter this key manually: <code className="break-all font-mono text-foreground">{enrolling.secret}</code></p>
          <p className="text-sm font-semibold">2. Enter the 6-digit code it shows</p>
          <div className="flex flex-wrap items-end gap-2">
            <Input aria-label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(digits(e.target.value))} className="w-32" placeholder="123456" />
            <Button variant="aero" disabled={busy || code.length !== 6} onClick={confirm}>{busy ? "Checking…" : "Turn on"}</Button>
            <Button variant="glass" onClick={cancel}>Cancel</Button>
          </div>
        </div>
      ) : (
        factors && <Button variant="aero" className="mt-4" disabled={busy} onClick={start}>{enabled ? "Add a backup device" : "Set up two-factor"}</Button>
      )}

      {error && <p className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">{error}</p>}
      <Note>Tip: add a second device as a backup. If you lose every device, contact the site owner to reset two-factor for your account.</Note>
    </GlassCard>
  );
}
