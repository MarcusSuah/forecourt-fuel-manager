
-- Unified branch visibility check: admin OR dealer-for-branch OR supervisor-for-branch
CREATE OR REPLACE FUNCTION public.can_view_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.is_dealer_for_branch(_user_id, _branch_id)
    OR public.is_supervisor_for_branch(_user_id, _branch_id)
$$;

-- ============ BRANCHES ============
DROP POLICY IF EXISTS "Authenticated users can view branches" ON public.branches;
CREATE POLICY "Users can view branches they have access to"
  ON public.branches FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_dealer_for_branch(auth.uid(), id)
    OR (zone IS NOT NULL AND zone = public.get_user_zone(auth.uid()))
  );

-- ============ TANKS ============
DROP POLICY IF EXISTS "Authenticated users can view tanks" ON public.tanks;
DROP POLICY IF EXISTS "Dealers can view own branch tanks" ON public.tanks;
CREATE POLICY "Users can view accessible tanks"
  ON public.tanks FOR SELECT TO authenticated
  USING (public.can_view_branch(auth.uid(), branch_id));

-- ============ PUMPS ============
DROP POLICY IF EXISTS "Authenticated users can view pumps" ON public.pumps;
DROP POLICY IF EXISTS "Dealers can view own branch pumps" ON public.pumps;
CREATE POLICY "Users can view accessible pumps"
  ON public.pumps FOR SELECT TO authenticated
  USING (public.can_view_branch(auth.uid(), branch_id));

-- ============ SHIFT SALES REPORTS ============
DROP POLICY IF EXISTS "Authenticated users can view shift_sales_reports" ON public.shift_sales_reports;
DROP POLICY IF EXISTS "Dealers can view own branch sales" ON public.shift_sales_reports;
CREATE POLICY "Users can view accessible sales"
  ON public.shift_sales_reports FOR SELECT TO authenticated
  USING (public.can_view_branch(auth.uid(), branch_id));

-- ============ CASH DEPOSITS ============
DROP POLICY IF EXISTS "Authenticated users can view cash_deposits" ON public.cash_deposits;
DROP POLICY IF EXISTS "Dealers can view own branch cash" ON public.cash_deposits;
CREATE POLICY "Users can view accessible cash"
  ON public.cash_deposits FOR SELECT TO authenticated
  USING (public.can_view_branch(auth.uid(), branch_id));

-- ============ FUEL DELIVERIES ============
DROP POLICY IF EXISTS "Authenticated users can view deliveries" ON public.fuel_deliveries;
DROP POLICY IF EXISTS "Dealers can view own branch deliveries" ON public.fuel_deliveries;
CREATE POLICY "Users can view accessible deliveries"
  ON public.fuel_deliveries FOR SELECT TO authenticated
  USING (public.can_view_branch(auth.uid(), branch_id));

-- ============ STOCK READINGS ============
DROP POLICY IF EXISTS "Authenticated users can view stock_readings" ON public.stock_readings;
DROP POLICY IF EXISTS "Dealers can view own branch stock" ON public.stock_readings;
CREATE POLICY "Users can view accessible stock readings"
  ON public.stock_readings FOR SELECT TO authenticated
  USING (public.can_view_branch(auth.uid(), branch_id));

-- ============ EMPLOYEES ============
DROP POLICY IF EXISTS "Admins/supervisors can view employees" ON public.employees;
DROP POLICY IF EXISTS "Dealers can view own branch employees" ON public.employees;
CREATE POLICY "Users can view accessible employees"
  ON public.employees FOR SELECT TO authenticated
  USING (public.can_view_branch(auth.uid(), branch_id));

-- ============ PAYROLL (joins via employees.branch_id) ============
DROP POLICY IF EXISTS "Payroll visible to admin/supervisor/branch dealer" ON public.payroll;
CREATE POLICY "Users can view accessible payroll"
  ON public.payroll FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = payroll.employee_id
        AND public.can_view_branch(auth.uid(), e.branch_id)
    )
  );

-- ============ PL ENTRIES ============
DROP POLICY IF EXISTS "PL entries visible to admin/supervisor" ON public.pl_entries;
CREATE POLICY "Users can view accessible PL entries"
  ON public.pl_entries FOR SELECT TO authenticated
  USING (public.can_view_branch(auth.uid(), branch_id));

-- ============ ATTENDANTS ============
DROP POLICY IF EXISTS "Admins/supervisors can view all attendants" ON public.attendants;
DROP POLICY IF EXISTS "Dealers can view own branch attendants" ON public.attendants;
-- self-view policy remains ("Attendants can view themselves")
CREATE POLICY "Admins can view all attendants"
  ON public.attendants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Dealers/supervisors can view attendants in their branches"
  ON public.attendants FOR SELECT TO authenticated
  USING (branch_id IS NOT NULL AND public.can_view_branch(auth.uid(), branch_id));

-- ============ ISLANDS ============
DROP POLICY IF EXISTS "Authenticated users can view islands" ON public.islands;
DROP POLICY IF EXISTS "Dealers can view own branch islands" ON public.islands;
CREATE POLICY "Users can view accessible islands"
  ON public.islands FOR SELECT TO authenticated
  USING (public.can_view_branch(auth.uid(), branch_id));

-- ============ TANK-PUMP ASSIGNMENTS (no branch_id, join through tanks) ============
DROP POLICY IF EXISTS "Authenticated users can view tank_pump_assignments" ON public.tank_pump_assignments;
CREATE POLICY "Users can view accessible tank/pump links"
  ON public.tank_pump_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tanks t
      WHERE t.id = tank_pump_assignments.tank_id
        AND public.can_view_branch(auth.uid(), t.branch_id)
    )
  );

-- ============ RECONCILIATION ALERTS ============
DROP POLICY IF EXISTS "Admins and supervisors can view all alerts" ON public.reconciliation_alerts;
DROP POLICY IF EXISTS "Dealers can view their branch alerts" ON public.reconciliation_alerts;
CREATE POLICY "Users can view accessible alerts"
  ON public.reconciliation_alerts FOR SELECT TO authenticated
  USING (public.can_view_branch(auth.uid(), branch_id));
