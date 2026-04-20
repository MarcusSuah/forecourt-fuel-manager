-- Add resolution tracking to reconciliation_alerts
ALTER TABLE public.reconciliation_alerts
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolution_notes text;

-- Allow admins and supervisors to update alerts (for resolving)
DROP POLICY IF EXISTS "Admins can update alerts" ON public.reconciliation_alerts;
CREATE POLICY "Admins and supervisors can update alerts"
  ON public.reconciliation_alerts
  FOR UPDATE
  TO authenticated
  USING (is_admin_or_supervisor(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_reconciliation_alerts_resolved_at
  ON public.reconciliation_alerts(resolved_at);
CREATE INDEX IF NOT EXISTS idx_reconciliation_alerts_branch_created
  ON public.reconciliation_alerts(branch_id, created_at DESC);