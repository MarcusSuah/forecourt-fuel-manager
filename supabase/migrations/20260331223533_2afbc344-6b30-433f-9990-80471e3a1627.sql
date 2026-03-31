
-- Cash deposits table
CREATE TABLE public.cash_deposits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    shift_id uuid NOT NULL REFERENCES public.shifts(id),
    date date NOT NULL DEFAULT CURRENT_DATE,
    attendant_id uuid REFERENCES public.attendants(id),
    deposit_type text NOT NULL CHECK (deposit_type IN ('LRD', 'USD', 'card')),
    amount numeric NOT NULL DEFAULT 0,
    exchange_rate numeric DEFAULT 1,
    amount_usd numeric GENERATED ALWAYS AS (
        CASE WHEN deposit_type = 'LRD' THEN amount / NULLIF(exchange_rate, 0)
             ELSE amount END
    ) STORED,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_deposits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view cash_deposits" ON public.cash_deposits
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/supervisors/cashiers can insert cash_deposits" ON public.cash_deposits
    FOR INSERT TO authenticated
    WITH CHECK (is_admin_or_supervisor(auth.uid()) OR has_role(auth.uid(), 'cashier'));

CREATE POLICY "Admins/supervisors can update cash_deposits" ON public.cash_deposits
    FOR UPDATE TO authenticated USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins can delete cash_deposits" ON public.cash_deposits
    FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Stock readings table for physical stock tracking
CREATE TABLE public.stock_readings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id uuid NOT NULL REFERENCES public.tanks(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    shift_id uuid REFERENCES public.shifts(id),
    physical_level_usg numeric NOT NULL DEFAULT 0,
    theoretical_level_usg numeric NOT NULL DEFAULT 0,
    variance_usg numeric GENERATED ALWAYS AS (physical_level_usg - theoretical_level_usg) STORED,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stock_readings" ON public.stock_readings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/supervisors/cashiers can insert stock_readings" ON public.stock_readings
    FOR INSERT TO authenticated
    WITH CHECK (is_admin_or_supervisor(auth.uid()) OR has_role(auth.uid(), 'cashier'));

CREATE POLICY "Admins/supervisors can update stock_readings" ON public.stock_readings
    FOR UPDATE TO authenticated USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins can delete stock_readings" ON public.stock_readings
    FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Updated_at trigger for cash_deposits
CREATE TRIGGER update_cash_deposits_updated_at
    BEFORE UPDATE ON public.cash_deposits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
