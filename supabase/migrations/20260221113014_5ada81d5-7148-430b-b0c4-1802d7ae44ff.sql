
-- =============================================
-- AGENTIC SYSTEM UPGRADE MIGRATION
-- =============================================

-- 1. agent_runs: logs every autonomous agent execution
CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  athletes_processed integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  trigger_type text NOT NULL DEFAULT 'manual',
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

-- Coaches can view agent runs
CREATE POLICY "Coaches can view agent runs"
  ON public.agent_runs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'coach'
  ));

-- Athletes can view agent runs (read-only)
CREATE POLICY "Athletes can view agent runs"
  ON public.agent_runs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'athlete'
  ));

-- Service role (edge function) inserts/updates via service_role key, no policy needed for that

-- 2. agent_actions: individual actions per agent run
CREATE TABLE public.agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL,
  action_type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view own agent actions"
  ON public.agent_actions FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "Coaches can view assigned athlete actions"
  ON public.agent_actions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.athlete_profiles
    WHERE athlete_profiles.user_id = agent_actions.athlete_id
      AND athlete_profiles.coach_id = auth.uid()
  ));

-- 3. risk_predictions: structured prediction outputs
CREATE TABLE public.risk_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  risk_prob numeric NOT NULL DEFAULT 0,
  risk_score numeric NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'Low',
  top_drivers jsonb DEFAULT '[]'::jsonb,
  model_version text,
  trained_at timestamptz,
  predictor_type text NOT NULL DEFAULT 'rules',
  confidence numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.risk_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view own predictions"
  ON public.risk_predictions FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "Coaches can view assigned athlete predictions"
  ON public.risk_predictions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.athlete_profiles
    WHERE athlete_profiles.user_id = risk_predictions.athlete_id
      AND athlete_profiles.coach_id = auth.uid()
  ));

-- 4. escalations: automatic escalation events
CREATE TABLE public.escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  risk_prediction_id uuid REFERENCES public.risk_predictions(id) ON DELETE SET NULL,
  trigger_reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_by uuid,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view own escalations"
  ON public.escalations FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "Coaches can view assigned athlete escalations"
  ON public.escalations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.athlete_profiles
    WHERE athlete_profiles.user_id = escalations.athlete_id
      AND athlete_profiles.coach_id = auth.uid()
  ));

CREATE POLICY "Coaches can update assigned athlete escalations"
  ON public.escalations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.athlete_profiles
    WHERE athlete_profiles.user_id = escalations.athlete_id
      AND athlete_profiles.coach_id = auth.uid()
  ));

-- 5. feedback_events: athlete/coach feedback on plan changes
CREATE TABLE public.feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  weekly_plan_id uuid REFERENCES public.weekly_plans(id) ON DELETE SET NULL,
  risk_prediction_id uuid REFERENCES public.risk_predictions(id) ON DELETE SET NULL,
  feedback_type text NOT NULL,
  reason text,
  modified_plan jsonb,
  given_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can insert own feedback"
  ON public.feedback_events FOR INSERT
  WITH CHECK (auth.uid() = given_by AND auth.uid() = athlete_id);

CREATE POLICY "Athletes can view own feedback"
  ON public.feedback_events FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "Coaches can insert feedback for assigned athletes"
  ON public.feedback_events FOR INSERT
  WITH CHECK (
    auth.uid() = given_by
    AND EXISTS (
      SELECT 1 FROM public.athlete_profiles
      WHERE athlete_profiles.user_id = feedback_events.athlete_id
        AND athlete_profiles.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can view assigned athlete feedback"
  ON public.feedback_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.athlete_profiles
    WHERE athlete_profiles.user_id = feedback_events.athlete_id
      AND athlete_profiles.coach_id = auth.uid()
  ));

-- 6. model_registry: tracks active model versions
CREATE TABLE public.model_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  predictor_type text NOT NULL DEFAULT 'rules',
  accuracy numeric,
  notes text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.model_registry ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read model registry
CREATE POLICY "Authenticated users can view model registry"
  ON public.model_registry FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 7. Add columns to existing tables
ALTER TABLE public.risk_reports ADD COLUMN IF NOT EXISTS agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL;
ALTER TABLE public.risk_reports ADD COLUMN IF NOT EXISTS risk_prediction_id uuid REFERENCES public.risk_predictions(id) ON DELETE SET NULL;
ALTER TABLE public.weekly_plans ADD COLUMN IF NOT EXISTS agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL;

-- 8. Seed initial model_registry entry for rules-based predictor
INSERT INTO public.model_registry (version, predictor_type, accuracy, notes, is_active)
VALUES ('rules-v1.0', 'rules', NULL, 'Initial rules-based predictor using riskEngine.ts logic', true);
