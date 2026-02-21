CREATE POLICY "Athletes can delete own soreness"
ON public.soreness_logs
FOR DELETE
USING (auth.uid() = athlete_id);