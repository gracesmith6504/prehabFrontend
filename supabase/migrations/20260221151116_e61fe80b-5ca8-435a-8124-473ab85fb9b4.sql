
-- Create coach_plan_templates table
CREATE TABLE public.coach_plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  name text NOT NULL,
  sessions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own templates"
  ON public.coach_plan_templates FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can insert own templates"
  ON public.coach_plan_templates FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can update own templates"
  ON public.coach_plan_templates FOR UPDATE
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can delete own templates"
  ON public.coach_plan_templates FOR DELETE
  USING (auth.uid() = coach_id);

-- Add plan_owner_type to weekly_plans
ALTER TABLE public.weekly_plans
  ADD COLUMN IF NOT EXISTS plan_owner_type text NOT NULL DEFAULT 'athlete';

-- Allow coaches to insert plans for assigned athletes
CREATE POLICY "Coaches can insert plans for assigned athletes"
  ON public.weekly_plans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM athlete_profiles
      WHERE athlete_profiles.user_id = weekly_plans.athlete_id
        AND athlete_profiles.coach_id = auth.uid()
    )
  );
