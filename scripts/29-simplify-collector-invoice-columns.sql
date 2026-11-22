-- Simplify collector_transactions invoice columns if table already exists
-- Removes accounting-only fields from collector step and enforces automatic invoice_date

ALTER TABLE public.collector_transactions
  DROP COLUMN IF EXISTS invoice_number,
  DROP COLUMN IF EXISTS tax_month,
  DROP COLUMN IF EXISTS net_commission_amount,
  DROP COLUMN IF EXISTS tax_type,
  DROP COLUMN IF EXISTS project_or_unit_ref;

UPDATE public.collector_transactions
SET invoice_date = COALESCE(invoice_date, invoice_date_collected, CURRENT_DATE)
WHERE invoice_date IS NULL;

ALTER TABLE public.collector_transactions
  ALTER COLUMN invoice_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN invoice_date SET NOT NULL;

NOTIFY pgrst, 'reload schema';
