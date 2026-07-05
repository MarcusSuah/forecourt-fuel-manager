
-- 1) First-login flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_credentials BOOLEAN NOT NULL DEFAULT false;

-- Allow users to update their own must_change_credentials (existing profile update policy expected). Ensure a policy exists that lets a user update their own profile.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 2) Tighten RLS: supervisors become READ-ONLY on branch-scoped tables.
-- Strategy: drop existing "Admins/supervisors ..." write policies and recreate as admin-only.

-- attendants
DROP POLICY IF EXISTS "Admins/supervisors can insert attendants" ON public.attendants;
DROP POLICY IF EXISTS "Admins/supervisors can update attendants" ON public.attendants;
DROP POLICY IF EXISTS "Admins/supervisors can delete attendants" ON public.attendants;
CREATE POLICY "Admins can insert attendants" ON public.attendants FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update attendants" ON public.attendants FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can delete attendants" ON public.attendants FOR DELETE USING (has_role(auth.uid(),'admin'::app_role));

-- bonuses
DROP POLICY IF EXISTS "Admins can insert bonuses" ON public.bonuses;
DROP POLICY IF EXISTS "Admins can update bonuses" ON public.bonuses;
CREATE POLICY "Admins can insert bonuses" ON public.bonuses FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update bonuses" ON public.bonuses FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- cash_deposits
DROP POLICY IF EXISTS "Admins/supervisors/cashiers can insert cash_deposits" ON public.cash_deposits;
DROP POLICY IF EXISTS "Admins/supervisors can update cash_deposits" ON public.cash_deposits;
CREATE POLICY "Admins/cashiers can insert cash_deposits" ON public.cash_deposits FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'cashier'::app_role));
CREATE POLICY "Admins can update cash_deposits" ON public.cash_deposits FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- employees
DROP POLICY IF EXISTS "Admins/supervisors can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Admins/supervisors can update employees" ON public.employees;
CREATE POLICY "Admins can insert employees" ON public.employees FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update employees" ON public.employees FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- financial_assets
DROP POLICY IF EXISTS "Admins can insert assets" ON public.financial_assets;
DROP POLICY IF EXISTS "Admins can update assets" ON public.financial_assets;
DROP POLICY IF EXISTS "Assets visible to admin/supervisor" ON public.financial_assets;
CREATE POLICY "Assets visible to admin/supervisor" ON public.financial_assets FOR SELECT USING (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can insert assets" ON public.financial_assets FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update assets" ON public.financial_assets FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- financial_liabilities
DROP POLICY IF EXISTS "Admins can insert liabilities" ON public.financial_liabilities;
DROP POLICY IF EXISTS "Admins can update liabilities" ON public.financial_liabilities;
CREATE POLICY "Admins can insert liabilities" ON public.financial_liabilities FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update liabilities" ON public.financial_liabilities FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- fuel_deliveries
DROP POLICY IF EXISTS "Admins/supervisors can insert deliveries" ON public.fuel_deliveries;
DROP POLICY IF EXISTS "Admins/supervisors can update deliveries" ON public.fuel_deliveries;
CREATE POLICY "Admins can insert deliveries" ON public.fuel_deliveries FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update deliveries" ON public.fuel_deliveries FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- islands
DROP POLICY IF EXISTS "Admins/supervisors can insert islands" ON public.islands;
DROP POLICY IF EXISTS "Admins/supervisors can update islands" ON public.islands;
DROP POLICY IF EXISTS "Admins/supervisors can delete islands" ON public.islands;
CREATE POLICY "Admins can insert islands" ON public.islands FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update islands" ON public.islands FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can delete islands" ON public.islands FOR DELETE USING (has_role(auth.uid(),'admin'::app_role));

-- leave_requests
DROP POLICY IF EXISTS "Admins can insert leave" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can update leave" ON public.leave_requests;
CREATE POLICY "Admins can insert leave" ON public.leave_requests FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update leave" ON public.leave_requests FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- payroll
DROP POLICY IF EXISTS "Admins can insert payroll" ON public.payroll;
DROP POLICY IF EXISTS "Admins can update payroll" ON public.payroll;
CREATE POLICY "Admins can insert payroll" ON public.payroll FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update payroll" ON public.payroll FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- pl_entries
DROP POLICY IF EXISTS "Admins can insert pl_entries" ON public.pl_entries;
DROP POLICY IF EXISTS "Admins can update pl_entries" ON public.pl_entries;
CREATE POLICY "Admins can insert pl_entries" ON public.pl_entries FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update pl_entries" ON public.pl_entries FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- pumps
DROP POLICY IF EXISTS "Admins/supervisors can insert pumps" ON public.pumps;
DROP POLICY IF EXISTS "Admins/supervisors can update pumps" ON public.pumps;
DROP POLICY IF EXISTS "Admins/supervisors can delete pumps" ON public.pumps;
CREATE POLICY "Admins can insert pumps" ON public.pumps FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update pumps" ON public.pumps FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can delete pumps" ON public.pumps FOR DELETE USING (has_role(auth.uid(),'admin'::app_role));

-- reconciliation_alerts
DROP POLICY IF EXISTS "Authorized users can insert alerts" ON public.reconciliation_alerts;
DROP POLICY IF EXISTS "Admins and supervisors can update alerts" ON public.reconciliation_alerts;
CREATE POLICY "Authorized users can insert alerts" ON public.reconciliation_alerts FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Admins can update alerts" ON public.reconciliation_alerts FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- shift_sales_reports
DROP POLICY IF EXISTS "Admins/supervisors/cashiers can insert shift_sales_reports" ON public.shift_sales_reports;
DROP POLICY IF EXISTS "Admins/supervisors can update shift_sales_reports" ON public.shift_sales_reports;
CREATE POLICY "Admins/cashiers/attendants can insert shift_sales_reports" ON public.shift_sales_reports FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'cashier'::app_role) OR has_role(auth.uid(),'attendant'::app_role));
CREATE POLICY "Admins can update shift_sales_reports" ON public.shift_sales_reports FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- stock_readings
DROP POLICY IF EXISTS "Admins/supervisors/cashiers can insert stock_readings" ON public.stock_readings;
DROP POLICY IF EXISTS "Admins/supervisors can update stock_readings" ON public.stock_readings;
CREATE POLICY "Admins/cashiers can insert stock_readings" ON public.stock_readings FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'cashier'::app_role));
CREATE POLICY "Admins can update stock_readings" ON public.stock_readings FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- tank_pump_assignments
DROP POLICY IF EXISTS "Admins/supervisors can insert tank_pump_assignments" ON public.tank_pump_assignments;
DROP POLICY IF EXISTS "Admins/supervisors can delete tank_pump_assignments" ON public.tank_pump_assignments;
CREATE POLICY "Admins can insert tank_pump_assignments" ON public.tank_pump_assignments FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can delete tank_pump_assignments" ON public.tank_pump_assignments FOR DELETE USING (has_role(auth.uid(),'admin'::app_role));

-- tanks
DROP POLICY IF EXISTS "Admins/supervisors can insert tanks" ON public.tanks;
DROP POLICY IF EXISTS "Admins/supervisors can update tanks" ON public.tanks;
DROP POLICY IF EXISTS "Admins/supervisors can delete tanks" ON public.tanks;
CREATE POLICY "Admins can insert tanks" ON public.tanks FOR INSERT WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update tanks" ON public.tanks FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can delete tanks" ON public.tanks FOR DELETE USING (has_role(auth.uid(),'admin'::app_role));
