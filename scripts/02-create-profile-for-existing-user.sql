-- Create user profile for existing auth user: johnryfibra2@gmail.com

-- First, let's check if the auth user exists and get their ID
DO $$
DECLARE
    auth_user_uuid UUID;
    profile_exists BOOLEAN;
BEGIN
    -- Get the auth user ID
    SELECT id INTO auth_user_uuid 
    FROM auth.users 
    WHERE email = 'johnryfibra2@gmail.com';
    
    IF auth_user_uuid IS NULL THEN
        RAISE NOTICE 'Auth user with email johnryfibra2@gmail.com not found.';
        RETURN;
    END IF;
    
    -- Check if profile already exists
    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles 
        WHERE auth_user_id = auth_user_uuid
    ) INTO profile_exists;
    
    IF profile_exists THEN
        RAISE NOTICE 'Profile already exists for user johnryfibra2@gmail.com';
        RETURN;
    END IF;
    
    -- Insert the user profile
    INSERT INTO public.user_profiles (
        auth_user_id,
        first_name,
        last_name,
        full_name,
        role,
        status,
        city,
        province,
        country
    ) VALUES (
        auth_user_uuid,
        'John Ry',
        'Fibra',
        'John Ry Fibra',
        'super_admin', -- Making this user a super admin
        'active',
        'Manila',
        'Metro Manila',
        'Philippines'
    );
    
    RAISE NOTICE 'Profile created successfully for johnryfibra2@gmail.com with super_admin role';
END $$;

-- Verify the profile was created
SELECT 
    up.id,
    up.auth_user_id,
    up.full_name,
    up.role,
    up.status,
    au.email,
    up.created_at
FROM public.user_profiles up
JOIN auth.users au ON up.auth_user_id = au.id
WHERE au.email = 'johnryfibra2@gmail.com';
