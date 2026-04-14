
CREATE POLICY "Dealers can insert own branch assignments"
ON public.attendant_assignments FOR INSERT TO authenticated
WITH CHECK (
  is_dealer_for_branch(auth.uid(), (SELECT branch_id FROM public.attendants WHERE id = attendant_id))
);

CREATE POLICY "Dealers can view own branch assignments"
ON public.attendant_assignments FOR SELECT TO authenticated
USING (
  is_dealer_for_branch(auth.uid(), (SELECT branch_id FROM public.attendants WHERE id = attendant_id))
);
