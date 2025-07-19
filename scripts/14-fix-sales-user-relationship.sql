-- Fix the foreign key relationship between sales and user_profiles
-- The sales table references auth.users but we need to join with user_profiles

-- First, let's check if we need to update the foreign key constraint
-- The sales.user_uuid should reference auth.users(id), and we'll join through that

-- Add index for better performance on the join
CREATE INDEX IF NOT EXISTS idx_sales_user_uuid ON sales(user_uuid);
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);

-- Update any existing sales records that might have null user_uuid
-- This is optional and depends on your data
UPDATE sales 
SET user_uuid = (
  SELECT auth_user_id 
  FROM user_profiles 
  WHERE user_profiles.full_name = sales.user_full_name
  LIMIT 1
)
WHERE user_uuid IS NULL AND user_full_name IS NOT NULL;
