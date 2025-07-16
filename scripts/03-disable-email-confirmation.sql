-- Disable email confirmation for easier user creation
-- This should be run in the Supabase SQL editor

-- Check current auth settings
SELECT * FROM auth.config;

-- Note: You'll need to disable email confirmation in the Supabase dashboard
-- Go to Authentication > Settings > Email Auth
-- Turn OFF "Enable email confirmations"

-- Alternatively, you can update the auth config (if you have the right permissions)
-- UPDATE auth.config SET email_confirm_required = false WHERE parameter = 'email_confirm_required';

-- For development, you might also want to disable double opt-in
-- UPDATE auth.config SET email_double_confirm_required = false WHERE parameter = 'email_double_confirm_required';

SELECT 'Please disable email confirmation in Supabase Dashboard > Authentication > Settings' as instruction;
