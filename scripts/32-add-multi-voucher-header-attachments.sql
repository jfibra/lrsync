-- Add array columns to commission_vouchers to support up to 5 Voucher Documents and 5 Header Documents
-- Note: The app also remains backwards-compatible with existing voucher_attachment_url / header_attachment_url columns.
ALTER TABLE public.commission_vouchers
  ADD COLUMN IF NOT EXISTS voucher_attachment_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS header_attachment_urls text[] DEFAULT '{}';

-- Backfill existing single attachment URLs into the new array columns where empty
UPDATE public.commission_vouchers
SET voucher_attachment_urls = ARRAY[voucher_attachment_url]
WHERE voucher_attachment_url IS NOT NULL
  AND voucher_attachment_url <> ''
  AND left(trim(voucher_attachment_url), 1) <> '['
  AND (voucher_attachment_urls IS NULL OR array_length(voucher_attachment_urls, 1) IS NULL);

UPDATE public.commission_vouchers
SET header_attachment_urls = ARRAY[header_attachment_url]
WHERE header_attachment_url IS NOT NULL
  AND header_attachment_url <> ''
  AND left(trim(header_attachment_url), 1) <> '['
  AND (header_attachment_urls IS NULL OR array_length(header_attachment_urls, 1) IS NULL);

NOTIFY pgrst, 'reload schema';
