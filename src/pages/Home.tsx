import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Brain, TrendingUp } from 'lucide-react';
import heroImage from '@/assets/soccer-women-hero.jpg';
import prehabLogo from '@/assets/prehab-logo.png';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero - full bleed, no fixed nav */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img src={heroImage} alt="Female soccer athletes" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
        </div>

        {/* Top label */}
        <div className="relative z-10 px-6 md:px-12 pt-10">
          <div className="flex items-center gap-2">
            <img src={prehabLogo} alt="PREHAB logo" className="h-8 w-8" />
            <span className="text-primary text-xs font-bold uppercase tracking-[0.3em]">
              PREHAB
            </span>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex items-end px-6 md:px-12 pb-16 md:pb-24">
          <motion.div
            className="max-w-3xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-heading font-bold leading-[0.9] mb-6">
              TRAIN<br />SMARTER<br />
              <span className="text-primary text-glow">WITH YOUR</span><br />
              <span className="text-primary text-glow">BODY</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mb-10">
              AI-powered training optimization that adapts to your menstrual cycle, training load, and body signals to reduce injury risk and maximize performance.
            </p>
            <div className="flex gap-4">
              <Link to="/auth?mode=signup" className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-bold rounded-lg text-lg hover:brightness-110 transition-all">
                Get Started <ArrowRight className="h-5 w-5" />
              </Link>
              <Link to="/auth?mode=login" className="inline-flex items-center gap-2 px-8 py-4 border border-border text-foreground font-medium rounded-lg hover:bg-secondary/50 transition-all">
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
          © 2026 PREHAB — Autonomous Cycle-Aware Training Optimisation
        </div>
      </footer>
    </div>
  );
}
