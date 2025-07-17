-- Create sales table with proper schema
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_month date NOT NULL, -- e.g., 2025-07-31
  -- Foreign key relation to taxpayer_listings
  tin_id uuid REFERENCES taxpayer_listings(id) ON DELETE SET NULL,
  -- Cached info from taxpayer_listings for faster joins & immutability
  tin varchar(20),
  name varchar(255),
  type varchar(20),
  substreet_street_brgy text,
  district_city_zip text,
  gross_taxable numeric(12,2),
  invoice_number varchar(100),
  tax_type varchar(20) CHECK (tax_type IN ('vat', 'non-vat')),
  pickup_date date,
  cheque text[],        -- Array of S3 file URLs
  voucher text[],
  doc_2307 text[],
  invoice text[],
  deposit_slip text[],
  date_added date DEFAULT CURRENT_DATE,
  user_uuid uuid REFERENCES auth.users(id),
  user_full_name varchar(150),
  is_deleted boolean DEFAULT false, -- soft delete: false = active, true = deleted
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_tax_month ON sales(tax_month);
CREATE INDEX IF NOT EXISTS idx_sales_tin_id ON sales(tin_id);
CREATE INDEX IF NOT EXISTS idx_sales_tin ON sales(tin);
CREATE INDEX IF NOT EXISTS idx_sales_user_uuid ON sales(user_uuid);
CREATE INDEX IF NOT EXISTS idx_sales_is_deleted ON sales(is_deleted);

-- Enable RLS
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view all sales records" ON sales
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert sales records" ON sales
  FOR INSERT WITH CHECK (auth.uid() = user_uuid);

CREATE POLICY "Users can update their own sales records" ON sales
  FOR UPDATE USING (auth.uid() = user_uuid);

CREATE POLICY "Users can delete their own sales records" ON sales
  FOR DELETE USING (auth.uid() = user_uuid);
