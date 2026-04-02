
-- System settings table for key-value configuration
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read settings
CREATE POLICY "Authenticated users can view settings"
  ON public.system_settings FOR SELECT TO authenticated
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can insert settings"
  ON public.system_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings"
  ON public.system_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete settings"
  ON public.system_settings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Seed default settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('exchange_rate', '{"lrd_to_usd": 192, "last_updated": null}', 'Current LRD to USD exchange rate'),
  ('tank_thresholds', '{"critical_pct": 20, "low_pct": 30, "medium_pct": 60}', 'Tank level alert thresholds as percentages'),
  ('system_preferences', '{"company_name": "FMS", "currency_primary": "USD", "currency_secondary": "LRD", "date_format": "yyyy-MM-dd"}', 'General system preferences');

-- Enable realtime for settings changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
