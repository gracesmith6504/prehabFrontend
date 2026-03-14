# PREHAB — AI-Powered Injury Prevention for Female Athletes

> An autonomous AI agent that adapts training plans to the menstrual cycle, workload, and body signals — keeping athletes healthy and coaches informed.

**Built for [HackEurope 2026](https://hackeurope.dev)** · [Live Demo →](https://prehab.lovable.app)

---

## The Problem

Female athletes are **2–6× more likely** to suffer ACL injuries during the ovulatory phase of their menstrual cycle ([Hewett et al., 2007](https://pubmed.ncbi.nlm.nih.gov/17569833/)). Yet most training programmes ignore hormonal variation entirely, applying the same load regardless of cycle phase, soreness, or recovery status.

## What PREHAB Does

PREHAB is a **cycle-aware training optimisation platform** with an autonomous AI agent that:

1. **Predicts injury risk** — ML model scores each athlete 0–100 using training load, soreness, RPE, and menstrual cycle phase
2. **Adapts training plans** — automatically adjusts session intensity, type, and duration based on risk level and cycle phase multipliers
3. **Escalates to coaches** — flags high-risk athletes with evidence-backed explanations; coaches accept, modify, or reject changes
4. **Learns from feedback** — tracks coach acceptance rate and shifts between Full Autonomy, Dampened, and Suggest-Only modes
5. **Integrates wearable data** — syncs cycle tracking and activity metrics from Samsung Health / Galaxy Watch

---

## Features

### Athlete Dashboard
- Daily injury risk score with plain-language AI explanation
- Cycle-phase-aware training plan (original vs. AI-adjusted toggle)
- One-tap session logging with effort and muscle soreness tracking
- Samsung Health integration (steps, active minutes, calories)
- AI-generated adaptive goals

### Coach Dashboard
- Squad-level risk snapshot (Critical / High / Medium / Low tiers)
- Real-time escalation alerts with accept/modify/reject workflow
- Per-athlete plan management with coach override audit trail
- Squad risk trend analytics over time
- Adaptive agent autonomy controls per athlete

### AI Agent Loop
```
OBSERVE → PREDICT → ADJUST → ESCALATE → REFLECT
```
| Step | What happens |
|------|-------------|
| **Observe** | Fetch training sessions, soreness, cycle phase, wearable data |
| **Predict** | ML model scores injury risk; identifies top contributing factors |
| **Adjust** | Modify weekly plan — swap session types, reduce intensity, add rest |
| **Escalate** | Critical risk triggers immediate coach alert with reasoning |
| **Reflect** | Evaluate coach feedback history; update agent policy mode |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript · Vite |
| UI | shadcn/ui · Tailwind CSS · Framer Motion |
| Backend | Supabase (PostgreSQL · Auth · Edge Functions) |
| AI/ML | XGBoost (risk scoring) · Google Gemini (plan explanations) |
| Wearables | Samsung Health simulation API |
| Billing | [Paid.ai](https://paid.ai) usage-based signals |
| Deployment | Lovable (frontend) · Supabase (backend) |

---

## Architecture

```
Athlete App  ──►  Supabase DB  ◄──  agent-runner (Edge Function)
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                        risk_predictions        weekly_plans
                        risk_reports            agent_runs
                        escalations             feedback_events
                              │
                              ▼
                        paid-signal (Edge Function)
                              │
                              ▼
                          Paid.ai API
```

### Edge Functions

| Function | Purpose |
|----------|---------|
| `agent-runner` | Main agentic loop — risk scoring, plan adjustment, escalation, billing signals |
| `paid-signal` | Validates and forwards usage economics to Paid.ai |
| `seed-demo-data` | Seeds realistic demo athlete data for presentations |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (or use [Lovable Cloud](https://lovable.dev))

### Installation

```bash
git clone https://github.com/gracesmith6504/prehabFrontend.git
cd prehabFrontend
npm install
```

### Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |

Edge Function secrets (set via Supabase dashboard):

| Secret | Description |
|--------|-------------|
| `PAID_API_KEY` | Paid.ai API key for usage billing |
| `GEMINI_API_KEY` | Google Gemini for plan explanations |
| `ML_ENDPOINT_URL` | ML model endpoint for risk prediction |

### Run Locally

```bash
npm run dev
```

The app runs at `http://localhost:8080`.

---

## Pages & Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page — hero, features, pricing, FAQ |
| `/auth` | Login / signup with role selection (athlete or coach) |
| `/dashboard` | Athlete dashboard — risk gauge, today's session, goals |
| `/plan` | Weekly training plan with original vs. AI-adjusted toggle |
| `/risk-report` | Full risk report with ML explanation and research citations |
| `/cycle-setup` | Cycle configuration + Samsung Health sync |
| `/coach` | Coach command centre — squad risk, escalations, analytics |
| `/coach/escalations` | Active escalations with accept/modify/reject workflow |
| `/coach/plans` | Per-athlete plan templates and management |
| `/coach/analytics` | Squad risk trends and agent performance |
| `/coach/settings` | Demo data seeding for presentations |

---

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── coach/           # Coach-specific components
│   └── ui/              # shadcn/ui primitives
├── hooks/               # Custom React hooks (auth, mobile, toast)
├── integrations/        # Supabase client and auto-generated types
├── lib/                 # Utilities and risk calculation engine
├── pages/               # Route-level page components
│   └── coach/           # Coach dashboard pages
└── assets/              # Images and static assets

supabase/
└── functions/           # Supabase Edge Functions
    ├── agent-runner/    # Main AI agent loop
    ├── paid-signal/     # Paid.ai billing integration
    └── seed-demo-data/  # Demo data seeder

public/                  # Static files served at root
```

---

## Acknowledgements

- Research basis: Hewett et al. (2007), Gabbett (2016), Soligard et al. (2017)
- Built with [Lovable](https://lovable.dev), [Supabase](https://supabase.com), [shadcn/ui](https://ui.shadcn.com)
- Agent economics powered by [Paid.ai](https://paid.ai)

---

## License

This project was built for HackEurope 2026. All rights reserved.
