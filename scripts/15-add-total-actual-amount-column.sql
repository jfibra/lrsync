-- Add total_actual_amount column to sales table
ALTER TABLE public.sales 
ADD COLUMN total_actual_amount numeric(12, 2) NULL;
