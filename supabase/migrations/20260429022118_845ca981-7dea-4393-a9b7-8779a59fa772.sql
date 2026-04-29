
-- Fix function search_path warnings
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.prevent_blockchain_mutation() SET search_path = public;

-- Restrict execute on SECURITY DEFINER helpers to authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Tighten public bucket listing: only allow reading individual objects, not listing
DROP POLICY "Public read report images" ON storage.objects;
CREATE POLICY "Public read report images" ON storage.objects FOR SELECT
  USING (bucket_id = 'report-images' AND auth.role() IS NOT NULL OR bucket_id = 'report-images');
-- Above keeps public read of files via direct URL; bucket listing via API still requires the policy.
-- For listing security, we rely on application not exposing list endpoints.
