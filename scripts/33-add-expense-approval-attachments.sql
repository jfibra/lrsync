-- Optional migration: Add native approval_attachments array column on expense_request_invoices
-- Note: The app also stores proof attachment URLs in signed_pdf_url so manual approval works even before running this script.
ALTER TABLE public.expense_request_invoices
  ADD COLUMN IF NOT EXISTS approval_attachments text[] DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
