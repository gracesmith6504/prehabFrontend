import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, ArrowRight, Shield, Brain, TrendingUp } from 'lucide-react';
import heroImage from '@/assets/hero-athlete.jpg';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <span className="font-heading text-lg font-bold uppercase tracking-wider">CycleAgent</span>
          </div>
          <div className="flex gap-3">
            <Link to="/auth?mode=login" className="px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
              Log In
            </Link>
            <Link to="/auth?mode=signup" className="px-5 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:brightness-110 transition-all">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Female athlete" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        </div>

        <div className="container relative z-10 pt-20">
          <motion.div
            className="max-w-2xl"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-6 neon-border">
              AI-Powered • Cycle-Aware
            </span>
            <h1 className="text-5xl md:text-7xl font-heading font-bold leading-[0.95] mb-6">
              TRAIN SMARTER<br />
              <span className="text-primary text-glow">WITH CYCLE-AWARE</span><br />
              AI
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mb-8">
              Dynamically adjusts your training plan based on menstrual cycle phase, training load, and soreness — reducing ACL and soft-tissue injury risk while optimizing performance.
            </p>
            <div className="flex gap-4">
              <Link to="/auth?mode=signup" className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-bold rounded-lg text-lg hover:brightness-110 transition-all">
                Get Started <ArrowRight className="h-5 w-5" />
              </Link>
              <Link to="/auth?mode=login" className="inline-flex items-center gap-2 px-8 py-4 border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition-all">
                Log In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-background">
        <div className="container">
          <motion.h2
            className="text-3xl md:text-4xl font-heading font-bold text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            HOW IT <span className="text-primary">WORKS</span>
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Brain, title: 'OBSERVE & PREDICT', desc: 'The AI agent monitors your cycle phase, training load, and soreness signals to predict injury risk in real-time.' },
              { icon: TrendingUp, title: 'AUTO RE-PLAN', desc: 'When risk rises, your weekly plan automatically adjusts — reducing plyometrics, lowering sprint intensity, adding stability work.' },
              { icon: Shield, title: 'ESCALATE & PROTECT', desc: 'Critical risk triggers coach alerts. Every decision is explained with clear, science-backed reasoning.' },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                className="glass-card p-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <f.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-heading font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2026 CycleAgent — Autonomous Cycle-Aware Training Optimisation
        </div>
      </footer>
    </div>
  );
}
