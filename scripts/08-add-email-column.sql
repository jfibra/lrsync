-- Add email column to user_profiles table if it doesn't exist
DO $$ 
BEGIN
    -- Check if email column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'email'
        AND table_schema = 'public'
    ) THEN
        -- Add email column
        ALTER TABLE public.user_profiles ADD COLUMN email TEXT;
        
        -- Add unique constraint on email
        ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_email_unique UNIQUE (email);
        
        -- Create index on email for faster lookups
        CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
        
        RAISE NOTICE 'Email column added to user_profiles table';
    ELSE
        RAISE NOTICE 'Email column already exists in user_profiles table';
    END IF;
END $$;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;
