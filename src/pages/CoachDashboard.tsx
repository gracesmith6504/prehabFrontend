import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskBadge from '@/components/RiskBadge';
import { Shield, Users, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

interface AthleteInfo {
  user_id: string;
  email: string;
  full_name: string | null;
  latestReport: {
    risk_score: number;
    risk_level: string;
    escalation_status: string;
    explanation: string | null;
    phase: string | null;
  } | null;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const [athletes, setAthletes] = useState<AthleteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteInfo | null>(null);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Get athletes assigned to this coach
      const { data: profiles } = await supabase
        .from('athlete_profiles')
        .select('user_id')
        .eq('coach_id', user.id);

      if (!profiles?.length) {
        setLoading(false);
        return;
      }

      const athleteIds = profiles.map(p => p.user_id);

      // Get their profile info
      const { data: userProfiles } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', athleteIds);

      // Get latest risk reports
      const infos: AthleteInfo[] = [];
      for (const up of userProfiles || []) {
        const { data: report } = await supabase
          .from('risk_reports')
          .select('risk_score, risk_level, escalation_status, explanation, phase')
          .eq('athlete_id', up.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        infos.push({
          user_id: up.user_id,
          email: up.email || '',
          full_name: up.full_name,
          latestReport: report,
        });
      }

      setAthletes(infos);
      setLoading(false);
    };

    load();
  }, [user]);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            COACH DASHBOARD
          </h1>
          <p className="text-muted-foreground mt-1">Monitor your athletes' risk levels and escalations.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : athletes.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No athletes assigned</p>
            <p className="text-sm text-muted-foreground">Athletes will appear here once they add you as their coach.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {athletes.map((a, i) => (
              <motion.div
                key={a.user_id}
                className={`glass-card p-5 cursor-pointer transition-all hover:bg-secondary/30 ${
                  a.latestReport?.escalation_status === 'escalated' ? 'border-destructive/30' : ''
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setSelectedAthlete(selectedAthlete?.user_id === a.user_id ? null : a)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {a.latestReport?.escalation_status === 'escalated' && (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    )}
                    <div>
                      <p className="font-bold">{a.full_name || a.email}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.latestReport && (
                      <>
                        <span className="text-lg font-heading font-bold">{a.latestReport.risk_score}</span>
                        <RiskBadge level={a.latestReport.risk_level} />
                      </>
                    )}
                  </div>
                </div>

                {selectedAthlete?.user_id === a.user_id && a.latestReport && (
                  <motion.div
                    className="mt-4 pt-4 border-t border-border space-y-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Phase:</span>{' '}
                        <span className="font-medium capitalize">{a.latestReport.phase || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>{' '}
                        <span className={`font-medium ${a.latestReport.escalation_status === 'escalated' ? 'text-destructive' : 'text-primary'}`}>
                          {a.latestReport.escalation_status === 'escalated' ? 'Escalated' : 'Normal'}
                        </span>
                      </div>
                    </div>
                    {a.latestReport.explanation && (
                      <p className="text-sm text-muted-foreground">{a.latestReport.explanation}</p>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
