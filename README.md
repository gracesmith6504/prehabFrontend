# PREHAB — AI-Powered Injury Prevention for Female Athletes

PREHAB is a cycle-aware training optimisation platform that uses an autonomous AI agent to predict injury risk, adapt weekly training plans, and escalate to coaches — all informed by menstrual cycle phase, wearable data, and evidence-based sports science.

Built for HackEurope 2026.

---

## What it does

- **Injury risk scoring** — ML model (XGBoost) predicts injury probability from training load, soreness, RPE, and cycle phase
- **Cycle-aware plan adjustment** — autonomous agent adapts session intensity and duration based on menstrual phase multipliers (menstruation 0.72×, luteal 0.88×, ovulatory 1.12×)
- **Coach escalation loop** — high-risk athletes are automatically flagged to their coach with an explanation; coaches can accept, modify, or reject the plan change, feeding back into the agent's policy
- **Agent adaptability** — the agent tracks feedback over time and shifts between Full Autonomy, Dampened, and Suggest-Only modes based on coach acceptance rate
- **Samsung Health integration** — syncs cycle data and simulates activity metrics (steps, active minutes, calories) in Samsung Health's visual style
- **Scientific evidence base** — all risk factors are backed by peer-reviewed citations served from a live `/evidence` endpoint
- **Usage-based billing** — every autonomous agent action emits a signal to Paid.ai, enabling per-adjustment revenue tracking

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | shadcn/ui + Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| AI | Google Gemini (plan explanations) + XGBoost (risk scoring) |
| Wearables | Samsung Health simulation API (Cloud Run) |
| Billing | Paid.ai usage signals |
| Deployment | Lovable (frontend) + Supabase (backend) |

---

## Architecture

```
Athlete app  ──►  Supabase DB  ◄──  agent-runner (Edge Function)
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

**Agent loop (runs on schedule or manual trigger):**
1. OBSERVE — fetch training sessions, soreness, cycle phase, wearable data
2. THINK — score injury risk via ML, compute AC ratio
3. ACT — adjust weekly plan if risk is elevated
4. LOG — write risk prediction, report, and plan to DB; emit Paid.ai signal
5. REFLECT — evaluate coach feedback history, update `athlete_agent_state` policy

---

## Supabase edge functions

| Function | Purpose |
|---|---|
| `agent-runner` | Main agentic loop — risk scoring, plan adjustment, escalation, Paid.ai signals |
| `paid-signal` | Validates and forwards usage economics to Paid.ai API |
| `seed-demo-data` | Seeds realistic demo athlete data for presentations |

---

## Key environment variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

Supabase secrets (set via `supabase secrets set`):
```
PAID_API_KEY=        # Paid.ai API key for usage billing
GEMINI_API_KEY=      # Google Gemini for plan explanations
```

---

## Local development

```sh
git clone https://github.com/gracesmith6504/prehabFrontend
cd prehabFrontend
npm install
npm run dev
```

Pushing to `main` auto-deploys to Lovable.

---

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — risk gauge, Samsung Health rings, agent behaviour card |
| `/risk-report` | Athlete risk report with ML explanation and evidence citations |
| `/plan` | Weekly training plan with agent adjustments highlighted |
| `/cycle-setup` | Cycle configuration + Samsung Health sync |
| `/coach` | Coach dashboard — squad risk overview |
| `/coach/escalations` | Active escalations with accept/modify/reject workflow |
| `/coach/plans` | Per-athlete plan management |
| `/goals` | Goal tracker |
