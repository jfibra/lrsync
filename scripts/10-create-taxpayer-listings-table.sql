-- Create taxpayer_listings table
CREATE TABLE IF NOT EXISTS taxpayer_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tin varchar(20) NOT NULL,
  registered_name varchar(255),
  substreet_street_brgy text,
  district_city_zip text,
  type varchar(20) NOT NULL CHECK (type IN ('sales', 'purchases')),
  date_added date DEFAULT CURRENT_DATE,
  user_uuid uuid REFERENCES auth.users(id),
  user_full_name varchar(150),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tin, type) -- Ensure unique TIN per type
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_taxpayer_listings_tin ON taxpayer_listings(tin);
CREATE INDEX IF NOT EXISTS idx_taxpayer_listings_type ON taxpayer_listings(type);
CREATE INDEX IF NOT EXISTS idx_taxpayer_listings_user_uuid ON taxpayer_listings(user_uuid);

-- Enable RLS
ALTER TABLE taxpayer_listings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view all taxpayer listings" ON taxpayer_listings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert taxpayer listings" ON taxpayer_listings
  FOR INSERT WITH CHECK (auth.uid() = user_uuid);

CREATE POLICY "Users can update their own taxpayer listings" ON taxpayer_listings
  FOR UPDATE USING (auth.uid() = user_uuid);

CREATE POLICY "Users can delete their own taxpayer listings" ON taxpayer_listings
  FOR DELETE USING (auth.uid() = user_uuid);
