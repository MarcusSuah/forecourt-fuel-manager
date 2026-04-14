
-- Create function to check if user is dealer with branch access
CREATE OR REPLACE FUNCTION public.is_dealer_for_branch(_user_id UUID, _branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.attendants a ON a.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'dealer'
      AND a.branch_id = _branch_id
  )
$$;

-- Dealer policies for various tables
CREATE POLICY "Dealers can view own branch tanks" ON public.tanks FOR SELECT TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can insert own branch tanks" ON public.tanks FOR INSERT TO authenticated WITH CHECK (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can update own branch tanks" ON public.tanks FOR UPDATE TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));

CREATE POLICY "Dealers can view own branch attendants" ON public.attendants FOR SELECT TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can insert own branch attendants" ON public.attendants FOR INSERT TO authenticated WITH CHECK (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can update own branch attendants" ON public.attendants FOR UPDATE TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));

CREATE POLICY "Dealers can view own branch sales" ON public.shift_sales_reports FOR SELECT TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can insert own branch sales" ON public.shift_sales_reports FOR INSERT TO authenticated WITH CHECK (is_dealer_for_branch(auth.uid(), branch_id));

CREATE POLICY "Dealers can view own branch cash" ON public.cash_deposits FOR SELECT TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can insert own branch cash" ON public.cash_deposits FOR INSERT TO authenticated WITH CHECK (is_dealer_for_branch(auth.uid(), branch_id));

CREATE POLICY "Dealers can view own branch deliveries" ON public.fuel_deliveries FOR SELECT TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can insert own branch deliveries" ON public.fuel_deliveries FOR INSERT TO authenticated WITH CHECK (is_dealer_for_branch(auth.uid(), branch_id));

CREATE POLICY "Dealers can view own branch stock" ON public.stock_readings FOR SELECT TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can insert own branch stock" ON public.stock_readings FOR INSERT TO authenticated WITH CHECK (is_dealer_for_branch(auth.uid(), branch_id));

CREATE POLICY "Dealers can view own branch islands" ON public.islands FOR SELECT TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can insert own branch islands" ON public.islands FOR INSERT TO authenticated WITH CHECK (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can update own branch islands" ON public.islands FOR UPDATE TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));

CREATE POLICY "Dealers can view own branch pumps" ON public.pumps FOR SELECT TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can insert own branch pumps" ON public.pumps FOR INSERT TO authenticated WITH CHECK (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can update own branch pumps" ON public.pumps FOR UPDATE TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));

CREATE POLICY "Dealers can view own branch employees" ON public.employees FOR SELECT TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can insert own branch employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (is_dealer_for_branch(auth.uid(), branch_id));
CREATE POLICY "Dealers can update own branch employees" ON public.employees FOR UPDATE TO authenticated USING (is_dealer_for_branch(auth.uid(), branch_id));
