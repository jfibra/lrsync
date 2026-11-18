-- Create commission_releases table for grouped/merged Commission Vouchers & Proof of Transactions (POT)
CREATE TABLE IF NOT EXISTS public.commission_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  remarks text,
  voucher_ids text[] NOT NULL DEFAULT '{}',
  voucher_numbers text[] NOT NULL DEFAULT '{}',
  total_gross_comm numeric(14, 2) NOT NULL DEFAULT 0,
  total_net_comm numeric(14, 2) NOT NULL DEFAULT 0,
  combined_pdf_url text,
  pot_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_uuid text,
  created_by_name text,
  created_by_email text,
  assigned_area text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_releases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'commission_releases' AND policyname = 'Allow all operations for authenticated users on commission_releases'
  ) THEN
    CREATE POLICY "Allow all operations for authenticated users on commission_releases"
      ON public.commission_releases
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
