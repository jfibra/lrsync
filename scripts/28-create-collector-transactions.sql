-- Create collector_transactions table for Collector PWA -> Accounting Validation -> Sales Conversion workflow
CREATE TABLE IF NOT EXISTS public.collector_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workflow & Cheque Status
  workflow_status text NOT NULL DEFAULT 'invoice_issued'
    CHECK (workflow_status IN (
      'invoice_issued',
      'cheque_collected',
      'deposited',
      'verified',
      'returned',
      'converted_to_sale'
    )),
  cheque_status text NOT NULL DEFAULT 'pending'
    CHECK (cheque_status IN ('pending', 'deposited', 'verified')),
  assigned_area text,

  -- Developer Link (from public.taxpayer_listings where type = 'sales')
  developer_tin_id uuid REFERENCES public.taxpayer_listings(id) ON DELETE SET NULL,
  developer_tin varchar(20),
  developer_name varchar(255),
  developer_substreet_street_brgy text,
  developer_district_city_zip text,

  -- Step 1: Invoice Issued Details + Silent Capture Telemetry
  invoice_photo_urls text[] NOT NULL DEFAULT '{}',
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  commission_amount numeric(14, 2),
  invoice_remarks text,
  invoice_ocr_data jsonb,
  invoice_clarity_score integer CHECK (invoice_clarity_score IS NULL OR (invoice_clarity_score >= 0 AND invoice_clarity_score <= 100)),
  invoice_collected_by_uuid uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_collected_by_name text,
  invoice_date_collected date DEFAULT CURRENT_DATE,
  invoice_time_collected time,
  invoice_captured_at timestamptz NOT NULL DEFAULT now(),
  invoice_location text,
  invoice_latitude double precision,
  invoice_longitude double precision,
  invoice_gps_accuracy double precision,
  invoice_device_used text,

  -- Step 2: Cheque Collection Details + Capture Telemetry
  cheque_photo_urls text[] NOT NULL DEFAULT '{}',
  doc_2307_photo_urls text[] NOT NULL DEFAULT '{}',
  voucher_photo_urls text[] NOT NULL DEFAULT '{}',
  cheque_number text,
  cheque_bank text,
  cheque_branch text,
  cheque_date date,
  cheque_amount numeric(14, 2),
  amount_discrepancy boolean NOT NULL DEFAULT false,
  received_from_name text,
  cheque_remarks text,
  cheque_ocr_data jsonb,
  cheque_clarity_score integer CHECK (cheque_clarity_score IS NULL OR (cheque_clarity_score >= 0 AND cheque_clarity_score <= 100)),
  cheque_collected_by_uuid uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cheque_collected_by_name text,
  cheque_date_collected date,
  cheque_time_collected time,
  cheque_captured_at timestamptz,
  cheque_location text,
  cheque_latitude double precision,
  cheque_longitude double precision,
  cheque_gps_accuracy double precision,
  cheque_device_used text,

  -- Step 3: Cheque Deposit Details + Capture Telemetry
  deposit_slip_urls text[] NOT NULL DEFAULT '{}',
  deposit_bank text,
  deposit_reference_no text,
  deposit_amount numeric(14, 2),
  deposit_date date,
  deposit_time time,
  deposited_at timestamptz,
  deposited_by_uuid uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deposited_by_name text,
  deposit_location text,
  deposit_latitude double precision,
  deposit_longitude double precision,
  deposit_gps_accuracy double precision,
  deposit_device_used text,
  deposit_remarks text,
  deposit_ocr_data jsonb,
  deposit_clarity_score integer CHECK (deposit_clarity_score IS NULL OR (deposit_clarity_score >= 0 AND deposit_clarity_score <= 100)),
  notified_accounting_at timestamptz,

  -- Step 4: Accounting Validation & Sales Conversion
  verified_by_uuid uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_by_name text,
  verified_at timestamptz,
  accounting_remarks text,
  sales_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  converted_to_sale_at timestamptz,

  -- Soft delete & Audit Timestamps
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common collector & accounting queries
CREATE INDEX IF NOT EXISTS idx_collector_tx_workflow_status ON public.collector_transactions(workflow_status);
CREATE INDEX IF NOT EXISTS idx_collector_tx_cheque_status ON public.collector_transactions(cheque_status);
CREATE INDEX IF NOT EXISTS idx_collector_tx_developer_tin_id ON public.collector_transactions(developer_tin_id);
CREATE INDEX IF NOT EXISTS idx_collector_tx_invoice_collector ON public.collector_transactions(invoice_collected_by_uuid);
CREATE INDEX IF NOT EXISTS idx_collector_tx_cheque_collector ON public.collector_transactions(cheque_collected_by_uuid);
CREATE INDEX IF NOT EXISTS idx_collector_tx_assigned_area ON public.collector_transactions(assigned_area);
CREATE INDEX IF NOT EXISTS idx_collector_tx_sales_id ON public.collector_transactions(sales_id);
CREATE INDEX IF NOT EXISTS idx_collector_tx_created_at ON public.collector_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collector_tx_is_deleted ON public.collector_transactions(is_deleted);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_collector_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_collector_transactions_updated_at ON public.collector_transactions;
CREATE TRIGGER trg_collector_transactions_updated_at
  BEFORE UPDATE ON public.collector_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_collector_transactions_updated_at();

-- Enable Row Level Security
ALTER TABLE public.collector_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collector_transactions'
      AND policyname = 'Allow all operations for authenticated users on collector_transactions'
  ) THEN
    CREATE POLICY "Allow all operations for authenticated users on collector_transactions"
      ON public.collector_transactions
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
