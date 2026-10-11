# Add two-factor sign-in (authenticator app)

## What I found
- **Sign-in system:** the app's built-in Lovable Cloud sign-in (email + password, emailed one-time link, Google). Two-factor support with authenticator apps (Google Authenticator, 1Password, Authy) is built into it, so nothing custom or new is needed.
- **Already in place:** most data requests already refuse to run if an account has two-factor turned on but the current sign-in hasn't passed the code step. This covers loading/saving finances, trends, scores and fundamentals.
- **Missing pieces:**
  1. There's no way to turn two-factor on in Settings.
  2. Sign-in never asks for the code. So today, an account with two-factor turned on would get stuck: blocked from its own data, with no code screen.
  3. Six request groups skip the two-factor check: welcome quiz, risk survey, advisor/reference lists, audio summary, connected-bank data, and part of the shared data helper.
  4. The database rules check who owns each row, but not whether the code step was passed. The app never reads tables straight from the browser, so this is a backup layer, not an open hole.

## Proposed changes (small, add-only)
1. **Settings → new "Two-factor authentication" card** (new file, added to the Settings page between existing cards):
   - Shows whether two-factor is on or off.
   - Turning it on shows a QR code and a manual setup key. It's only switched on after you type a valid 6-digit code; a wrong code is rejected.
   - Turning it off requires a fresh valid code first.
2. **Sign-in code step:** after password, emailed link or Google sign-in, if the account has two-factor turned on, show a "Enter your 6-digit code" screen. The rest of the app's pages stay locked until the code is entered. This goes in the existing sign-in gate. A "Sign out" button sits on that screen. Accounts without two-factor sign in exactly as today.
3. **Server checks:** add the existing two-factor check to the six request groups listed above. Writes check before touching data.
4. **Database backup layer (one migration, needs your OK):** add an extra rule to each personal-data table: "if this account has two-factor turned on, the sign-in must have passed the code step." This only adds rules — no data is changed or deleted. Shared reference tables stay as they are.
5. **Recovery:** the built-in system has no backup codes. I'll add support for a **second authenticator device** as a backup, and explain in the card that losing every device means contacting the app owner. As the owner, you can remove a user's factor from the backend user list. I won't build a custom backup-code system, because that would mean writing our own security code.

## Not touched
Account deletion (including its two-step confirm), sign-up, email confirmation, password reset, Google sign-in, dashboards, imports, data connections, scores, styling, and every existing route name.

## Risks
- **Lockout:** someone who loses their phone can't sign in until the owner removes their factor. A second device and a clear warning reduce this.
- **The database rule could block the app if it's wrong.** I'll test it with throwaway accounts before relying on it, both with two-factor on and off.
- **Account deletion with two-factor on:** deletion already requires the code step, so users must enter their code first. Its behaviour stays the same.

## Testing plan (disposable accounts only)
- Turning two-factor on with a valid code works; a wrong code is rejected.
- Signing in with two-factor on shows the code screen, and data stays locked until a valid code is entered.
- Calling data requests directly, skipping the code screen, is refused by the server and by the database.
- An account without two-factor signs in as before.
- Spot checks: sign-up, password reset, dashboard load/save, CSV import, account deletion.
- Automated tests pass and the app builds.

In the report I'll separate checks I actually ran from those that remain unverified.

## Technical details
- New `src/components/settings/TwoFactorCard.tsx` using `supabase.auth.mfa.enroll/challenge/verify/unenroll/listFactors` (TOTP).
- `_authenticated/route.tsx`: call `mfa.getAuthenticatorAssuranceLevel()`; when `nextLevel === "aal2"` and `currentLevel !== "aal2"`, render the code screen instead of the outlet (new `MfaChallenge.tsx`). This adds no network call for accounts without two-factor, because the assurance level is read from the local token.
- Add `assertMfa` / `withMfaRead` to audio, nessie, reference, riskSurvey and onboarding functions, plus the uncovered helper in db.server.
- Migration: a `RESTRICTIVE` policy on owner `fin_*` tables: `(auth.jwt()->>'aal') = 'aal2' OR NOT EXISTS (verified factor in auth.mfa_factors for auth.uid())`, via a SECURITY DEFINER helper `fin_mfa_ok()`.
- Unenrolling requires an aal2 session (enforced by the auth system).
