
-- Table for athlete-added extra sessions
CREATE TABLE public.athlete_extra_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id uuid NOT NULL,
  week_start date NOT NULL,
  day text NOT NULL,
  session_type text NOT NULL DEFAULT 'Strength',
  intensity text NOT NULL DEFAULT 'Medium',
  duration integer NOT NULL DEFAULT 60,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_extra_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view own extra sessions" ON public.athlete_extra_sessions FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "Athletes can insert own extra sessions" ON public.athlete_extra_sessions FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "Athletes can update own extra sessions" ON public.athlete_extra_sessions FOR UPDATE USING (auth.uid() = athlete_id);
CREATE POLICY "Athletes can delete own extra sessions" ON public.athlete_extra_sessions FOR DELETE USING (auth.uid() = athlete_id);
CREATE POLICY "Coaches can view assigned athlete extra sessions" ON public.athlete_extra_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM athlete_profiles WHERE athlete_profiles.user_id = athlete_extra_sessions.athlete_id AND athlete_profiles.coach_id = auth.uid())
);
