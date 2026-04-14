
-- Permissions table
CREATE TABLE public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  module TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert permissions" ON public.permissions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update permissions" ON public.permissions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete permissions" ON public.permissions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Role-Permission assignments
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert role_permissions" ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update role_permissions" ON public.role_permissions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete role_permissions" ON public.role_permissions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Seed default permissions for all modules
INSERT INTO public.permissions (name, description, module) VALUES
  ('dashboard.view', 'View dashboard', 'Dashboard'),
  ('branches.view', 'View branches', 'Branches'),
  ('branches.manage', 'Create/edit/delete branches', 'Branches'),
  ('tanks.view', 'View tanks', 'Tank Management'),
  ('tanks.manage', 'Create/edit/delete tanks', 'Tank Management'),
  ('sales.view', 'View sales entries', 'Sales Entry'),
  ('sales.manage', 'Create/edit sales entries', 'Sales Entry'),
  ('cash.view', 'View cash reports', 'Cash Reports'),
  ('cash.manage', 'Create/edit cash deposits', 'Cash Reports'),
  ('stock.view', 'View stock control', 'Stock Control'),
  ('stock.manage', 'Create/edit stock readings', 'Stock Control'),
  ('deliveries.view', 'View deliveries', 'Deliveries'),
  ('deliveries.manage', 'Create/edit deliveries', 'Deliveries'),
  ('employees.view', 'View employees', 'Employees'),
  ('employees.manage', 'Create/edit/delete employees', 'Employees'),
  ('hrm.view', 'View HRM', 'HRM'),
  ('hrm.manage', 'Manage leave and bonuses', 'HRM'),
  ('payroll.view', 'View payroll', 'Payroll'),
  ('payroll.manage', 'Generate/edit payroll', 'Payroll'),
  ('profit_loss.view', 'View P&L', 'Profit & Loss'),
  ('profit_loss.manage', 'Create/edit P&L entries', 'Profit & Loss'),
  ('financial.view', 'View financial situation', 'Financial'),
  ('financial.manage', 'Create/edit assets/liabilities', 'Financial'),
  ('reports.view', 'View reports', 'Reports'),
  ('attendants.view', 'View attendants', 'Attendants'),
  ('attendants.manage', 'Create/edit attendants', 'Attendants'),
  ('analytics.view', 'View analytics', 'Analytics'),
  ('admin.view', 'View admin panel', 'Admin'),
  ('admin.manage', 'Manage users and roles', 'Admin'),
  ('chat.view', 'View chat', 'Chat'),
  ('chat.manage', 'Create chat rooms', 'Chat'),
  ('settings.view', 'View settings', 'Settings'),
  ('settings.manage', 'Edit settings', 'Settings'),
  ('dipping.view', 'View tank dipping', 'Tank Dipping'),
  ('dipping.manage', 'Record tank dips', 'Tank Dipping'),
  ('meter_reading.view', 'View meter readings', 'Meter Reading'),
  ('meter_reading.manage', 'Record meter readings', 'Meter Reading'),
  ('shift_report.view', 'View shift stock report', 'Shift Stock Report');

-- Assign all permissions to admin role
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions;

-- Assign view + manage permissions to dealer
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'dealer', id FROM public.permissions WHERE name NOT LIKE 'admin.%' AND name NOT LIKE 'branches.manage';

-- Assign view + limited manage to supervisor
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'supervisor', id FROM public.permissions WHERE name NOT LIKE 'admin.manage';

-- Assign view-only to cashier
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'cashier', id FROM public.permissions WHERE name LIKE '%.view' OR name IN ('cash.manage', 'sales.manage');

-- Assign minimal to attendant
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'attendant', id FROM public.permissions WHERE name IN ('dashboard.view', 'sales.view', 'sales.manage', 'dipping.view', 'dipping.manage', 'meter_reading.view', 'meter_reading.manage');
