-- Update existing shift times
UPDATE public.shifts SET start_time = '06:00:00', end_time = '13:59:00' WHERE name = 'Morning';
UPDATE public.shifts SET start_time = '14:00:00', end_time = '21:59:00' WHERE name = 'Afternoon';
UPDATE public.shifts SET start_time = '22:00:00', end_time = '23:55:00' WHERE name = 'Night';

-- Insert 'All Day' shift if not exists
INSERT INTO public.shifts (name, start_time, end_time)
SELECT 'All Day', '06:00:00', '23:59:00'
WHERE NOT EXISTS (SELECT 1 FROM public.shifts WHERE name = 'All Day');