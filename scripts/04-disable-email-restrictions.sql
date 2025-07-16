-- Disable email domain restrictions in Supabase
-- This should be run in the Supabase SQL editor or Dashboard

-- Method 1: Update auth configuration to allow all email domains
-- Note: This requires superuser privileges and may not work in hosted Supabase

-- Check current auth settings
SELECT * FROM auth.config WHERE parameter LIKE '%email%';

-- Try to disable email domain restrictions (may require superuser access)
-- UPDATE auth.config SET value = 'false' WHERE parameter = 'email_domain_restriction_enabled';

-- Method 2: If the above doesn't work, you'll need to configure this in the Supabase Dashboard
-- Go to: Authentication > Settings > Email Auth
-- Look for "Email domain restrictions" or similar setting and disable it

-- For development/testing, you can also try these settings:
-- UPDATE auth.config SET value = 'false' WHERE parameter = 'email_confirm_required';
-- UPDATE auth.config SET value = 'false' WHERE parameter = 'email_double_confirm_required';

SELECT 'Please check Supabase Dashboard > Authentication > Settings for email domain restrictions' as instruction;
