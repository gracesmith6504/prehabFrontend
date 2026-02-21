import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskBadge from '@/components/RiskBadge';
import {
  generateDefaultPlan, adjustPlan, generateExplanation,
  getCurrentPhase, calculateAcuteChronicRatio, calculateSorenessContribution,
  calculateRiskScore, type PlanSession, type MenstrualPhase,
} from '@/lib/riskEngine';
import { ClipboardList, ArrowRight, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PlanView() {
  const { user } = useAuth();
  const [original, setOriginal] = useState<PlanSession[]>([]);
  const [adjusted, setAdjusted] = useState<PlanSession[]>([]);
  const [changes, setChanges] = useState<string[]>([]);
  const [riskScore, setRiskScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState('Low');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const compute = async () => {
      const { data: ap } = await supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();
      const phase = ap?.cycle_start_date
        ? getCurrentPhase(ap.cycle_start_date, ap.cycle_length || 28, ap.menstruation_length || 5)
        : 'unknown' as MenstrualPhase;

      const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: sessions } = await supabase.from('training_sessions').select('date, duration, rpe, intensity').eq('athlete_id', user.id).gte('date', since);
      const ratio = calculateAcuteChronicRatio(sessions || []);

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: soreness } = await supabase.from('soreness_logs').select('knee, hamstring, groin, calf, other_value').eq('athlete_id', user.id).gte('date', threeDaysAgo).order('date', { ascending: false });
      const sorenessContrib = calculateSorenessContribution(soreness || []);

      const risk = calculateRiskScore(phase, ratio, sorenessContrib);
      setRiskScore(risk.score);
      setRiskLevel(risk.level);

      // Check if there's a saved plan, otherwise use default
      const { data: savedPlan } = await supabase.from('weekly_plans').select('*').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

      const basePlan = savedPlan?.original_plan
        ? (savedPlan.original_plan as unknown as PlanSession[])
        : generateDefaultPlan();
      setOriginal(basePlan);

      const result = adjustPlan(basePlan, risk.score);
      setAdjusted(result.adjusted);
      setChanges(result.changes);
      setExplanation(generateExplanation(phase, risk.score, ratio, sorenessContrib, result.changes));

      // Save plan
      if (savedPlan) {
        await supabase.from('weekly_plans').update({
          adjusted_plan: result.adjusted as any,
          risk_score: risk.score,
          risk_level: risk.level,
          explanation: generateExplanation(phase, risk.score, ratio, sorenessContrib, result.changes),
        }).eq('id', savedPlan.id);
      } else {
        await supabase.from('weekly_plans').insert({
          athlete_id: user.id,
          original_plan: basePlan as any,
          adjusted_plan: result.adjusted as any,
          risk_score: risk.score,
          risk_level: risk.level,
          explanation: generateExplanation(phase, risk.score, ratio, sorenessContrib, result.changes),
        });
      }

      setLoading(false);
    };

    compute();
  }, [user]);

  const isChanged = (day: string) => adjusted.find(s => s.day === day)?.notes;

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  }

  const today = new Date();
  const todayDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];

  // Build week dates starting from Monday
  const getWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { day, date: d };
    });
  };
  const weekDates = getWeekDates();

  const intensityColor = (intensity: string) => {
    if (intensity === 'High') return 'bg-destructive/20 text-destructive border-destructive/30';
    if (intensity === 'Medium') return 'bg-warning/20 text-warning border-warning/30';
    return 'bg-primary/20 text-primary border-primary/30';
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-primary" />
              WEEKLY PLAN
            </h1>
            <p className="text-muted-foreground mt-1">AI-adjusted based on your current risk profile.</p>
          </div>
          <RiskBadge level={riskLevel} />
        </div>

        {changes.length > 0 && (
          <div className="glass-card p-4 border-primary/30">
            <p className="text-xs text-primary font-bold uppercase tracking-wider mb-2">AI Adjustments Made</p>
            <ul className="space-y-1">
              {changes.map((c, i) => (
                <li key={i} className="text-sm text-muted-foreground">• {c}</li>
              ))}
            </ul>
          </div>
        )}

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calendar" className="gap-2"><Calendar className="h-4 w-4" /> Calendar View</TabsTrigger>
            <TabsTrigger value="comparison" className="gap-2"><ArrowRight className="h-4 w-4" /> Comparison View</TabsTrigger>
          </TabsList>

          {/* Calendar View */}
          <TabsContent value="calendar" className="mt-4">
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map(({ day, date }) => {
                const session = adjusted.find(s => s.day === day);
                const isToday = day === todayDay;
                const orig = original.find(s => s.day === day);
                const changed = orig && session && (orig.type !== session.type || orig.intensity !== session.intensity || orig.duration !== session.duration);
                return (
                  <motion.div
                    key={day}
                    className={`rounded-xl border p-3 flex flex-col gap-2 min-h-[140px] ${
                      isToday ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card'
                    }`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: weekDates.indexOf(weekDates.find(w => w.day === day)!) * 0.04 }}
                  >
                    <div className="text-center">
                      <p className={`text-xs font-bold uppercase ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {day.slice(0, 3)}
                      </p>
                      <p className={`text-lg font-heading font-bold ${isToday ? 'text-primary' : ''}`}>
                        {date.getDate()}
                      </p>
                    </div>
                    {session && (
                      <div className="flex-1 flex flex-col gap-1.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-center border ${intensityColor(session.intensity)}`}>
                          {session.intensity}
                        </span>
                        <p className={`text-xs font-medium text-center ${changed ? 'text-primary' : ''}`}>
                          {session.type}
                        </p>
                        <p className="text-xs text-muted-foreground text-center">{session.duration}min</p>
                        {changed && (
                          <p className="text-[10px] text-primary text-center font-medium">AI adjusted</p>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* Comparison View */}
          <TabsContent value="comparison" className="mt-4 space-y-3">
            <div className="grid grid-cols-[80px_1fr_40px_1fr] gap-2 text-xs text-muted-foreground uppercase tracking-wider px-4">
              <span>Day</span>
              <span>Original</span>
              <span></span>
              <span>Adjusted</span>
            </div>
            {original.map((o, i) => {
              const a = adjusted[i];
              const changed = o.type !== a.type || o.intensity !== a.intensity || o.duration !== a.duration;
              return (
                <motion.div
                  key={o.day}
                  className={`grid grid-cols-[80px_1fr_40px_1fr] gap-2 items-center p-4 rounded-lg ${
                    changed ? 'bg-primary/5 border border-primary/20' : 'glass-card'
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <span className="font-heading font-bold text-sm">{o.day.slice(0, 3)}</span>
                  <div className="text-sm">
                    <span className={changed ? 'line-through text-muted-foreground' : ''}>{o.type}</span>
                    <span className="text-xs text-muted-foreground ml-2">{o.intensity} • {o.duration}min</span>
                  </div>
                  <div className="flex justify-center">
                    {changed && <ArrowRight className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="text-sm">
                    <span className={changed ? 'text-primary font-bold' : ''}>{a.type}</span>
                    <span className="text-xs text-muted-foreground ml-2">{a.intensity} • {a.duration}min</span>
                  </div>
                </motion.div>
              );
            })}
          </TabsContent>
        </Tabs>

        {/* Explanation */}
        <div className="glass-card p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">AI Explanation</p>
          <p className="text-sm leading-relaxed">{explanation}</p>
        </div>
      </div>
    </AppLayout>
  );
}
