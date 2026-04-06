
-- Employees table
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  position text NOT NULL,
  date_of_birth date,
  employment_date date NOT NULL DEFAULT CURRENT_DATE,
  gender text,
  gross_salary numeric NOT NULL DEFAULT 0,
  social_security_number text UNIQUE,
  photo_url text,
  branch_id uuid REFERENCES public.branches(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/supervisors can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins/supervisors can update employees" ON public.employees FOR UPDATE TO authenticated USING (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can delete employees" ON public.employees FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Payroll table
CREATE TABLE public.payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  gross_salary numeric NOT NULL DEFAULT 0,
  bonuses numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month, year)
);
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view payroll" ON public.payroll FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert payroll" ON public.payroll FOR INSERT TO authenticated WITH CHECK (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can update payroll" ON public.payroll FOR UPDATE TO authenticated USING (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can delete payroll" ON public.payroll FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Leave requests table
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view leave" ON public.leave_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert leave" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can update leave" ON public.leave_requests FOR UPDATE TO authenticated USING (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can delete leave" ON public.leave_requests FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Bonuses table
CREATE TABLE public.bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view bonuses" ON public.bonuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert bonuses" ON public.bonuses FOR INSERT TO authenticated WITH CHECK (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can update bonuses" ON public.bonuses FOR UPDATE TO authenticated USING (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can delete bonuses" ON public.bonuses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- P&L entries table
CREATE TABLE public.pl_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  branch_id uuid REFERENCES public.branches(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pl_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view pl_entries" ON public.pl_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert pl_entries" ON public.pl_entries FOR INSERT TO authenticated WITH CHECK (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can update pl_entries" ON public.pl_entries FOR UPDATE TO authenticated USING (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can delete pl_entries" ON public.pl_entries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Financial assets table
CREATE TABLE public.financial_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  branch_id uuid REFERENCES public.branches(id),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view assets" ON public.financial_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert assets" ON public.financial_assets FOR INSERT TO authenticated WITH CHECK (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can update assets" ON public.financial_assets FOR UPDATE TO authenticated USING (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can delete assets" ON public.financial_assets FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Financial liabilities table
CREATE TABLE public.financial_liabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  branch_id uuid REFERENCES public.branches(id),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_liabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view liabilities" ON public.financial_liabilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert liabilities" ON public.financial_liabilities FOR INSERT TO authenticated WITH CHECK (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can update liabilities" ON public.financial_liabilities FOR UPDATE TO authenticated USING (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can delete liabilities" ON public.financial_liabilities FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
