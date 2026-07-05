
ALTER TABLE public.attendants ALTER COLUMN branch_id DROP NOT NULL;

-- Enforce one attendant row per user (needed for upsert on user_id)
CREATE UNIQUE INDEX IF NOT EXISTS attendants_user_id_key
  ON public.attendants(user_id) WHERE user_id IS NOT NULL;
