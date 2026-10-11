import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Droplets, Leaf, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QUIZ_QUESTIONS, missingQuestions, sanitizeAnswers, type QuizAnswers } from "@/lib/onboarding/quiz";
import { completeOnboarding, saveOnboardingProgress } from "@/lib/onboarding.functions";
import { fetchOnboardingState, markOnboardingCompleted } from "@/lib/onboarding/stateCache";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Clearwater" },
      { name: "description", content: "Get to know Clearwater and tell us what matters to you financially." },
      { property: "og:title", content: "Welcome — Clearwater" },
      { property: "og:description", content: "Get to know Clearwater and tell us what matters to you financially." },
    ],
  }),
  component: Onboarding,
});

type Step = "loading" | "welcome" | "intro" | "quiz" | "done";
const TOTAL = QUIZ_QUESTIONS.length;
const LOCAL_KEY = (uid: string) => `clearwater:onboarding:${uid}`;

function Onboarding() {
  const navigate = useNavigate();
  const saveProgress = useServerFn(saveOnboardingProgress);
  const complete = useServerFn(completeOnboarding);

  const [step, setStep] = useState<Step>("loading");
  const [firstName, setFirstName] = useState("there");
  const [uid, setUid] = useState<string | null>(null);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [index, setIndex] = useState(0);
  const [missing, setMissing] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      setUid(user.id);
      const name = String(user.user_metadata?.['first_name'] ?? "").trim() || (user.email?.split("@")[0] ?? "there");
      setFirstName(name.charAt(0).toUpperCase() + name.slice(1));
      let restored: QuizAnswers = {};
      try { restored = sanitizeAnswers(JSON.parse(localStorage.getItem(LOCAL_KEY(user.id)) ?? "{}")); } catch { /* ignore */ }
      try {
        const s = await fetchOnboardingState(user.id);
        if (s.status === "completed") {
          await supabase.auth.updateUser({ data: { onboarding_pending: false } });
          localStorage.removeItem(LOCAL_KEY(user.id));
          navigate({ to: "/", replace: true });
          return;
        }
        restored = { ...restored, ...s.answers };
      } catch { /* offline: continue with local progress */ }
      setAnswers(restored);
      const firstGap = missingQuestions(restored)[0];
      setIndex(firstGap ?? TOTAL - 1);
      setStep(Object.keys(restored).length ? "quiz" : "welcome");
    })();
  }, [navigate]);

  const choose = (questionId: string, optionId: string) => {
    const next = { ...answers, [questionId]: optionId };
    setAnswers(next);
    setMissing((m) => m.filter((i) => QUIZ_QUESTIONS[i]!.id !== questionId));
    if (uid) localStorage.setItem(LOCAL_KEY(uid), JSON.stringify(next));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveProgress({ data: { answers: next } }).catch(() => {}); }, 600);
  };

  const finish = async () => {
    const gaps = missingQuestions(answers);
    if (gaps.length) { setMissing(gaps); setIndex(gaps[0]!); return; }
    setSubmitting(true);
    setError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const r = await complete({ data: { answers } });
      if (r.status === "missing") { setMissing(r.missing); setIndex(r.missing[0]!); return; }
      await supabase.auth.updateUser({ data: { onboarding_pending: false } });
      if (uid) localStorage.removeItem(LOCAL_KEY(uid));
      if (uid) markOnboardingCompleted(uid);
      setStep("done");
    } catch {
      setError("We couldn't save your answers just now. Your progress is kept — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const q = QUIZ_QUESTIONS[index]!;
  const answeredCount = TOTAL - missingQuestions(answers).length;

  return (
    <div className="aero-sky relative min-h-screen overflow-hidden">
      <Scenery />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-10">
        {step === "loading" && (
          <section role="status" aria-live="polite" className="glass-surface animate-aero-rise mx-auto w-full max-w-sm rounded-[2rem] p-8 text-center">
            <span className="aero-leaf gloss-highlight mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full shadow-aero">
              <Loader2 className="relative h-7 w-7 animate-spin text-primary-foreground" aria-hidden />
            </span>
            <h1 className="font-display text-xl font-bold text-foreground">Getting things ready…</h1>
            <p className="mt-2 text-sm text-foreground/70">Loading your welcome quiz. This only takes a moment.</p>
            <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
            </div>
          </section>
        )}

        {step === "welcome" && (
          <section key="welcome" className="glass-surface animate-aero-rise rounded-[2rem] p-8 text-center sm:p-12">
            <span className="aero-leaf gloss-highlight mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full shadow-aero">
              <Droplets className="relative h-8 w-8 text-primary-foreground" aria-hidden />
            </span>
            <h1 className="font-display text-4xl font-extrabold text-foreground sm:text-5xl">Hi, {firstName}!</h1>
            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-foreground/80">
              Welcome to Clearwater. Everyone wants something different from their money, and we'd love to learn what matters to you.
            </p>
            <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-foreground/80">
              A short 20-question quiz helps us understand your goals so we can connect you with a financial advisor who fits. There are no right or wrong answers.
            </p>
            <Button variant="aero" size="lg" className="mt-8 h-12 px-8 text-base" onClick={() => setStep("intro")}>
              Let's get started <ArrowRight aria-hidden />
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">Takes about 3–5 minutes</p>
          </section>
        )}

        {step === "intro" && (
          <section key="intro" className="glass-surface animate-aero-rise rounded-[2rem] p-8 sm:p-12">
            <Leaf className="mb-4 h-8 w-8 text-primary" aria-hidden />
            <h2 className="font-display text-3xl font-extrabold text-foreground">Getting to know you</h2>
            <p className="mt-4 leading-relaxed text-foreground/80">
              We want to understand what matters most to you financially. This quick quiz helps us learn about your goals, preferences, and situation so we can connect you with an advisor who fits your needs.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-foreground/80">
              {["20 multiple-choice questions", "Answer based on your own situation", "There are no right or wrong answers", "You only need to do this once — your progress is saved as you go"].map((t) => (
                <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{t}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="glass" size="lg" className="h-12" onClick={() => setStep("welcome")}><ArrowLeft aria-hidden /> Back</Button>
              <Button variant="aero" size="lg" className="h-12 px-8 text-base" onClick={() => { setIndex(0); setStep("quiz"); }}>Start Quiz <ArrowRight aria-hidden /></Button>
            </div>
          </section>
        )}

        {step === "quiz" && (
          <section className="glass-surface rounded-[2rem] p-6 sm:p-10" aria-labelledby="quiz-q">
            <div className="flex items-center justify-between text-sm font-semibold text-foreground/80">
              <span>Question {index + 1} of {TOTAL}</span>
              <span className="text-xs text-muted-foreground">{answeredCount} answered</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={answeredCount} aria-label="Quiz progress">
              <div className="aero-water h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${(answeredCount / TOTAL) * 100}%` }} />
            </div>

            <div key={q.id} className="animate-aero-rise">
              <h2 id="quiz-q" className="mt-8 font-display text-2xl font-extrabold leading-snug text-foreground">{q.text}</h2>
              {missing.includes(index) && <p className="mt-2 text-sm font-semibold text-destructive" role="alert">Please choose an answer for this question.</p>}
              <div role="radiogroup" aria-labelledby="quiz-q" className="mt-6 grid gap-3">
                {q.options.map((o, i) => {
                  const selected = answers[q.id] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => choose(q.id, o.id)}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-base transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-primary bg-primary/10 font-semibold text-foreground shadow-aero" : "border-transparent bg-card hover:border-primary/40",
                      )}
                    >
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", selected ? "aero-gloss text-primary-foreground" : "bg-muted text-foreground/70")}>
                        {selected ? <Check className="h-4 w-4" aria-hidden /> : String.fromCharCode(65 + i)}
                      </span>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {missing.length > 0 && (
              <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
                <p className="font-semibold">A few questions still need an answer:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {missing.map((i) => (
                    <button key={i} type="button" onClick={() => setIndex(i)} className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary hover:underline">Question {i + 1}</button>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">{error}</p>}

            <div className="mt-8 flex items-center justify-between gap-3">
              <Button variant="glass" size="lg" className="h-12" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}><ArrowLeft aria-hidden /> Back</Button>
              {index < TOTAL - 1 ? (
                <Button variant="aero" size="lg" className="h-12 px-8" disabled={!answers[q.id]} onClick={() => setIndex((i) => i + 1)}>Next <ArrowRight aria-hidden /></Button>
              ) : (
                <Button variant="aero" size="lg" className="h-12 px-8" disabled={submitting} onClick={finish}>{submitting ? "Saving…" : "Finish"} <Check aria-hidden /></Button>
              )}
            </div>
          </section>
        )}

        {step === "done" && (
          <section key="done" className="glass-surface animate-aero-rise rounded-[2rem] p-8 text-center sm:p-12">
            <span className="aero-leaf gloss-highlight mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full shadow-aero">
              <Sparkles className="relative h-8 w-8 text-primary-foreground" aria-hidden />
            </span>
            <h1 className="font-display text-4xl font-extrabold text-foreground">Thanks, {firstName}!</h1>
            <p className="mx-auto mt-5 max-w-md leading-relaxed text-foreground/80">
              You've given us a better picture of what matters to you financially. We're using what you shared to help personalize your experience and connect you with the right resources.
            </p>
            <Button variant="aero" size="lg" className="mt-8 h-12 px-8 text-base" onClick={() => navigate({ to: "/", replace: true })}>
              Continue to my dashboard <ArrowRight aria-hidden />
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}

/** Soft floating bubbles and a water horizon. Decorative only. */
function Scenery() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="animate-aero-float absolute left-[8%] top-[12%] h-24 w-24 rounded-full bg-card/60 shadow-aero backdrop-blur-sm" />
      <div className="animate-aero-float absolute right-[10%] top-[20%] h-36 w-36 rounded-full bg-card/40 shadow-aero backdrop-blur-sm [animation-delay:-3s]" />
      <div className="animate-aero-float absolute bottom-[22%] left-[14%] h-14 w-14 rounded-full bg-card/50 [animation-delay:-5s]" />
      <div className="aero-water absolute inset-x-0 bottom-0 h-40 opacity-40 [border-radius:60%_60%_0_0/40%_40%_0_0]" />
      <div className="aero-leaf absolute -bottom-10 right-[-5%] h-48 w-96 opacity-30 [border-radius:70%_30%_0_0]" />
    </div>
  );
}
