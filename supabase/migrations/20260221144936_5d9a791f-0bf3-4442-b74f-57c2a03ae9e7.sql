-- Allow coaches to read profiles of their assigned athletes
CREATE POLICY "Coaches can view assigned athlete profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.athlete_profiles
    WHERE athlete_profiles.user_id = profiles.user_id
      AND athlete_profiles.coach_id = auth.uid()
  )
);

-- Add follow_up_at column to escalations for physio scheduling
ALTER TABLE public.escalations
ADD COLUMN follow_up_at timestamp with time zone DEFAULT NULL;