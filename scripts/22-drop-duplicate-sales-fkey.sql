-- Drop duplicate foreign key constraint on sales table to fix PostgREST query ambiguity
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_taxpayer_listing_id_fkey;
