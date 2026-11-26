-- Add voucher_number to collector_transactions for accounting cheque verification & tracking
ALTER TABLE public.collector_transactions
  ADD COLUMN IF NOT EXISTS voucher_number text;

CREATE INDEX IF NOT EXISTS idx_collector_tx_voucher_number
  ON public.collector_transactions(voucher_number);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
