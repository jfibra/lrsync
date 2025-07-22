-- Add taxpayer_listing_id column to sales table to create relationship
ALTER TABLE sales 
ADD COLUMN taxpayer_listing_id UUID REFERENCES taxpayer_listings(id);

-- Create index for better performance
CREATE INDEX idx_sales_taxpayer_listing_id ON sales(taxpayer_listing_id);

-- Update existing sales records to link with taxpayer_listings based on TIN
UPDATE sales 
SET taxpayer_listing_id = tl.id
FROM taxpayer_listings tl
WHERE REPLACE(sales.tin, '-', '') = tl.tin;
