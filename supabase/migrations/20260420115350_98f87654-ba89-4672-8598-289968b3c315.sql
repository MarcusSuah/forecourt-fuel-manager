-- Add unique constraint to support upsert on tank dipping
ALTER TABLE public.stock_readings
ADD CONSTRAINT stock_readings_branch_tank_shift_date_unique
UNIQUE (branch_id, tank_id, shift_id, date);

-- Allow dealers to update their own branch's stock readings (needed for upsert)
CREATE POLICY "Dealers can update own branch stock"
ON public.stock_readings
FOR UPDATE TO authenticated
USING (is_dealer_for_branch(auth.uid(), branch_id))
WITH CHECK (is_dealer_for_branch(auth.uid(), branch_id));

-- Allow cashiers to update branch stock readings (needed for upsert)
CREATE POLICY "Cashiers can update branch stock"
ON public.stock_readings
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cashier'::app_role) AND branch_id = get_user_branch(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'cashier'::app_role) AND branch_id = get_user_branch(auth.uid()));