-- Add unique constraint to enable upsert on shift sales reports per pump per shift per date per branch
ALTER TABLE public.shift_sales_reports
ADD CONSTRAINT shift_sales_reports_branch_pump_shift_date_unique
UNIQUE (branch_id, pump_id, shift_id, date);