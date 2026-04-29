-- Add a foreign key from reports.user_id to profiles.id so PostgREST
-- can resolve the join in a single query (reports → profiles).
-- profiles.id is already a PK and references auth.users(id), so this
-- creates a proper public-schema relationship that PostgREST can see.
ALTER TABLE public.reports
  ADD CONSTRAINT reports_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
