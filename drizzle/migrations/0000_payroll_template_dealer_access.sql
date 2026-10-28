ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS days_worked numeric NOT NULL DEFAULT 31;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS other_deductions numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE POLICY "Dealers can insert own branch payroll" ON public.payroll FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = payroll.employee_id AND public.is_dealer_for_branch(auth.uid(), e.branch_id)));
CREATE POLICY "Dealers can update own branch payroll" ON public.payroll FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = payroll.employee_id AND public.is_dealer_for_branch(auth.uid(), e.branch_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = payroll.employee_id AND public.is_dealer_for_branch(auth.uid(), e.branch_id)));

CREATE POLICY "Authenticated can view payroll template" ON public.system_settings FOR SELECT TO authenticated
USING (key = 'payroll_template');

CREATE UNIQUE INDEX IF NOT EXISTS payroll_employee_month_year_key ON public.payroll (employee_id, month, year);