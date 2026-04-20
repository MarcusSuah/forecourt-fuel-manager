-- Add IP/geo and device tracking to login_activities
ALTER TABLE public.login_activities
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS is_new_device boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_login_activities_user_fingerprint
  ON public.login_activities (user_id, device_fingerprint);

-- Failed login attempts table
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_email text,
  ip_address text,
  country text,
  city text,
  user_agent text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all failed login attempts"
  ON public.failed_login_attempts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Anyone (incl. anon) can insert — the user isn't signed in when the attempt fails
CREATE POLICY "Anyone can record failed login attempts"
  ON public.failed_login_attempts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_created
  ON public.failed_login_attempts (created_at DESC);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.failed_login_attempts;