
-- Closed-loop adaptive policy state per athlete
CREATE TABLE public.athlete_agent_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id UUID NOT NULL UNIQUE,
  policy_mode TEXT NOT NULL DEFAULT 'normal',
  autonomy_override TEXT NULL,
  autonomy_override_until TIMESTAMP WITH TIME ZONE NULL,
  escalation_threshold_override TEXT NULL,
  escalation_threshold_override_until TIMESTAMP WITH TIME ZONE NULL,
  adjustment_intensity_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.athlete_agent_state ENABLE ROW LEVEL SECURITY;

-- Athletes can view their own state
CREATE POLICY "Athletes can view own agent state"
  ON public.athlete_agent_state FOR SELECT
  USING (auth.uid() = athlete_id);

-- Coaches can view assigned athletes' state
CREATE POLICY "Coaches can view assigned athlete agent state"
  ON public.athlete_agent_state FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM athlete_profiles
    WHERE athlete_profiles.user_id = athlete_agent_state.athlete_id
      AND athlete_profiles.coach_id = auth.uid()
  ));

-- Timestamp trigger
CREATE TRIGGER update_athlete_agent_state_updated_at
  BEFORE UPDATE ON public.athlete_agent_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
