-- Track per-user dismissed notifications
CREATE TABLE IF NOT EXISTS public.dismissed_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_key TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_notifications_user
  ON public.dismissed_notifications (user_id);

ALTER TABLE public.dismissed_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissed notifications"
  ON public.dismissed_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dismissed notifications"
  ON public.dismissed_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dismissed notifications"
  ON public.dismissed_notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime on key tables for live notifications
ALTER TABLE public.dismissed_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.tanks REPLICA IDENTITY FULL;
ALTER TABLE public.fuel_deliveries REPLICA IDENTITY FULL;
ALTER TABLE public.cash_deposits REPLICA IDENTITY FULL;
ALTER TABLE public.shift_sales_reports REPLICA IDENTITY FULL;
ALTER TABLE public.stock_readings REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dismissed_notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tanks; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fuel_deliveries; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_deposits; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_sales_reports; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_readings; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;