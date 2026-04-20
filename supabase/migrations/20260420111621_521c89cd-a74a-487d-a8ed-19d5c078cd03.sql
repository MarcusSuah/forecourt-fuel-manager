
DROP POLICY IF EXISTS "System and admins can insert alerts" ON public.reconciliation_alerts;

CREATE POLICY "Authorized users can insert alerts"
  ON public.reconciliation_alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_supervisor(auth.uid())
    OR public.is_dealer_for_branch(auth.uid(), branch_id)
  );
