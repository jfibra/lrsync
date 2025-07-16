-- First, drop the table if it exists to start fresh
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing types if they exist
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;

-- Create ENUM types for user roles and status
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'secretary');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');

-- Create the custom users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- hashed manually
    role user_role NOT NULL DEFAULT 'secretary',
    city TEXT,
    province TEXT,
    country TEXT,
    last_login_at TIMESTAMP,
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create an index on auth_user_id for faster lookups
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);

-- Create an index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Create an index on role for filtering
CREATE INDEX idx_users_role ON users(role);

-- Create an index on status for filtering
CREATE INDEX idx_users_status ON users(status);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows authenticated users to read their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = auth_user_id);

-- Create a policy that allows service role to manage all users
CREATE POLICY "Service role can manage all users" ON users
    FOR ALL USING (auth.role() = 'service_role');

-- Insert a sample super admin user for testing
-- Note: You'll need to create the auth user first, then update this with the actual auth_user_id
INSERT INTO users (
    email,
    password,
    first_name,
    last_name,
    full_name,
    role,
    status,
    city,
    province,
    country
) VALUES (
    'admin@leuterio.com',
    'hashed_password_here', -- Replace with actual hashed password
    'Super',
    'Admin',
    'Super Admin',
    'super_admin',
    'active',
    'Manila',
    'Metro Manila',
    'Philippines'
);
