-- Login activities audit trail
CREATE TABLE public.login_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT,
  user_full_name TEXT,
  role TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_activities_user ON public.login_activities(user_id);
CREATE INDEX idx_login_activities_created ON public.login_activities(created_at DESC);

ALTER TABLE public.login_activities ENABLE ROW LEVEL SECURITY;

-- Admins can view all login activities
CREATE POLICY "Admins can view all login activities"
  ON public.login_activities FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Any authenticated user can insert their own login record
CREATE POLICY "Users can insert own login activity"
  ON public.login_activities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add to realtime so admins get live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.login_activities;
ALTER TABLE public.login_activities REPLICA IDENTITY FULL;