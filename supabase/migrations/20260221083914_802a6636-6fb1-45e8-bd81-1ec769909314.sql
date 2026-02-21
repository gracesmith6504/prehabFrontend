
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('athlete', 'coach');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  role app_role NOT NULL DEFAULT 'athlete',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create athlete_profiles table
CREATE TABLE public.athlete_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cycle_start_date DATE,
  cycle_length INT DEFAULT 28,
  menstruation_length INT DEFAULT 5,
  contraceptive_use BOOLEAN DEFAULT false,
  coach_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view own profile" ON public.athlete_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Athletes can insert own profile" ON public.athlete_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Athletes can update own profile" ON public.athlete_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view assigned athletes" ON public.athlete_profiles FOR SELECT USING (auth.uid() = coach_id);

-- Create training_sessions table
CREATE TABLE public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sport TEXT NOT NULL DEFAULT 'Football',
  duration INT NOT NULL DEFAULT 60,
  intensity TEXT NOT NULL DEFAULT 'Medium',
  rpe INT NOT NULL DEFAULT 5 CHECK (rpe >= 1 AND rpe <= 10),
  session_type TEXT NOT NULL DEFAULT 'Strength',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view own sessions" ON public.training_sessions FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "Athletes can insert own sessions" ON public.training_sessions FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "Athletes can update own sessions" ON public.training_sessions FOR UPDATE USING (auth.uid() = athlete_id);
CREATE POLICY "Athletes can delete own sessions" ON public.training_sessions FOR DELETE USING (auth.uid() = athlete_id);

-- Coaches can view their athletes' sessions
CREATE POLICY "Coaches can view athlete sessions" ON public.training_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.athlete_profiles WHERE athlete_profiles.user_id = training_sessions.athlete_id AND athlete_profiles.coach_id = auth.uid())
);

-- Create soreness_logs table
CREATE TABLE public.soreness_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  knee INT NOT NULL DEFAULT 0,
  hamstring INT NOT NULL DEFAULT 0,
  groin INT NOT NULL DEFAULT 0,
  calf INT NOT NULL DEFAULT 0,
  other_label TEXT,
  other_value INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.soreness_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view own soreness" ON public.soreness_logs FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "Athletes can insert own soreness" ON public.soreness_logs FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "Athletes can update own soreness" ON public.soreness_logs FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "Coaches can view athlete soreness" ON public.soreness_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.athlete_profiles WHERE athlete_profiles.user_id = soreness_logs.athlete_id AND athlete_profiles.coach_id = auth.uid())
);

-- Create weekly_plans table
CREATE TABLE public.weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  original_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  adjusted_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_score NUMERIC DEFAULT 0,
  risk_level TEXT DEFAULT 'Low',
  explanation TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view own plans" ON public.weekly_plans FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "Athletes can insert own plans" ON public.weekly_plans FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "Athletes can update own plans" ON public.weekly_plans FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "Coaches can view athlete plans" ON public.weekly_plans FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.athlete_profiles WHERE athlete_profiles.user_id = weekly_plans.athlete_id AND athlete_profiles.coach_id = auth.uid())
);

-- Create risk_reports table
CREATE TABLE public.risk_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  risk_score NUMERIC NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'Low',
  phase TEXT,
  phase_multiplier NUMERIC DEFAULT 1.0,
  acute_chronic_ratio NUMERIC DEFAULT 0,
  load_risk_multiplier NUMERIC DEFAULT 1.0,
  soreness_contribution NUMERIC DEFAULT 0,
  explanation TEXT,
  escalation_status TEXT DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view own reports" ON public.risk_reports FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "Athletes can insert own reports" ON public.risk_reports FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "Athletes can update own reports" ON public.risk_reports FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "Coaches can view athlete reports" ON public.risk_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.athlete_profiles WHERE athlete_profiles.user_id = risk_reports.athlete_id AND athlete_profiles.coach_id = auth.uid())
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (NEW.id, NEW.email, 'athlete');
  
  INSERT INTO public.athlete_profiles (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
