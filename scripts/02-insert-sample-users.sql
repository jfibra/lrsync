-- This script should be run after creating auth users in Supabase Auth
-- Replace the auth_user_id values with actual UUIDs from your auth.users table

-- Sample Super Admin (update auth_user_id after creating auth user)
INSERT INTO users (
    auth_user_id,
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
    NULL, -- Replace with actual auth_user_id after creating auth user
    'superadmin@leuterio.com',
    'password123', -- In production, this should be properly hashed
    'John',
    'Doe',
    'John Doe',
    'super_admin',
    'active',
    'Manila',
    'Metro Manila',
    'Philippines'
) ON CONFLICT (email) DO NOTHING;

-- Sample Admin
INSERT INTO users (
    auth_user_id,
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
    NULL, -- Replace with actual auth_user_id after creating auth user
    'admin@leuterio.com',
    'password123',
    'Jane',
    'Smith',
    'Jane Smith',
    'admin',
    'active',
    'Cebu City',
    'Cebu',
    'Philippines'
) ON CONFLICT (email) DO NOTHING;

-- Sample Secretary
INSERT INTO users (
    auth_user_id,
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
    NULL, -- Replace with actual auth_user_id after creating auth user
    'secretary@leuterio.com',
    'password123',
    'Maria',
    'Garcia',
    'Maria Garcia',
    'secretary',
    'active',
    'Davao City',
    'Davao del Sur',
    'Philippines'
) ON CONFLICT (email) DO NOTHING;
