-- Add accounting_pot column to commission_report table to store uploaded file URLs
ALTER TABLE commission_report 
ADD COLUMN IF NOT EXISTS accounting_pot TEXT;

-- Add comment to explain the column purpose
COMMENT ON COLUMN commission_report.accounting_pot IS 'JSON array storing uploaded file information including Google Drive URLs, file names, and upload timestamps';
