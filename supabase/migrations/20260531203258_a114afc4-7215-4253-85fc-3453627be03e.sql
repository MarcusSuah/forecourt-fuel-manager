
-- 1. Restrict employees SELECT to admins/supervisors and branch dealers
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;
CREATE POLICY "Admins/supervisors can view employees"
  ON public.employees FOR SELECT TO authenticated
  USING (
    public.is_admin_or_supervisor(auth.uid())
    OR public.is_dealer_for_branch(auth.uid(), branch_id)
  );

-- 2. Restrict profiles SELECT to self + admins/supervisors
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Users view own profile or admins view all"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin_or_supervisor(auth.uid())
  );

-- 3. Restrict chat_messages SELECT to room's branch members (or admin/supervisor)
DROP POLICY IF EXISTS "Authenticated users can view non-deleted messages" ON public.chat_messages;
CREATE POLICY "Branch members view chat messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    is_deleted = false AND (
      public.is_admin_or_supervisor(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.chat_rooms cr
        WHERE cr.id = chat_messages.room_id
          AND (cr.branch_id IS NULL OR cr.branch_id = public.get_user_branch(auth.uid()))
      )
    )
  );

-- 4. Harden assign_role_on_signup: only self, only non-privileged roles
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
  IF _role NOT IN ('attendant', 'cashier') THEN
    RAISE EXCEPTION 'Role not self-assignable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
  END IF;
END;
$$;

-- 5. Make employee-photos bucket private and restrict reads to authenticated users
UPDATE storage.buckets SET public = false WHERE id = 'employee-photos';

DROP POLICY IF EXISTS "Anyone can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Employee photos are publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated can view employee photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'employee-photos');
