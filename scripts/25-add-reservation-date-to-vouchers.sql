-- Add reservation_date column to commission_vouchers
ALTER TABLE public.commission_vouchers
  ADD COLUMN IF NOT EXISTS reservation_date text;

NOTIFY pgrst, 'reload schema';
