-- Add soft delete columns to sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance on soft delete queries
CREATE INDEX IF NOT EXISTS idx_sales_is_deleted ON sales(is_deleted);
CREATE INDEX IF NOT EXISTS idx_sales_deleted_at ON sales(deleted_at);

-- Update existing records to set is_deleted = false
UPDATE sales SET is_deleted = FALSE WHERE is_deleted IS NULL;
