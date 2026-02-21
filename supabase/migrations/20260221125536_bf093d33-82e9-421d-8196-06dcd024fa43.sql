
-- Coach override events table
CREATE TABLE public.coach_override_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  athlete_id UUID NOT NULL,
  weekly_plan_id UUID REFERENCES public.weekly_plans(id),
  override_type TEXT NOT NULL, -- 'accept_ai', 'modify_session', 'revert_original', 'lock_week'
  session_day TEXT, -- which day was modified (nullable for non-session overrides)
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_override_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can insert own overrides"
ON public.coach_override_events FOR INSERT
WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can view own overrides"
ON public.coach_override_events FOR SELECT
USING (auth.uid() = coach_id);

-- Add locked_by_coach column to weekly_plans
ALTER TABLE public.weekly_plans ADD COLUMN IF NOT EXISTS locked_by_coach BOOLEAN DEFAULT false;
ALTER TABLE public.weekly_plans ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.weekly_plans ADD COLUMN IF NOT EXISTS locked_by UUID;

-- Allow coaches to update plans for their assigned athletes
CREATE POLICY "Coaches can update assigned athlete plans"
ON public.weekly_plans FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM athlete_profiles
  WHERE athlete_profiles.user_id = weekly_plans.athlete_id
  AND athlete_profiles.coach_id = auth.uid()
));
