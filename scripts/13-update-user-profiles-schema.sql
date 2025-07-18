-- Update user_profiles table to match new schema
-- Remove city, province, country columns and add assigned_area

-- Add assigned_area column if it doesn't exist
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS assigned_area TEXT;

-- Drop the old location columns if they exist
ALTER TABLE public.user_profiles 
DROP COLUMN IF EXISTS city,
DROP COLUMN IF EXISTS province,
DROP COLUMN IF EXISTS country;

-- Create index for assigned_area
CREATE INDEX IF NOT EXISTS idx_user_profiles_assigned_area ON public.user_profiles(assigned_area);

-- Success message
SELECT 'User profiles schema updated successfully - replaced city/province/country with assigned_area!' as status;
