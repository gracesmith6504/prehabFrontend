
-- Goal tracking for athletes
CREATE TABLE public.athlete_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_by_type TEXT NOT NULL DEFAULT 'agent', -- 'agent' | 'coach'
  metric_type TEXT NOT NULL, -- 'risk_score' | 'acr' | 'weekly_load'
  direction TEXT NOT NULL DEFAULT 'decrease', -- 'decrease' | 'increase' | 'maintain_range'
  target_value NUMERIC NOT NULL,
  target_range_min NUMERIC NULL, -- for maintain_range goals
  target_range_max NUMERIC NULL,
  baseline_value NUMERIC NOT NULL, -- value when goal was created
  current_value NUMERIC NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'achieved' | 'failed' | 'cancelled'
  progress_pct NUMERIC NOT NULL DEFAULT 0,
  progress_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  agent_run_id UUID NULL,
  reason TEXT NULL,
  achieved_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_goals ENABLE ROW LEVEL SECURITY;

-- Athletes view own goals
CREATE POLICY "Athletes can view own goals"
  ON public.athlete_goals FOR SELECT
  USING (auth.uid() = athlete_id);

-- Coaches view assigned athlete goals
CREATE POLICY "Coaches can view assigned athlete goals"
  ON public.athlete_goals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM athlete_profiles
    WHERE athlete_profiles.user_id = athlete_goals.athlete_id
      AND athlete_profiles.coach_id = auth.uid()
  ));

-- Coaches can create goals for assigned athletes
CREATE POLICY "Coaches can insert goals for assigned athletes"
  ON public.athlete_goals FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM athlete_profiles
      WHERE athlete_profiles.user_id = athlete_goals.athlete_id
        AND athlete_profiles.coach_id = auth.uid()
    )
  );

-- Coaches can update assigned athlete goals
CREATE POLICY "Coaches can update assigned athlete goals"
  ON public.athlete_goals FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM athlete_profiles
    WHERE athlete_profiles.user_id = athlete_goals.athlete_id
      AND athlete_profiles.coach_id = auth.uid()
  ));

-- Timestamp trigger
CREATE TRIGGER update_athlete_goals_updated_at
  BEFORE UPDATE ON public.athlete_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_athlete_goals_athlete_status ON public.athlete_goals(athlete_id, status);
