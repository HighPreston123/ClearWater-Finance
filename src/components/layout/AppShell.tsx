import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, Receipt, Repeat, PiggyBank, LineChart, ShieldQuestion, Settings, Menu, Droplets, Users, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RangePicker } from "@/components/common/RangePicker";
import { cn } from "@/lib/utils";
import { AquaAmbience } from "@/components/layout/AquaAmbience";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/recurring", label: "Recurring expenses", icon: Repeat },
  { to: "/savings", label: "Savings planner", icon: PiggyBank },
  { to: "/investments", label: "Investments", icon: LineChart },
  { to: "/risk", label: "Future risk", icon: ShieldQuestion },
  { to: "/advisors", label: "Advisors", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "aero-gloss gloss-highlight text-primary-foreground shadow-aero" : "text-foreground/80 hover:bg-card",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-2">
      <span className="aero-leaf gloss-highlight flex h-10 w-10 items-center justify-center rounded-full shadow-aero">
        <Droplets className="relative h-5 w-5 text-primary-foreground" aria-hidden />
      </span>
      <span className="font-display text-lg font-extrabold leading-tight text-foreground">
        Clearwater<br /><span className="text-xs font-semibold text-muted-foreground">Financial wellness</span>
      </span>
    </Link>
  );
}

function UserChip() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);

  // Single auth subscriber lives in FinanceProvider; the shell remounts on account change via the gate.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  if (!email) return null;

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:inline">{email}</span>
      <Button variant="glass" size="sm" onClick={signOut} aria-label="Sign out">
        <LogOut className="h-4 w-4" aria-hidden /> Sign out
      </Button>
    </div>
  );
}

/** After the first page shows, quietly download every tab's code so first clicks are instant. */
function useWarmTabs() {
  const router = useRouter();
  useEffect(() => {
    // Tab pages have no data loaders, so preloading only fetches their code.
    const t = setTimeout(() => {
      for (const { to } of NAV) router.preloadRoute({ to }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [router]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useWarmTabs();
  return (
    <div className="aero-sky bubbles aqua-cursor min-h-screen">
      <AquaAmbience />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2">Skip to content</a>
      <div className="relative z-10 mx-auto flex max-w-[1400px] gap-6 p-3 md:p-6">
        <aside className="glass-surface sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col gap-6 rounded-3xl p-4 lg:flex">
          <Brand />
          <NavList />
          <p className="mt-auto px-2 text-xs text-muted-foreground">Educational only.</p>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="glass-surface mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3">
            <div className="flex items-center gap-2 lg:hidden">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="glass" size="icon" aria-label="Open menu"><Menu /></Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-popover">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="mb-6 mt-2"><Brand /></div>
                  <NavList onNavigate={() => setOpen(false)} />
                </SheetContent>
              </Sheet>
              <Brand />
            </div>
            <RangePicker />
            <UserChip />
          </div>
          <main id="main">{children}</main>
        </div>
      </div>
    </div>
  );
}
