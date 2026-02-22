import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Brain, TrendingUp, Activity, Users, BarChart3, Heart } from 'lucide-react';
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
