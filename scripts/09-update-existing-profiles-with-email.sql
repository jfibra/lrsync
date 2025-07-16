-- Update existing user profiles to populate email from auth.users where possible
UPDATE public.user_profiles 
SET email = auth_users.email
FROM auth.users AS auth_users
WHERE public.user_profiles.auth_user_id = auth_users.id
AND public.user_profiles.email IS NULL;

-- Show updated profiles
SELECT 
    up.id,
    up.full_name,
    up.email,
    up.auth_user_id,
    up.role,
    up.status,
    CASE 
        WHEN up.auth_user_id IS NOT NULL THEN 'Can Login'
        ELSE 'Profile Only'
    END as login_status
FROM public.user_profiles up
ORDER BY up.created_at DESC;
