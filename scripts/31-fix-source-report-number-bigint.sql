-- Fix source_commission_report_number column type from integer to bigint
-- (Commission report numbers like 11212026172511 exceed 32-bit integer max 2,147,483,647)
ALTER TABLE public.commission_vouchers
  ALTER COLUMN source_commission_report_number TYPE bigint;

NOTIFY pgrst, 'reload schema';
