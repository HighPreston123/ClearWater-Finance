// Idempotent seed: 10 fictional advisors (3 existing Nessie-backed + 7 new) and 100 fictional
// comparison profiles. Stable ids + ON CONFLICT DO NOTHING mean reruns never duplicate or overwrite.
// No scores or categories are assigned to people — that belongs to the future risk assessment.
// Usage: TIGER_DATABASE_URL=... NESSI=... node tiger/seed_reference.mjs
import postgres from "postgres";

const url = process.env.TIGER_DATABASE_URL;
if (!url) { console.error("TIGER_DATABASE_URL is not set"); process.exit(1); }

// Existing three advisors live in Nessie as customers; link them by name when reachable.
async function nessieIds() {
  const key = process.env.NESSI;
  if (!key) return {};
  try {
    const r = await fetch(`https://api.nessieisreal.com/customers?key=${encodeURIComponent(key)}`);
    if (!r.ok) return {};
    const out = {};
    for (const c of await r.json()) out[`${c.first_name} ${c.last_name}`] = c._id;
    return out;
  } catch { return {}; }
}

const A = (id, full_name, title, primary, secondary, o) => ({ id, full_name, title, primary, secondary, ...o });
const ADVISORS = [
  // Original three (preserved names; categories assigned once here).
  A("adv-maya-okafor", "Maya Okafor", "Budgeting Coach (demo)", "budgeting", ["cash_flow", "emergency_funds"], {
    biography: "Fictional demo advisor who helps people build a first working budget.", experience: "Fictional: 8 years coaching household budgets.",
    education: "B.A. Economics (fictional)", certifications: [], strengths: ["Spending plans", "Bill calendars"], advisory_style: "Practical, step-by-step",
    best_suited_for: ["Spending exceeds income", "No budget yet"], meeting_format: "virtual" }),
  A("adv-daniel-reyes", "Daniel Reyes", "Debt Specialist (demo)", "debt_management", ["budgeting"], {
    biography: "Fictional demo advisor focused on organizing and paying down debts.", experience: "Fictional: 11 years in consumer credit counseling.",
    education: "B.S. Finance (fictional)", certifications: [], strengths: ["Payoff ordering", "Creditor communication"], advisory_style: "Direct and structured",
    best_suited_for: ["Multiple debts", "High-interest balances"], meeting_format: "hybrid" }),
  A("adv-priya-shah", "Priya Shah", "Retirement Planner (demo)", "retirement_planning", ["investing", "long_term_planning"], {
    biography: "Fictional demo advisor focused on retirement accounts and long-horizon saving.", experience: "Fictional: 14 years in retirement planning.",
    education: "M.S. Financial Planning (fictional)", certifications: [], strengths: ["Account types", "Contribution planning"], advisory_style: "Patient, big-picture",
    best_suited_for: ["401(k)/IRA questions", "Long time horizon"], meeting_format: "virtual" }),
  // Seven new.
  A("adv-elena-marsh", "Elena Marsh", "Risk & Protection Advisor (demo)", "risk_management", ["emergency_funds"], {
    biography: "Fictional demo advisor helping households prepare for income shocks and insurance gaps.", experience: "Fictional: 12 years in insurance and protection planning.",
    education: "B.B.A. Risk Management (fictional)", certifications: ["Fictional demo credential"], strengths: ["Coverage reviews", "Shock planning"], advisory_style: "Calm, scenario-based",
    best_suited_for: ["Single income households", "Underinsured families"], meeting_format: "hybrid" }),
  A("adv-marcus-bell", "Marcus Bell", "Savings Strategist (demo)", "saving", ["emergency_funds", "goal_setting"], {
    biography: "Fictional demo advisor who turns irregular saving into automatic habits.", experience: "Fictional: 6 years in savings programs.",
    education: "B.A. Psychology (fictional)", certifications: [], strengths: ["Automation", "Habit design"], advisory_style: "Encouraging, habit-focused",
    best_suited_for: ["Little or no savings", "Irregular saving"], meeting_format: "virtual" }),
  A("adv-hana-kim", "Hana Kim", "Financial Educator (demo)", "financial_education", ["budgeting", "goal_setting"], {
    biography: "Fictional demo educator who explains money basics for first-time earners.", experience: "Fictional: 9 years running financial literacy workshops.",
    education: "M.Ed. (fictional)", certifications: [], strengths: ["Plain-language teaching", "Workshops"], advisory_style: "Teaching-first",
    best_suited_for: ["New to managing money", "Students and early career"], meeting_format: "in_person" }),
  A("adv-omar-haddad", "Omar Haddad", "Portfolio Advisor (demo)", "investing", ["wealth_building"], {
    biography: "Fictional demo advisor focused on diversification and portfolio basics.", experience: "Fictional: 15 years in portfolio management.",
    education: "M.B.A. (fictional)", certifications: ["Fictional demo credential"], strengths: ["Diversification", "Fee awareness"], advisory_style: "Analytical",
    best_suited_for: ["Concentrated portfolios", "New investors"], meeting_format: "virtual" }),
  A("adv-grace-adeyemi", "Grace Adeyemi", "Cash Flow Coach (demo)", "cash_flow", ["budgeting", "debt_management"], {
    biography: "Fictional demo coach for people whose bills and paydays don't line up.", experience: "Fictional: 7 years coaching gig and hourly workers.",
    education: "B.S. Accounting (fictional)", certifications: [], strengths: ["Variable income planning", "Bill timing"], advisory_style: "Hands-on, weekly check-ins",
    best_suited_for: ["Variable income", "Frequent overdrafts"], meeting_format: "hybrid" }),
  A("adv-thomas-lindqvist", "Thomas Lindqvist", "Long-Term Planner (demo)", "long_term_planning", ["wealth_building", "retirement_planning"], {
    biography: "Fictional demo planner who maps multi-decade goals like homes and education.", experience: "Fictional: 18 years in comprehensive planning.",
    education: "M.S. Financial Planning (fictional)", certifications: ["Fictional demo credential"], strengths: ["Multi-goal plans", "Milestone tracking"], advisory_style: "Strategic",
    best_suited_for: ["Major life goals", "Mid-career planning"], meeting_format: "in_person" }),
  A("adv-sofia-romero", "Sofia Romero", "Goals & Wealth Coach (demo)", "goal_setting", ["wealth_building", "saving"], {
    biography: "Fictional demo coach helping people prioritize competing goals.", experience: "Fictional: 10 years in goals-based coaching.",
    education: "B.A. Business (fictional)", certifications: [], strengths: ["Prioritization", "Progress reviews"], advisory_style: "Motivational",
    best_suited_for: ["Competing goals", "Unclear priorities"], meeting_format: "virtual" }),
];

// Deterministic PRNG so every run generates identical profiles.
let seed = 20261010;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (lo, hi) => Math.round(lo + rnd() * (hi - lo));

const FIRST = ["Avery","Jordan","Riley","Casey","Morgan","Quinn","Rowan","Sage","Emery","Parker","Reese","Skyler","Dakota","Hayden","Jules","Kendall","Logan","Micah","Noel","Peyton"];
const LAST = ["Alder","Brennan","Castillo","Dorsey","Ellison","Fairbanks","Galloway","Hargrove","Ibarra","Jansen","Kowalski","Lindgren","Moreau","Nakamura","Oduya"];
const OCC = ["Teacher","Nurse","Rideshare driver","Software engineer","Retail associate","Electrician","Graduate student","Small-business owner","Accountant","Chef","Freelance designer","Warehouse lead","Pharmacist","Retired","Line cook"];
const AGE = ["18-24","25-34","35-44","45-54","55-64","65+"];
const HOUSE = ["Single","Couple, no children","Couple with children","Single parent","Living with roommates","Multigenerational"];
const STAB = ["salaried","hourly","variable","seasonal","fixed (pension)"];
const SPEND = ["frugal","steady","impulse-heavy","subscription-heavy","seasonal spikes","housing-heavy"];
const EXP = ["none","beginner","intermediate","experienced"];
const GOALS = ["Build emergency fund","Pay off credit cards","Buy a home","Save for retirement","Pay off student loans","Start investing","Fund child's education","Start a business","Travel","Reduce monthly bills"];

function profiles() {
  const out = [];
  for (let i = 0; i < 100; i++) {
    const name = `${FIRST[i % 20]} ${LAST[Math.floor(i / 20) * 3 + (i % 3)]}`;
    const income = between(18, 220) * 1000_00;
    const spendRatio = 0.45 + rnd() * 0.7; // some spend more than they earn
    const monthlySpend = Math.round((income / 12) * spendRatio);
    const cc = rnd() < 0.6 ? between(0, 25000) * 100 : 0;
    const student = rnd() < 0.35 ? between(5000, 90000) * 100 : 0;
    const auto = rnd() < 0.4 ? between(3000, 35000) * 100 : 0;
    const exp = pick(EXP);
    const goals = [...new Set([pick(GOALS), pick(GOALS), pick(GOALS)])].slice(0, between(1, 3));
    out.push({
      id: `cmp-${String(i + 1).padStart(3, "0")}`,
      full_name: name,
      age_band: pick(AGE), household: pick(HOUSE), occupation: pick(OCC),
      financial_background: `Synthetic demo profile: ${pick(STAB)} income, ${pick(SPEND)} spender, ${exp} investor.`,
      annual_income_cents: income, income_stability: pick(STAB),
      monthly_spending_cents: monthlySpend, spending_pattern: pick(SPEND),
      savings_cents: between(0, 60000) * 100 * (rnd() < 0.2 ? 0 : 1),
      monthly_savings_cents: Math.max(0, Math.round(income / 12 - monthlySpend)),
      debt_cents: cc + student + auto,
      debt_breakdown: { credit_card_cents: cc, student_loan_cents: student, auto_loan_cents: auto },
      investments_cents: exp === "none" ? 0 : between(500, 400000) * 100,
      investment_experience: exp,
      financial_goals: goals,
      recent_activity: [
        { kind: "deposit", note: "Paycheck", months_ago: 0 },
        { kind: rnd() < 0.3 ? "overdraft" : "bill_paid", note: "Monthly bills", months_ago: 0 },
      ],
    });
  }
  return out;
}

const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
try {
  const ids = await nessieIds();
  let newAdv = 0, newPeople = 0;
  await sql.begin(async (tx) => {
    await tx`SELECT set_config('app.advisor_admin', 'on', true)`;
    for (const a of ADVISORS) {
      const r = await tx`INSERT INTO fin.advisors (id, full_name, title, biography, experience, education, certifications, strengths,
          advisory_style, best_suited_for, meeting_format, nessie_customer_id)
        VALUES (${a.id}, ${a.full_name}, ${a.title}, ${a.biography}, ${a.experience}, ${a.education}, ${a.certifications}, ${a.strengths},
          ${a.advisory_style}, ${a.best_suited_for}, ${a.meeting_format}, ${ids[a.full_name] ?? null})
        ON CONFLICT DO NOTHING RETURNING id`;
      if (!r.length) continue; // existing advisor — never touch its categories
      newAdv++;
      await tx`INSERT INTO fin.advisor_categories (advisor_id, category_code, role) VALUES (${a.id}, ${a.primary}, 'primary')`;
      for (const s of a.secondary) await tx`INSERT INTO fin.advisor_categories (advisor_id, category_code, role) VALUES (${a.id}, ${s}, 'secondary')`;
    }
    for (const p of profiles()) {
      const r = await tx`INSERT INTO fin.comparison_profiles ${tx(p, Object.keys(p))} ON CONFLICT (id) DO NOTHING RETURNING id`;
      newPeople += r.length;
    }
  });
  const [c] = await sql`SELECT (SELECT count(*) FROM fin.advisors)::int AS advisors, (SELECT count(*) FROM fin.comparison_profiles)::int AS profiles`;
  console.log(`inserted ${newAdv} advisors, ${newPeople} profiles; totals: ${c.advisors} advisors, ${c.profiles} profiles`);
} catch (e) {
  console.error("seed failed:", e.code ?? "", String(e.message).replace(/postgres(ql)?:\/\/\S+/g, "[redacted]"));
  process.exitCode = 1;
} finally {
  await sql.end();
}
