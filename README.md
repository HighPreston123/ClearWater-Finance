# ClearWater

### A clearer picture of your finances. A more informed next step.

ClearWater is a hackathon financial-planning prototype that brings income, spending, savings, investments, and financial risk into one dashboard. It helps users understand their current position, explore future scenarios, and find the kind of financial advisor that fits their needs.

## Live Demo
🔗 https://advisor-voice-plan.lovable.app

**Demo login**
- Email: HackNC2026@gmail.com
- Password: hacknc2026

The demo account is preloaded with sample transactions, investments, and savings/loan data.
Please explore only. Don't delete or edit data, since everyone shares this account.

## Inspiration

Financial planning can feel overwhelming when your bank activity, investments, debts, and goals are scattered across different places. We wanted to make that information easier to understand and turn it into a useful starting point for a conversation with a financial advisor.

ClearWater combines financial calculations, visual explanations, and AI-generated summaries to help users see where they stand and what to consider next.

## What it does

- **Financial overview:** Summarizes income, spending, net cash flow, and historical cash-flow scores.
- **Transaction analysis:** Imports CSV transactions, organizes spending by category, and identifies recurring payments.
- **Savings planning:** Shows potential savings from adjustments to selected spending categories.
- **Investment tracking:** Organizes holdings by account and asset class, with Alpaca stock prices and historical market data.
- **Risk assessment:** Uses a financial survey and available financial inputs to explore resilience, portfolio risk, and financial wellness.
- **Retirement scenarios:** Runs Monte Carlo simulations to explore possible retirement outcomes under different assumptions.
- **Comparison and advisor matching:** Compares resilience with a fictional reference group and recommends fictional advisor profiles based on assessed financial needs.
- **AI explanations and audio:** Uses Gemini to explain calculated figures and ElevenLabs to read summaries aloud.
- **Account features:** Includes sign-in, saved financial data, optional authenticator-based two-factor authentication, and account deletion.

External integrations require configured server credentials and service availability.

## Try it

1. Open the demo and create an account or sign in.
2. Complete the onboarding questions.
3. Import fictional transaction, investment, or financial-input CSVs using the relevant import controls. Follow the in-app format guidance.
4. Explore your overview, recurring payments, savings, investments, and risk results.
5. Review the advisor recommendations and try the AI or audio summaries when available.

Use fictional data for hackathon demonstrations. Advisor profiles and comparison profiles are demo records; the prototype does not book appointments, connect users to verified professionals, or execute trades.

## How we built it

| Layer | Technology |
| --- | --- |
| Interface | React, TypeScript, Tailwind CSS, shadcn/ui, Radix UI, Recharts |
| Application framework | TanStack Start, TanStack Router, TanStack Query, Vite |
| Development and hosting | Lovable and its managed deployment environment |
| Authentication and current database | Supabase / Lovable Cloud |
| Stock prices and history | Alpaca Market Data, using the IEX feed |
| Demo banking integration | Capital One Nessie |
| Company fundamentals | SEC EDGAR |
| AI explanations | Gemini |
| Spoken summaries | ElevenLabs |
| Testing | Vitest and Testing Library |

Financial calculations live in dedicated TypeScript modules. The AI explains computed results; it does not replace the scoring formulas. Monte Carlo simulations use financial inputs, configurable return assumptions, and seeded random sampling.

Protected server functions verify authentication and enforce MFA when required. Private integration keys are read server-side.

## Challenges and what we learned

**Moving the database into the deployed environment.** We initially worked with TigerData/Timescale, but its database certificate chain was incompatible with the published Cloudflare Workers connection path. We moved the active financial-data layer to Lovable Cloud/Supabase. The `tiger/` folder preserves the earlier database work.

**Keeping the dashboard responsive.** Repeated authentication checks, data loading, and financial calculations made navigation slower. We introduced caching, shared calculations, and more selective saves to reduce repeated work.

**Making risk results understandable.** We separated historical cash-flow scoring, future resilience, portfolio analysis, and retirement simulations so users can see what each result represents. Missing inputs and modeling assumptions matter as much as the final number.

**Working with multiple APIs.** We learned to keep credentials on the server, cache reusable data, and show unavailable states when integrations cannot respond.

## Run locally

Install Bun, then:

```bash
git clone https://github.com/HighPreston123/ClearWater-Finance.git
cd ClearWater-Finance
bun install
bun run dev
```

Open the local URL printed by Vite.

**Backend prerequisite:** A working app requires the current Supabase/Lovable Cloud schema, SQL functions, security policies, and reference data. Those current database migrations are not included in this repository. The older migrations under `tiger/` do not recreate the active backend. The hosted demo is the easiest way to evaluate the complete prototype.

Configure environment variables for your own backend:

| Variables | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server authentication configuration |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser-facing Supabase configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only administrative operations and shared cache writes |
| `ALPACA_API_KEY`, `ALPACA_SECRET_KEY` | Stock market data |
| `GEMINI_API_KEY` | AI explanations |
| `ELEVENLABS_API_KEY` | Audio summaries |
| `NESSI` | Nessie demo banking data |

Use local environment configuration or your deployment's secret settings. Never commit private credentials or put them in variables prefixed with `VITE_`. Custom authentication-email routes also depend on Lovable-managed email configuration.

### Development commands

```bash
bun run test
bunx tsc --noEmit
bun run build
bun run lint
```

The pre-submission review passed 63 tests, TypeScript checking, and the production build using npm-installed dependencies. Lint still reports issues, primarily formatting. This was not a full audit of the deployed application or database permissions.

## What's next

- Connect the matching experience to verified financial advisors.
- Expand account integrations and improve import guidance.
- Refine and validate the risk methodology with more representative data.
- Add reproducible database setup, stronger API usage controls, and broader end-to-end tests.
- Improve accessibility and the explanations behind recommendations.

## AI and development acknowledgments

The team used the following tools during development:

- **PromptLab (UNC):** Prompt development.
- **ChatGPT 5.6 Luna:** Turning project ideas into prompts and creating fictional bank-account CSV data.
- **ChatGPT Astra:** Developing prompts for Lovable.
- **Gemini 3:** Research.
- **Lovable:** Front-end design and application scaffolding.
- **Claude Sonnet 5.5:** CSV data creation.
- **ChatGPT:** Repository review and README drafting.

Alpaca supplies stock history, and Nessie supports the demo banking-data integration. TigerData was explored during development but is not the active database in the final prototype.

---

ClearWater is an educational hackathon prototype. Scores and simulations depend on their inputs and assumptions; they are not guarantees of future performance or personalized professional financial advice.
