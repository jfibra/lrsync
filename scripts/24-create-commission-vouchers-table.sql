-- Create commission_vouchers table for storing Commission Slip Vouchers and their generated Bondpaper PDFs
CREATE TABLE IF NOT EXISTS public.commission_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number varchar(100),
  slip_type varchar(100) DEFAULT 'VAT w/ Invoice',
  lrsales_id bigint,
  member_id bigint,
  developer_name text,
  developer_rate numeric(6,2) DEFAULT 5.00,
  agent_name text,
  agent_rate numeric(6,2) DEFAULT 4.00,
  project_name text,
  unit_number text,
  client_name text,
  amount_released numeric(14,2) DEFAULT 0,
  total_amount numeric(14,2) DEFAULT 0,
  exclusive_of_vat numeric(14,2) DEFAULT 0,
  withholding_tax numeric(14,2) DEFAULT 0,
  vat_amount numeric(14,2) DEFAULT 0,
  ewt_rate numeric(5,2) DEFAULT 10.00,
  commission_status text,
  voucher_attachment_url text,
  header_attachment_url text,
  generated_pdf_url text,
  attachments text[] DEFAULT '{}',
  created_by_uuid uuid,
  created_by_name varchar(150),
  created_by_email varchar(255),
  assigned_area varchar(150),
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_vouchers_created_at ON public.commission_vouchers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_vouchers_agent_name ON public.commission_vouchers(agent_name);
CREATE INDEX IF NOT EXISTS idx_commission_vouchers_developer_name ON public.commission_vouchers(developer_name);
CREATE INDEX IF NOT EXISTS idx_commission_vouchers_voucher_number ON public.commission_vouchers(voucher_number);

GRANT ALL ON TABLE public.commission_vouchers TO postgres, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
