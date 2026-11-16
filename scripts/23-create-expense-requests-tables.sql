-- Create expense_request_invoices table
CREATE TABLE IF NOT EXISTS public.expense_request_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number varchar(100) NOT NULL,
  invoice_date date DEFAULT CURRENT_DATE,
  due_date date,
  payment_terms varchar(100),
  po_number varchar(100),
  company_name varchar(255) DEFAULT 'LEUTERIO REALTY & BROKERAGE',
  company_tin varchar(100),
  company_address text DEFAULT 'Cebu City, Philippines',
  company_email varchar(255) DEFAULT 'info@filipinohomes.com',
  company_phone varchar(50),
  requested_by_uuid uuid,
  requested_by_name varchar(150),
  requested_by_email varchar(255),
  assigned_area varchar(150),
  payee_name varchar(255),
  payee_tin varchar(50),
  payee_substreet_street_brgy text,
  payee_district_city_zip text,
  purpose text,
  notes text,
  terms text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  expense_request_ids uuid[] DEFAULT '{}',
  subtotal numeric(12,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  show_tax boolean DEFAULT false,
  tax_amount numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  show_discount boolean DEFAULT false,
  total numeric(12,2) DEFAULT 0,
  currency varchar(20) DEFAULT 'PHP',
  status varchar(50) DEFAULT 'pending_approval',
  approval_token varchar(255) UNIQUE,
  sent_to_email varchar(255),
  email_sent_at timestamptz,
  approved_by_name varchar(255) DEFAULT 'ANTHONY GERARD LEUTERIO',
  approved_by_email varchar(255) DEFAULT 'mindworth@gmail.com',
  signature_data text,
  signed_at timestamptz,
  signed_via varchar(50),
  signed_ip varchar(100),
  signed_pdf_url text,
  converted_purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  converted_at timestamptz,
  converted_by_uuid uuid,
  converted_by_name varchar(150),
  rejection_reason text,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create expense_requests table (itemized expense requests with same fields as purchases)
CREATE TABLE IF NOT EXISTS public.expense_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  quantity numeric(10,2) DEFAULT 1,
  unit_price numeric(12,2) DEFAULT 0,
  tax_month date NOT NULL,
  tin_id uuid REFERENCES public.taxpayer_listings(id) ON DELETE SET NULL,
  tin varchar(20),
  name varchar(255),
  substreet_street_brgy text,
  district_city_zip text,
  gross_taxable numeric(12,2) DEFAULT 0,
  total_actual_amount numeric(12,2) DEFAULT 0,
  invoice_number varchar(100),
  tax_type varchar(20) DEFAULT 'non-vat',
  official_receipt text[] DEFAULT '{}',
  category_id uuid REFERENCES public.purchases_categories(id) ON DELETE SET NULL,
  date_added date DEFAULT CURRENT_DATE,
  user_uuid uuid,
  user_full_name varchar(150),
  user_email varchar(255),
  user_assigned_area varchar(150),
  remarks text,
  status varchar(50) DEFAULT 'pending',
  expense_invoice_id uuid REFERENCES public.expense_request_invoices(id) ON DELETE SET NULL,
  expense_invoice_number varchar(100),
  approved_at timestamptz,
  approved_by varchar(150),
  converted_purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  converted_at timestamptz,
  converted_by_name varchar(150),
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_expense_requests_user_uuid ON public.expense_requests(user_uuid);
CREATE INDEX IF NOT EXISTS idx_expense_requests_status ON public.expense_requests(status);
CREATE INDEX IF NOT EXISTS idx_expense_requests_expense_invoice_id ON public.expense_requests(expense_invoice_id);
CREATE INDEX IF NOT EXISTS idx_expense_requests_tax_month ON public.expense_requests(tax_month);
CREATE INDEX IF NOT EXISTS idx_expense_request_invoices_status ON public.expense_request_invoices(status);
CREATE INDEX IF NOT EXISTS idx_expense_request_invoices_token ON public.expense_request_invoices(approval_token);

-- Grant permissions to Supabase roles
GRANT ALL ON TABLE public.expense_requests TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.expense_request_invoices TO postgres, anon, authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
