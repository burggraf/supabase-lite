-- ================================================
-- Sample App Database Setup Script
-- ================================================
-- This script sets up the complete database for the Sample App including:
-- 1. Northwind database (if not exists)
-- 2. User profiles table with RLS
-- 3. Proper security policies
-- 4. Required auth functions for PGlite compatibility
-- ================================================

-- ================================================
-- Create auth.uid() function if it doesn't exist
-- ================================================
-- This function is required for RLS policies to work
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- Grant permissions on the auth.uid function
DO $$
BEGIN
    -- Try to grant permissions, but don't fail if roles don't exist (PGlite compatibility)
    BEGIN
        GRANT EXECUTE ON FUNCTION auth.uid() TO anon;
    EXCEPTION WHEN undefined_object THEN
        RAISE NOTICE 'Role anon does not exist, skipping grant';
    END;
    
    BEGIN
        GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
    EXCEPTION WHEN undefined_object THEN
        RAISE NOTICE 'Role authenticated does not exist, skipping grant';
    END;
END $$;

-- Check if Northwind data exists by looking for a key table
DO $$
DECLARE
    northwind_exists boolean := false;
BEGIN
    -- Check if customers table exists and has data
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'customers'
    ) INTO northwind_exists;
    
    IF northwind_exists THEN
        SELECT EXISTS (
            SELECT 1 FROM customers LIMIT 1
        ) INTO northwind_exists;
    END IF;
    
    IF NOT northwind_exists THEN
        RAISE NOTICE 'Northwind database not found. Please run the Northwind.sql script first.';
        RAISE NOTICE 'You can find it at: /public/sql_scripts/northwind.sql';
    ELSE
        RAISE NOTICE 'Northwind database detected - proceeding with setup';
    END IF;
END $$;

-- ================================================
-- Create profiles table
-- ================================================

-- Drop existing table if it exists (for development)
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create the profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    about_me TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create an index on the id for faster lookups
CREATE INDEX profiles_id_idx ON public.profiles(id);

-- ================================================
-- Enable Row Level Security (RLS)
-- ================================================

-- Enable RLS on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ================================================
-- Create RLS Policies
-- ================================================

-- Policy: Everyone can view all profiles (SELECT)
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

-- Policy: Users can insert their own profile (INSERT)
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile (UPDATE)
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy: Users can delete their own profile (DELETE)
CREATE POLICY "Users can delete own profile" 
ON public.profiles FOR DELETE 
USING (auth.uid() = id);

-- ================================================
-- Create updated_at trigger function
-- ================================================

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at column
CREATE TRIGGER on_profile_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ================================================
-- Grant necessary permissions
-- ================================================

-- Grant usage on the profiles table (with error handling for PGlite)
DO $$
BEGIN
    -- Try to grant permissions, but don't fail if roles don't exist (PGlite compatibility)
    BEGIN
        GRANT ALL ON public.profiles TO authenticated;
    EXCEPTION WHEN undefined_object THEN
        RAISE NOTICE 'Role authenticated does not exist, skipping table grant';
    END;
    
    BEGIN
        GRANT ALL ON public.profiles TO anon;
    EXCEPTION WHEN undefined_object THEN
        RAISE NOTICE 'Role anon does not exist, skipping table grant';
    END;
    
    -- Grant to public as fallback for PGlite
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO PUBLIC;
END $$;

-- ================================================
-- Verification queries
-- ================================================

-- Verify table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- Verify policies exist
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- ================================================
-- Success message
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Sample App Database Setup Complete!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '  ✓ profiles table with UUID primary key';
    RAISE NOTICE '  ✓ Foreign key to auth.users with CASCADE DELETE';
    RAISE NOTICE '  ✓ Row Level Security (RLS) enabled';
    RAISE NOTICE '  ✓ RLS policies for secure access';
    RAISE NOTICE '  ✓ Automatic updated_at timestamp trigger';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'RLS Policies Summary:';
    RAISE NOTICE '  → SELECT: Public read access for all profiles';
    RAISE NOTICE '  → INSERT: Users can create their own profile';
    RAISE NOTICE '  → UPDATE: Users can update their own profile';
    RAISE NOTICE '  → DELETE: Users can delete their own profile';
    RAISE NOTICE '============================================';
END $$;