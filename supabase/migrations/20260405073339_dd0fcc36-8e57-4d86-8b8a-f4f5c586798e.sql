
-- Create a security definer function that allows a new user to self-assign a role during signup
-- This bypasses RLS since new users won't have a role yet
CREATE OR REPLACE FUNCTION public.assign_role_on_signup(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow if user doesn't already have a role
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role);
  END IF;
END;
$$;
