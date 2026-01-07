-- =============================================
-- FORECOURT MANAGEMENT SYSTEM DATABASE SCHEMA
-- =============================================

-- 1. Create app_role enum for role-based access
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'cashier', 'attendant');

-- 2. Create franchise_type enum
CREATE TYPE public.franchise_type AS ENUM ('Financial Dealer', 'Young Dealer', 'COCO Dealer');

-- 3. Create product_type enum
CREATE TYPE public.product_type AS ENUM ('PMS', 'AGO');

-- 4. Create tank_status enum
CREATE TYPE public.tank_status AS ENUM ('Full', 'Medium', 'Low', 'Critical');

-- 5. Create shift_name enum
CREATE TYPE public.shift_name AS ENUM ('Morning', 'Afternoon', 'Night');

-- =============================================
-- USER MANAGEMENT TABLES
-- =============================================

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'attendant',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- CORE BUSINESS TABLES
-- =============================================

-- Branches (Stations)
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    county TEXT NOT NULL,
    location TEXT,
    franchise_type franchise_type NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Shifts definition
CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name shift_name NOT NULL UNIQUE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Islands (pump islands within a station)
CREATE TABLE public.islands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    island_number INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (branch_id, island_number)
);

-- Tanks
CREATE TABLE public.tanks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    product_type product_type NOT NULL,
    capacity_usg DECIMAL(12, 2) NOT NULL,
    current_level_usg DECIMAL(12, 2) NOT NULL DEFAULT 0,
    threshold_usg DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status tank_status NOT NULL DEFAULT 'Medium',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (branch_id, name)
);

-- Pumps
CREATE TABLE public.pumps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    island_id UUID REFERENCES public.islands(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    product_type product_type NOT NULL,
    totalizers_count INTEGER NOT NULL DEFAULT 1 CHECK (totalizers_count >= 1 AND totalizers_count <= 4),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (branch_id, name)
);

-- Tank-Pump assignments (many-to-many)
CREATE TABLE public.tank_pump_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id UUID REFERENCES public.tanks(id) ON DELETE CASCADE NOT NULL,
    pump_id UUID REFERENCES public.pumps(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (tank_id, pump_id)
);

-- Attendants
CREATE TABLE public.attendants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    employee_id TEXT,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Attendant shift assignments
CREATE TABLE public.attendant_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendant_id UUID REFERENCES public.attendants(id) ON DELETE CASCADE NOT NULL,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE NOT NULL,
    pump_id UUID REFERENCES public.pumps(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (attendant_id, shift_id, date)
);

-- =============================================
-- INSERT DEFAULT SHIFTS
-- =============================================

INSERT INTO public.shifts (name, start_time, end_time) VALUES
    ('Morning', '06:00:00', '14:00:00'),
    ('Afternoon', '14:00:00', '22:00:00'),
    ('Night', '22:00:00', '06:00:00');

-- =============================================
-- SECURITY DEFINER FUNCTIONS FOR RLS
-- =============================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Function to check if user is admin or supervisor
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role IN ('admin', 'supervisor')
    )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1
$$;

-- Function to get user's branch (for attendants/cashiers)
CREATE OR REPLACE FUNCTION public.get_user_branch(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT branch_id
    FROM public.attendants
    WHERE user_id = _user_id
    LIMIT 1
$$;

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.islands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tank_pump_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendant_assignments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - USER_ROLES
-- =============================================

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - PROFILES
-- =============================================

-- Users can view all profiles (for display purposes)
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- RLS POLICIES - BRANCHES
-- =============================================

-- All authenticated users can view branches
CREATE POLICY "Authenticated users can view branches"
ON public.branches FOR SELECT
TO authenticated
USING (true);

-- Admins can manage branches
CREATE POLICY "Admins can insert branches"
ON public.branches FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update branches"
ON public.branches FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete branches"
ON public.branches FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - SHIFTS
-- =============================================

-- All authenticated users can view shifts
CREATE POLICY "Authenticated users can view shifts"
ON public.shifts FOR SELECT
TO authenticated
USING (true);

-- =============================================
-- RLS POLICIES - ISLANDS
-- =============================================

-- All authenticated users can view islands
CREATE POLICY "Authenticated users can view islands"
ON public.islands FOR SELECT
TO authenticated
USING (true);

-- Admins and supervisors can manage islands
CREATE POLICY "Admins/supervisors can insert islands"
ON public.islands FOR INSERT
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can update islands"
ON public.islands FOR UPDATE
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can delete islands"
ON public.islands FOR DELETE
USING (public.is_admin_or_supervisor(auth.uid()));

-- =============================================
-- RLS POLICIES - TANKS
-- =============================================

-- All authenticated users can view tanks
CREATE POLICY "Authenticated users can view tanks"
ON public.tanks FOR SELECT
TO authenticated
USING (true);

-- Admins and supervisors can manage tanks
CREATE POLICY "Admins/supervisors can insert tanks"
ON public.tanks FOR INSERT
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can update tanks"
ON public.tanks FOR UPDATE
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can delete tanks"
ON public.tanks FOR DELETE
USING (public.is_admin_or_supervisor(auth.uid()));

-- =============================================
-- RLS POLICIES - PUMPS
-- =============================================

-- All authenticated users can view pumps
CREATE POLICY "Authenticated users can view pumps"
ON public.pumps FOR SELECT
TO authenticated
USING (true);

-- Admins and supervisors can manage pumps
CREATE POLICY "Admins/supervisors can insert pumps"
ON public.pumps FOR INSERT
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can update pumps"
ON public.pumps FOR UPDATE
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can delete pumps"
ON public.pumps FOR DELETE
USING (public.is_admin_or_supervisor(auth.uid()));

-- =============================================
-- RLS POLICIES - TANK_PUMP_ASSIGNMENTS
-- =============================================

-- All authenticated users can view assignments
CREATE POLICY "Authenticated users can view tank_pump_assignments"
ON public.tank_pump_assignments FOR SELECT
TO authenticated
USING (true);

-- Admins and supervisors can manage assignments
CREATE POLICY "Admins/supervisors can insert tank_pump_assignments"
ON public.tank_pump_assignments FOR INSERT
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can delete tank_pump_assignments"
ON public.tank_pump_assignments FOR DELETE
USING (public.is_admin_or_supervisor(auth.uid()));

-- =============================================
-- RLS POLICIES - ATTENDANTS
-- =============================================

-- Admins and supervisors can view all attendants
CREATE POLICY "Admins/supervisors can view all attendants"
ON public.attendants FOR SELECT
USING (public.is_admin_or_supervisor(auth.uid()));

-- Attendants can view themselves
CREATE POLICY "Attendants can view themselves"
ON public.attendants FOR SELECT
USING (user_id = auth.uid());

-- Cashiers can view attendants in their branch
CREATE POLICY "Cashiers can view branch attendants"
ON public.attendants FOR SELECT
USING (
    public.has_role(auth.uid(), 'cashier') 
    AND branch_id = public.get_user_branch(auth.uid())
);

-- Admins and supervisors can manage attendants
CREATE POLICY "Admins/supervisors can insert attendants"
ON public.attendants FOR INSERT
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can update attendants"
ON public.attendants FOR UPDATE
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can delete attendants"
ON public.attendants FOR DELETE
USING (public.is_admin_or_supervisor(auth.uid()));

-- =============================================
-- RLS POLICIES - ATTENDANT_ASSIGNMENTS
-- =============================================

-- Admins and supervisors can view all assignments
CREATE POLICY "Admins/supervisors can view all assignments"
ON public.attendant_assignments FOR SELECT
USING (public.is_admin_or_supervisor(auth.uid()));

-- Admins and supervisors can manage assignments
CREATE POLICY "Admins/supervisors can insert assignments"
ON public.attendant_assignments FOR INSERT
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can update assignments"
ON public.attendant_assignments FOR UPDATE
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins/supervisors can delete assignments"
ON public.attendant_assignments FOR DELETE
USING (public.is_admin_or_supervisor(auth.uid()));

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branches_updated_at
    BEFORE UPDATE ON public.branches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tanks_updated_at
    BEFORE UPDATE ON public.tanks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pumps_updated_at
    BEFORE UPDATE ON public.pumps
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendants_updated_at
    BEFORE UPDATE ON public.attendants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TRIGGER TO CREATE PROFILE ON USER SIGNUP
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();