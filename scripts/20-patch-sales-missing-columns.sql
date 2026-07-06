-- Patch missing columns and adjust column lengths to match production schema in sales_rows.sql
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS sale_type TEXT,
ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Adjust column types to avoid length restriction issues
ALTER TABLE public.sales ALTER COLUMN invoice_number TYPE TEXT;
ALTER TABLE public.sales ALTER COLUMN user_full_name TYPE TEXT;
