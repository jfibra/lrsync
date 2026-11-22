-- Add 'collector' role to the public.user_role enum
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in older Postgres versions,
-- so run this directly in the Supabase SQL Editor or via psql.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'collector';

NOTIFY pgrst, 'reload schema';
