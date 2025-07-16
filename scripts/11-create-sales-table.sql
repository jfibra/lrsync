-- Create sales table for tracking monthly sales records
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tin_number VARCHAR(15) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  barangay VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  total_sales DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_type VARCHAR(10) NOT NULL CHECK (tax_type IN ('VAT', 'Non-VAT')),
  sales_month DATE NOT NULL, -- First day of the month for the sales period
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_tin_number ON sales(tin_number);
CREATE INDEX IF NOT EXISTS idx_sales_month ON sales(sales_month);
CREATE INDEX IF NOT EXISTS idx_sales_tax_type ON sales(tax_type);
CREATE INDEX IF NOT EXISTS idx_sales_company_name ON sales(company_name);

-- Enable RLS
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Create policies for different user roles
CREATE POLICY "Super admins can view all sales" ON sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can view all sales" ON sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can insert sales" ON sales
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can insert sales" ON sales
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can update sales" ON sales
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can update sales" ON sales
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- Insert sample data for Philippine real estate developers
INSERT INTO sales (tin_number, company_name, barangay, city, total_sales, tax_type, sales_month) VALUES
-- July 2025
('123-456-789-000', 'Ayala Land Inc.', 'Bel-Air', 'Makati City', 15750000.00, 'VAT', '2025-07-01'),
('234-567-890-000', 'SM Development Corporation', 'Bagumbayan', 'Quezon City', 12500000.00, 'VAT', '2025-07-01'),
('345-678-901-000', 'Megaworld Corporation', 'Fort Bonifacio', 'Taguig City', 18900000.00, 'VAT', '2025-07-01'),
('456-789-012-000', 'Vista Land & Lifescapes Inc.', 'Alabang', 'Muntinlupa City', 8750000.00, 'Non-VAT', '2025-07-01'),
('567-890-123-000', 'Robinsons Land Corporation', 'Ortigas Center', 'Pasig City', 14200000.00, 'VAT', '2025-07-01'),

-- June 2025
('123-456-789-000', 'Ayala Land Inc.', 'Bel-Air', 'Makati City', 16200000.00, 'VAT', '2025-06-01'),
('234-567-890-000', 'SM Development Corporation', 'Bagumbayan', 'Quezon City', 11800000.00, 'VAT', '2025-06-01'),
('678-901-234-000', 'Federal Land Inc.', 'Binondo', 'Manila City', 9500000.00, 'Non-VAT', '2025-06-01'),
('789-012-345-000', 'Century Properties Group Inc.', 'Poblacion', 'Makati City', 13400000.00, 'VAT', '2025-06-01'),
('890-123-456-000', 'Filinvest Land Inc.', 'Filinvest', 'Alabang', 7800000.00, 'Non-VAT', '2025-06-01'),

-- May 2025
('345-678-901-000', 'Megaworld Corporation', 'Fort Bonifacio', 'Taguig City', 17500000.00, 'VAT', '2025-05-01'),
('456-789-012-000', 'Vista Land & Lifescapes Inc.', 'Alabang', 'Muntinlupa City', 9200000.00, 'Non-VAT', '2025-05-01'),
('567-890-123-000', 'Robinsons Land Corporation', 'Ortigas Center', 'Pasig City', 15600000.00, 'VAT', '2025-05-01'),
('901-234-567-000', 'DMCI Homes', 'Acacia Estates', 'Taguig City', 6900000.00, 'Non-VAT', '2025-05-01'),
('012-345-678-000', 'Rockwell Land Corporation', 'Rockwell Center', 'Makati City', 21500000.00, 'VAT', '2025-05-01');
