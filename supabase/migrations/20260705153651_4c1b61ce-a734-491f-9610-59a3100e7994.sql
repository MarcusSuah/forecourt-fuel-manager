
-- Zone enum
DO $$ BEGIN
  CREATE TYPE public.zone_type AS ENUM ('central','north','east','west','south');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Branch zone assignment
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS zone public.zone_type;

-- Supervisor zone lives on the attendants row (which already links users to org data)
ALTER TABLE public.attendants
  ADD COLUMN IF NOT EXISTS supervisor_zone public.zone_type;

-- Helper: zone assigned to a supervisor user (null if none)
CREATE OR REPLACE FUNCTION public.get_user_zone(_user_id uuid)
RETURNS public.zone_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT supervisor_zone
  FROM public.attendants
  WHERE user_id = _user_id
    AND supervisor_zone IS NOT NULL
  LIMIT 1
$$;

-- Helper: is this user a supervisor whose zone covers a given branch?
CREATE OR REPLACE FUNCTION public.is_supervisor_for_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.attendants a ON a.user_id = ur.user_id
    JOIN public.branches b ON b.zone = a.supervisor_zone
    WHERE ur.user_id = _user_id
      AND ur.role = 'supervisor'
      AND a.supervisor_zone IS NOT NULL
      AND b.id = _branch_id
  )
$$;

-- Backfill any existing branches to a default zone so nothing is orphaned
UPDATE public.branches SET zone = 'central' WHERE zone IS NULL;
