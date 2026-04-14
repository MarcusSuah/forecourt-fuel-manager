CREATE UNIQUE INDEX stock_readings_branch_tank_shift_date_idx 
ON public.stock_readings (branch_id, tank_id, shift_id, date);