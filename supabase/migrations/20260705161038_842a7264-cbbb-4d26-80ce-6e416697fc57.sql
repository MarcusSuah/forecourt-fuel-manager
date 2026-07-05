
-- system_settings: replace open SELECT with admin/supervisor-only read
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.system_settings;
CREATE POLICY "Admins and supervisors can view settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (is_admin_or_supervisor(auth.uid()));

-- storage.objects (employee-photos bucket): restrict SELECT
DROP POLICY IF EXISTS "Authenticated can view employee photos" ON storage.objects;

-- Keep the shared logo readable to any signed-in user (used app-wide in headers/PDFs)
CREATE POLICY "Authenticated can view shared logo assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'employee-photos' AND name LIKE 'logo-%');

-- Employee photos: only admin, supervisor, or dealer roles
CREATE POLICY "Privileged users can view employee photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND (
      is_admin_or_supervisor(auth.uid())
      OR has_role(auth.uid(), 'dealer'::app_role)
    )
  );
