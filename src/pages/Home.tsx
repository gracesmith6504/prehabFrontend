import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Brain, TrendingUp, Activity, Users, BarChart3, Heart } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import heroImage from '@/assets/soccer-women-hero.jpg';
import prehabLogo from '@/assets/prehab-logo.png';

const fade = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } };

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ── */}
      <section className="relative min-h-[90vh] flex flex-col overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Female soccer athletes" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
        </div>

        <div className="relative z-10 px-6 md:px-12 pt-10">
          <div className="flex items-center gap-2">
            <img src={prehabLogo} alt="PREHAB" className="h-8 w-8" />
            <span className="text-primary text-xs font-bold uppercase tracking-[0.3em]">PREHAB</span>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex items-end px-6 md:px-12 pb-16 md:pb-24">
          <motion.div className="max-w-2xl" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold leading-[0.92] mb-5">
              REDUCE INJURIES.<br />
              <span className="text-primary">TRAIN SMARTER.</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-lg mb-8">
              An AI agent that adapts training plans to your menstrual cycle, workload, and body signals — keeping athletes healthy and coaches informed.
            </p>
            <div className="flex gap-3">
              <Link to="/auth?mode=signup" className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary text-primary-foreground font-bold rounded-lg hover:brightness-110 transition-all">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/auth?mode=login" className="inline-flex items-center gap-2 px-7 py-3.5 border border-border text-foreground font-medium rounded-lg hover:bg-secondary/50 transition-all">
                Log In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── For Athletes + Coaches ── */}
      <section className="py-20 md:py-28">
        <div className="container max-w-5xl">
          <motion.p {...fade} className="text-primary text-xs font-bold uppercase tracking-[0.2em] mb-3 text-center">Built for both sides</motion.p>
          <motion.h2 {...fade} className="text-2xl md:text-4xl font-heading font-bold text-center mb-14">
            ATHLETES TRAIN. COACHES OVERSEE.<br />
            <span className="text-primary">THE AI CONNECTS THEM.</span>
          </motion.h2>

          <div className="grid md:grid-cols-2 gap-6">
            <motion.div {...fade} className="glass-card p-7 space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Activity className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Athlete Dashboard</span>
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex gap-2"><span className="text-primary">•</span>Daily injury risk score with plain-language explanation</li>
                <li className="flex gap-2"><span className="text-primary">•</span>Cycle-phase-aware training plan, auto-adjusted by AI</li>
                <li className="flex gap-2"><span className="text-primary">•</span>One-tap session logging with effort & soreness tracking</li>
                <li className="flex gap-2"><span className="text-primary">•</span>Samsung Health integration for steps, heart rate & recovery</li>
                <li className="flex gap-2"><span className="text-primary">•</span>AI-generated goals that adapt as you progress</li>
              </ul>
            </motion.div>

            <motion.div {...fade} transition={{ delay: 0.1 }} className="glass-card p-7 space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Users className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Coach Dashboard</span>
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex gap-2"><span className="text-primary">•</span>Squad-level risk snapshot with critical/high/medium/low tiers</li>
                <li className="flex gap-2"><span className="text-primary">•</span>Real-time escalation alerts when athletes hit critical risk</li>
                <li className="flex gap-2"><span className="text-primary">•</span>Create & assign weekly training templates to the squad</li>
                <li className="flex gap-2"><span className="text-primary">•</span>Override AI decisions with full audit trail</li>
                <li className="flex gap-2"><span className="text-primary">•</span>Squad risk trends & analytics over time</li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="container max-w-5xl">
          <motion.h2 {...fade} className="text-2xl md:text-3xl font-heading font-bold text-center mb-14">
            HOW THE <span className="text-primary">AI AGENT</span> WORKS
          </motion.h2>

          <div className="grid md:grid-cols-4 gap-5">
            {[
              { icon: Heart, title: 'Observe', desc: 'Collects cycle phase, training load, soreness, and wearable data every day.' },
              { icon: Brain, title: 'Predict', desc: 'ML model scores injury risk 0–100 and identifies the top contributing factors.' },
              { icon: TrendingUp, title: 'Adjust', desc: 'Auto-modifies the weekly plan — swaps session types, reduces intensity, adds rest.' },
              { icon: Shield, title: 'Escalate', desc: 'Critical risk triggers immediate coach alerts with clear, evidence-backed reasoning.' },
            ].map((f, i) => (
              <motion.div key={f.title} {...fade} transition={{ delay: i * 0.1 }} className="glass-card p-6 text-center">
                <f.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-heading font-bold text-sm uppercase mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Key Numbers ── */}
      <section className="py-16 border-t border-border">
        <div className="container max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { stat: '4-Tier', label: 'Risk classification' },
              { stat: '7-Day', label: 'Adaptive plan cycle' },
              { stat: 'Real-time', label: 'Wearable sync' },
              { stat: '100%', label: 'Decisions explained' },
            ].map((s, i) => (
              <motion.div key={s.label} {...fade} transition={{ delay: i * 0.08 }}>
                <p className="text-2xl md:text-3xl font-heading font-bold text-primary">{s.stat}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="container max-w-5xl">
          <motion.p {...fade} className="text-primary text-xs font-bold uppercase tracking-[0.2em] mb-3 text-center">Agent-Native Pricing</motion.p>
          <motion.h2 {...fade} className="text-2xl md:text-3xl font-heading font-bold text-center mb-4">
            PAY FOR <span className="text-primary">AI WORK DONE</span> — NOT SEATS.
          </motion.h2>
          <motion.p {...fade} className="text-muted-foreground text-sm text-center max-w-lg mx-auto mb-14">
            We charge for autonomous clinical work completed — not dashboards or user counts.
          </motion.p>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {/* Athlete Plan */}
            <motion.div {...fade} className="glass-card p-8 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-5 w-5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Athlete Plan</span>
              </div>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-4xl font-heading font-bold">€29</span>
                <span className="text-muted-foreground text-sm">/ month</span>
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground flex-1">
                <li className="flex gap-2"><span className="text-primary">✓</span>Continuous monitoring</li>
                <li className="flex gap-2"><span className="text-primary">✓</span>Up to 10 autonomous interventions (plan adjustments + escalations)</li>
                <li className="flex gap-2"><span className="text-primary">✓</span>Additional interventions at €3 each</li>
              </ul>
              <Link to="/auth?mode=signup" className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:brightness-110 transition-all text-sm">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            {/* Coach Plan */}
            <motion.div {...fade} transition={{ delay: 0.1 }} className="glass-card p-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">Popular</div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Coach Plan</span>
              </div>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-4xl font-heading font-bold">€79</span>
                <span className="text-muted-foreground text-sm">/ month</span>
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground flex-1">
                <li className="flex gap-2"><span className="text-primary">✓</span>Up to 15 athletes</li>
                <li className="flex gap-2"><span className="text-primary">✓</span>40 shared autonomous interventions</li>
                <li className="flex gap-2"><span className="text-primary">✓</span>Additional interventions at €3 each</li>
              </ul>
              <Link to="/auth?mode=signup" className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:brightness-110 transition-all text-sm">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>

          {/* Unit Economics callout */}
          <motion.div {...fade} className="glass-card p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-lg font-heading font-bold text-primary">~€0.05</p>
              <p className="text-xs text-muted-foreground">AI compute cost</p>
            </div>
            <div>
              <p className="text-lg font-heading font-bold text-primary">€20–€30</p>
              <p className="text-xs text-muted-foreground">Human equivalent</p>
            </div>
            <div>
              <p className="text-lg font-heading font-bold text-primary">€3</p>
              <p className="text-xs text-muted-foreground">Customer price</p>
            </div>
            <div>
              <p className="text-lg font-heading font-bold text-primary">7–10×</p>
              <p className="text-xs text-muted-foreground">ROI per intervention</p>
            </div>
          </motion.div>

          <motion.p {...fade} className="text-center text-sm font-medium text-muted-foreground mt-8 max-w-lg mx-auto">
            PREHAB monetizes measurable AI work, proving economic value for every action performed.
          </motion.p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="container max-w-3xl">
          <motion.p {...fade} className="text-primary text-xs font-bold uppercase tracking-[0.2em] mb-3 text-center">FAQ</motion.p>
          <motion.h2 {...fade} className="text-2xl md:text-3xl font-heading font-bold text-center mb-12">
            COMMON <span className="text-primary">QUESTIONS</span>
          </motion.h2>

          <motion.div {...fade}>
            <Accordion type="single" collapsible className="space-y-2">
              {[
                { q: "What counts as an autonomous intervention?", a: "An intervention is any time the AI agent autonomously modifies your training plan (e.g. swapping a session type, reducing intensity) or creates an escalation alert for your coach. Passive monitoring and risk scoring are always included — you only use interventions when the agent takes action." },
                { q: "What happens when I run out of included interventions?", a: "You can keep training without interruption. Each additional intervention is billed at €3. You'll always see your current usage in the dashboard before the agent acts, so there are no surprises." },
                { q: "Can I cap my monthly spend?", a: "Yes. You can set a monthly intervention limit in your settings. Once reached, the agent will flag recommendations but won't act autonomously — it hands decisions back to you or your coach." },
                { q: "How does the Coach Plan share interventions across athletes?", a: "The 40 included interventions are pooled across all athletes on the plan. If one athlete needs more adjustments in a given month, the pool flexes to cover it. Additional interventions beyond 40 are €3 each." },
                { q: "What data does the AI agent use?", a: "The agent combines your menstrual cycle phase, training load history, daily soreness logs, and wearable metrics (steps, heart rate, sleep) to score injury risk and decide when to intervene." },
              ].map((item) => (
                <AccordionItem key={item.q} value={item.q} className="glass-card px-6 border-none">
                  <AccordionTrigger className="text-sm font-medium text-left hover:no-underline">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm leading-relaxed">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 border-t border-border">
        <div className="container max-w-xl text-center">
          <motion.h2 {...fade} className="text-2xl md:text-3xl font-heading font-bold mb-4">
            Ready to <span className="text-primary">protect your squad</span>?
          </motion.h2>
          <motion.p {...fade} className="text-muted-foreground text-sm mb-8">
            Sign up as an athlete or coach — the AI agent starts working from day one.
          </motion.p>
          <motion.div {...fade}>
            <Link to="/auth?mode=signup" className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-bold rounded-lg hover:brightness-110 transition-all">
              Get Started Free <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8">
        <div className="container text-center text-xs text-muted-foreground">
          © 2026 PREHAB — Autonomous Cycle-Aware Injury Prevention for Women's Sport
        </div>
      </footer>
    </div>
  );
}
