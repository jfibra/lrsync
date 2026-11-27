-- Per-account SMTP settings table for LRSync email sending
CREATE TABLE IF NOT EXISTS public.user_smtp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  mail_driver varchar(30) NOT NULL DEFAULT 'smtp',
  mail_host varchar(255) NOT NULL DEFAULT 'smtp.hostinger.com',
  mail_port integer NOT NULL DEFAULT 465,
  mail_username varchar(255) NOT NULL DEFAULT 'info@filipinohomes.com',
  mail_password text NOT NULL DEFAULT 'X1x2x3@8888',
  mail_encryption varchar(20) NOT NULL DEFAULT 'ssl',
  mail_from_name varchar(255) NOT NULL DEFAULT 'LR Accounting Software',
  mail_from varchar(255) NOT NULL DEFAULT 'no-reply@filipinohomes.com',
  mail_cc text DEFAULT 'it.dept.leuteriorealty@gmail.com',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_smtp_settings_user_id
  ON public.user_smtp_settings(user_id);

ALTER TABLE public.user_smtp_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_smtp_settings'
      AND policyname = 'Allow authenticated users to manage user_smtp_settings'
  ) THEN
    CREATE POLICY "Allow authenticated users to manage user_smtp_settings"
      ON public.user_smtp_settings
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

GRANT ALL ON TABLE public.user_smtp_settings TO postgres, anon, authenticated, service_role;

-- Seed default SMTP settings for all existing accounts
INSERT INTO public.user_smtp_settings (
  user_id,
  mail_driver,
  mail_host,
  mail_port,
  mail_username,
  mail_password,
  mail_encryption,
  mail_from_name,
  mail_from,
  mail_cc
)
SELECT DISTINCT
  COALESCE(auth_user_id, id) AS user_id,
  'smtp',
  'smtp.hostinger.com',
  465,
  'info@filipinohomes.com',
  'X1x2x3@8888',
  'ssl',
  'LR Accounting Software',
  'no-reply@filipinohomes.com',
  'it.dept.leuteriorealty@gmail.com'
FROM public.user_profiles
WHERE COALESCE(auth_user_id, id) IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
