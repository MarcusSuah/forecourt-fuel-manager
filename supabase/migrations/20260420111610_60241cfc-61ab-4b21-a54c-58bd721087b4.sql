
-- Add per-tank reconciliation threshold
ALTER TABLE public.tanks
  ADD COLUMN IF NOT EXISTS reconciliation_threshold_usg numeric NOT NULL DEFAULT 50;

-- Reconciliation alerts log
CREATE TABLE IF NOT EXISTS public.reconciliation_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tank_id uuid NOT NULL REFERENCES public.tanks(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  stock_reading_id uuid REFERENCES public.stock_readings(id) ON DELETE SET NULL,
  loss_usg numeric NOT NULL,
  threshold_usg numeric NOT NULL,
  severity text NOT NULL DEFAULT 'critical',
  notified_emails text[] DEFAULT '{}',
  notified_phones text[] DEFAULT '{}',
  notification_status text DEFAULT 'pending',
  notification_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_alerts_branch ON public.reconciliation_alerts(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recon_alerts_tank ON public.reconciliation_alerts(tank_id, created_at DESC);

ALTER TABLE public.reconciliation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and supervisors can view all alerts"
  ON public.reconciliation_alerts FOR SELECT
  TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Dealers can view their branch alerts"
  ON public.reconciliation_alerts FOR SELECT
  TO authenticated
  USING (public.is_dealer_for_branch(auth.uid(), branch_id));

CREATE POLICY "System and admins can insert alerts"
  ON public.reconciliation_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update alerts"
  ON public.reconciliation_alerts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reconciliation_alerts;
ALTER TABLE public.reconciliation_alerts REPLICA IDENTITY FULL;
