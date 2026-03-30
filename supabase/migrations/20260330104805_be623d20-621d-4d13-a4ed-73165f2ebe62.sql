
-- Shift Sales Reports table
CREATE TABLE public.shift_sales_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    attendant_id uuid NOT NULL REFERENCES public.attendants(id) ON DELETE CASCADE,
    island_id uuid REFERENCES public.islands(id),
    pump_id uuid NOT NULL REFERENCES public.pumps(id) ON DELETE CASCADE,
    opening_meter numeric NOT NULL DEFAULT 0,
    closing_meter numeric NOT NULL DEFAULT 0,
    rtt_usg numeric NOT NULL DEFAULT 0,
    sales_liters numeric GENERATED ALWAYS AS ((closing_meter - opening_meter - rtt_usg) * 3.78541) STORED,
    sales_usg numeric GENERATED ALWAYS AS (closing_meter - opening_meter - rtt_usg) STORED,
    unit_price_usd numeric NOT NULL DEFAULT 0,
    total_sales_usd numeric GENERATED ALWAYS AS ((closing_meter - opening_meter - rtt_usg) * unit_price_usd) STORED,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shift_sales_reports ENABLE ROW LEVEL SECURITY;

-- Updated at trigger
CREATE TRIGGER update_shift_sales_reports_updated_at
    BEFORE UPDATE ON public.shift_sales_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
CREATE POLICY "Authenticated users can view shift_sales_reports"
    ON public.shift_sales_reports FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Admins/supervisors/cashiers can insert shift_sales_reports"
    ON public.shift_sales_reports FOR INSERT TO authenticated
    WITH CHECK (
        is_admin_or_supervisor(auth.uid()) OR has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'attendant')
    );

CREATE POLICY "Admins/supervisors can update shift_sales_reports"
    ON public.shift_sales_reports FOR UPDATE TO authenticated
    USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins can delete shift_sales_reports"
    ON public.shift_sales_reports FOR DELETE TO authenticated
    USING (has_role(auth.uid(), 'admin'));
