-- Add autonomy level to athlete profiles
ALTER TABLE public.athlete_profiles 
ADD COLUMN IF NOT EXISTS autonomy_level TEXT NOT NULL DEFAULT 'auto_adjust';

-- Enable extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;