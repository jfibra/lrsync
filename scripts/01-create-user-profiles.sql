-- Clean up any existing custom tables
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.user_status CASCADE;

-- Create ENUM types
CREATE TYPE public.user_role AS ENUM ('super_admin', 'admin', 'secretary');
CREATE TYPE public.user_status AS ENUM ('active', 'inactive', 'suspended');

-- Create user_profiles table that can work with or without auth.users
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE, -- Allow manual email storage
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    role public.user_role NOT NULL DEFAULT 'secretary',
    city TEXT,
    province TEXT,
    country TEXT,
    status public.user_status NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_user_profiles_auth_user_id ON public.user_profiles(auth_user_id);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_status ON public.user_profiles(status);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Allow authenticated users to read all profiles (for user management)
CREATE POLICY "Authenticated users can view all profiles" ON public.user_profiles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage profiles (for user management)
CREATE POLICY "Authenticated users can manage profiles" ON public.user_profiles
    FOR ALL USING (auth.role() = 'authenticated');

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON public.user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Success message
SELECT 'User profiles table created successfully with email field!' as status;
