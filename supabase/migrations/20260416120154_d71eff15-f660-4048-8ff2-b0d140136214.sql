-- Add employment_status to employees
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'active';

-- Create storage bucket for employee photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view employee photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated users can upload employee photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-photos');

CREATE POLICY "Authenticated users can update employee photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'employee-photos');

CREATE POLICY "Admins can delete employee photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-photos' AND public.has_role(auth.uid(), 'admin'::app_role));