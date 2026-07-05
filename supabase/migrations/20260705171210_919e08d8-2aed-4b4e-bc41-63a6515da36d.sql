-- ============================================================
-- Batch A: Security & correctness hardening
-- ============================================================

-- 1) Tighten assign_role_on_signup: allow ONLY 'attendant' self-assignment,
--    and only when the user has no role yet. Cashier was too permissive.
CREATE OR REPLACE FUNCTION public.assign_role_on_signup(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot assign role to another user';
  END IF;
  IF _role <> 'attendant'::app_role THEN
    RAISE EXCEPTION 'Only attendant role is self-assignable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'Role already assigned';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
END;
$$;

-- 2) Revoke EXECUTE from public/anon on SECURITY DEFINER helper functions.
--    Keep 'authenticated' so RLS policies and app code still work.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_supervisor(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_branch(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_zone(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_dealer_for_branch(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_supervisor_for_branch(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_branch(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_admin(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.assign_role_on_signup(uuid, app_role) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_supervisor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_zone(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dealer_for_branch(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_supervisor_for_branch(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_branch(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_role_on_signup(uuid, app_role) TO authenticated;

-- 3) Fix race in sync_tank_level_from_dip: lock the tank row before
--    checking latest reading, so concurrent dips can't both overwrite.
CREATE OR REPLACE FUNCTION public.sync_tank_level_from_dip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_latest BOOLEAN;
BEGIN
  -- Serialize per-tank updates
  PERFORM 1 FROM public.tanks WHERE id = NEW.tank_id FOR UPDATE;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.stock_readings sr
    WHERE sr.tank_id = NEW.tank_id
      AND sr.id <> NEW.id
      AND (sr.date > NEW.date OR (sr.date = NEW.date AND sr.created_at > NEW.created_at))
  ) INTO is_latest;

  IF is_latest THEN
    UPDATE public.tanks
    SET current_level_usg = NEW.physical_level_usg,
        updated_at = now()
    WHERE id = NEW.tank_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Server-side enforcement of must_change_credentials.
--    Seeded dealer/supervisor accounts cannot write to operational tables
--    until they update their credentials via /profile.
CREATE OR REPLACE FUNCTION public.must_change_credentials(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT must_change_credentials FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;
REVOKE EXECUTE ON FUNCTION public.must_change_credentials(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.must_change_credentials(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.block_if_credentials_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.must_change_credentials(auth.uid()) THEN
    RAISE EXCEPTION 'You must change your default email and password before making changes.'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to operational tables (skip profiles so users CAN update credentials).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'shift_sales_reports','stock_readings','fuel_deliveries','cash_deposits',
    'tanks','pumps','tank_pump_assignments','attendants','attendant_assignments',
    'employees','payroll','bonuses','leave_requests',
    'pl_entries','financial_assets','financial_liabilities','system_settings',
    'reconciliation_alerts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_block_pending_creds ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_block_pending_creds
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.block_if_credentials_pending()',
      t
    );
  END LOOP;
END $$;
