
-- =========================================================
-- 1. Restrict overly-permissive SELECT policies
-- =========================================================

-- bonuses (scope by employee branch)
DROP POLICY IF EXISTS "Authenticated can view bonuses" ON public.bonuses;
CREATE POLICY "Bonuses visible to admin/supervisor/branch dealer"
ON public.bonuses FOR SELECT TO authenticated
USING (
  is_admin_or_supervisor(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = bonuses.employee_id
      AND is_dealer_for_branch(auth.uid(), e.branch_id)
  )
);

-- leave_requests
DROP POLICY IF EXISTS "Authenticated can view leave" ON public.leave_requests;
CREATE POLICY "Leave visible to admin/supervisor/branch dealer"
ON public.leave_requests FOR SELECT TO authenticated
USING (
  is_admin_or_supervisor(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = leave_requests.employee_id
      AND is_dealer_for_branch(auth.uid(), e.branch_id)
  )
);

-- payroll
DROP POLICY IF EXISTS "Authenticated can view payroll" ON public.payroll;
CREATE POLICY "Payroll visible to admin/supervisor/branch dealer"
ON public.payroll FOR SELECT TO authenticated
USING (
  is_admin_or_supervisor(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = payroll.employee_id
      AND is_dealer_for_branch(auth.uid(), e.branch_id)
  )
);

-- financial_assets (admin/supervisor only)
DROP POLICY IF EXISTS "Authenticated can view assets" ON public.financial_assets;
CREATE POLICY "Assets visible to admin/supervisor"
ON public.financial_assets FOR SELECT TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- financial_liabilities (admin/supervisor only)
DROP POLICY IF EXISTS "Authenticated can view liabilities" ON public.financial_liabilities;
CREATE POLICY "Liabilities visible to admin/supervisor"
ON public.financial_liabilities FOR SELECT TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- pl_entries (admin/supervisor only)
DROP POLICY IF EXISTS "Authenticated can view pl_entries" ON public.pl_entries;
CREATE POLICY "PL entries visible to admin/supervisor"
ON public.pl_entries FOR SELECT TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- attendants: remove cashier read (exposes phone)
DROP POLICY IF EXISTS "Cashiers can view branch attendants" ON public.attendants;

-- =========================================================
-- 2. Storage policies for employee-photos
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update employee photos" ON storage.objects;

CREATE POLICY "Privileged users can upload employee photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-photos'
  AND (
    is_admin_or_supervisor(auth.uid())
    OR has_role(auth.uid(), 'dealer'::app_role)
  )
);

CREATE POLICY "Privileged users can update employee photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (
    is_admin_or_supervisor(auth.uid())
    OR has_role(auth.uid(), 'dealer'::app_role)
  )
);

-- =========================================================
-- 3. Remove sensitive tables from realtime publication
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='failed_login_attempts') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.failed_login_attempts';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='login_activities') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.login_activities';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='reconciliation_alerts') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.reconciliation_alerts';
  END IF;
END $$;

-- =========================================================
-- 4. Lock down SECURITY DEFINER functions from anon
--    Trigger-only / admin functions: revoke from authenticated too
-- =========================================================

-- Revoke broad public access on all relevant definers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_supervisor(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_dealer_for_branch(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_branch(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_role_on_signup(uuid, public.app_role) FROM PUBLIC, anon;

-- Trigger-only / admin-only functions: revoke from everyone (triggers still work as owner)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_tank_level() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_stock_reading() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_fuel_delivery() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_tank_level_from_dip() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_tank_on_delivery() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bootstrap_admin(uuid) FROM PUBLIC, anon, authenticated;
