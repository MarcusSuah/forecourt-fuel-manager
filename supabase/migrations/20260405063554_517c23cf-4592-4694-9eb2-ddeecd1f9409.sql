
-- 1. Function to bootstrap first admin (when no admins exist)
CREATE OR REPLACE FUNCTION public.bootstrap_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow if no admins exist yet
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- 2. Add unique constraint on user_roles(user_id, role) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

-- 3. Create fuel_deliveries table
CREATE TABLE public.fuel_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  tank_id uuid NOT NULL REFERENCES public.tanks(id),
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  quantity_usg numeric NOT NULL DEFAULT 0,
  supplier text,
  driver_name text,
  vehicle_plate text,
  receipt_number text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS policies for fuel_deliveries
CREATE POLICY "Authenticated users can view deliveries"
  ON public.fuel_deliveries FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins/supervisors can insert deliveries"
  ON public.fuel_deliveries FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can update deliveries"
  ON public.fuel_deliveries FOR UPDATE TO authenticated
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins can delete deliveries"
  ON public.fuel_deliveries FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Trigger to auto-update tank level on delivery insert
CREATE OR REPLACE FUNCTION public.update_tank_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tanks
  SET current_level_usg = LEAST(current_level_usg + NEW.quantity_usg, capacity_usg),
      updated_at = now()
  WHERE id = NEW.tank_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_tank_on_delivery
  AFTER INSERT ON public.fuel_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tank_on_delivery();

-- updated_at trigger for fuel_deliveries
CREATE TRIGGER update_fuel_deliveries_updated_at
  BEFORE UPDATE ON public.fuel_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
