--
-- Default RLS Policies for Supabase Lite
-- This file contains common RLS policies for auth tables and provides templates for user data tables
--
-- =============================================================================
-- AUTH TABLE POLICIES
-- =============================================================================
-- Policy for auth.users - users can only see their own record
CREATE POLICY "Users can view own user data." ON auth.users
  FOR SELECT
    USING ((
      SELECT
        auth.uid()) = id);

-- Policy for auth.sessions - users can only see their own sessions
CREATE POLICY "Users can view own sessions." ON auth.sessions
  FOR SELECT
    USING ((
      SELECT
        auth.uid()) = user_id);

-- Policy for auth.refresh_tokens - users can only see their own refresh tokens
CREATE POLICY "Users can view own refresh_tokens." ON auth.refresh_tokens
  FOR SELECT
    USING ((
      SELECT
        auth.uid()) = user_id);

-- =============================================================================
-- STORAGE TABLE POLICIES
-- =============================================================================
-- Policy for storage.buckets - authenticated users can view bucket info
CREATE POLICY "Authenticated users can view buckets." ON storage.buckets
  FOR SELECT TO authenticated
    USING (TRUE);

-- Policy for storage.objects - users can only see objects they own
CREATE POLICY "Users can view own objects." ON storage.objects
  FOR SELECT
    USING ((
      SELECT
        auth.uid()) = OWNER);

-- Policy for storage.objects - users can insert objects
CREATE POLICY "Authenticated users can upload objects." ON storage.objects
  FOR INSERT TO authenticated
    WITH CHECK ((
      SELECT
        auth.uid()) = OWNER);

-- Policy for storage.objects - users can update their own objects
CREATE POLICY "Users can update own objects." ON storage.objects
  FOR UPDATE
    USING ((
      SELECT
        auth.uid()) = OWNER)
      WITH CHECK ((
        SELECT
          auth.uid()) = OWNER);

-- Policy for storage.objects - users can delete their own objects
CREATE POLICY "Users can delete own objects." ON storage.objects
  FOR DELETE
    USING ((
      SELECT
        auth.uid()) = OWNER);

-- =============================================================================
-- EXAMPLE POLICIES FOR USER DATA TABLES
-- =============================================================================
-- These are examples of common RLS policy patterns for user data tables.
-- Uncomment and modify these for your specific tables.
/*
-- Example: profiles table where users can see and manage their own profile
CREATE POLICY "Users can view own profile." ON public.profiles
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own profile." ON public.profiles
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own profile." ON public.profiles
FOR UPDATE USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own profile." ON public.profiles
FOR DELETE USING ((select auth.uid()) = user_id);
 */
/*
-- Example: posts table where users can manage their own posts, but everyone can view public posts
CREATE POLICY "Users can view all posts." ON public.posts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own posts." ON public.posts
FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own posts." ON public.posts
FOR UPDATE USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own posts." ON public.posts
FOR DELETE USING ((select auth.uid()) = user_id);
 */
/*
-- Example: private user_data table where users can only see their own data
CREATE POLICY "Users can view own data." ON public.user_data
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own data." ON public.user_data
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own data." ON public.user_data
FOR UPDATE USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own data." ON public.user_data
FOR DELETE USING ((select auth.uid()) = user_id);
 */
/*
-- Example: orders table with user ownership
CREATE POLICY "Users can view own orders." ON public.orders
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own orders." ON public.orders
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own orders." ON public.orders
FOR UPDATE USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);
 */
-- =============================================================================
-- REALTIME TABLE POLICIES
-- =============================================================================
-- Allow authenticated users to access realtime features
CREATE POLICY "Authenticated users can access realtime." ON realtime.schema_migrations
  FOR SELECT TO authenticated
    USING (TRUE);

-- =============================================================================
-- UTILITY FUNCTIONS FOR COMMON RLS PATTERNS
-- =============================================================================
-- Function to check if current user is admin (example)
-- Uncomment and modify based on your admin detection logic
/*
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
 RETURN (
 SELECT raw_app_meta_data->>'role' = 'admin' 
 FROM auth.users 
 WHERE id = (select auth.uid())
 );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 */
-- Function to check if user owns a resource by user_id column
CREATE OR REPLACE FUNCTION auth.owns_resource(resource_user_id uuid)
  RETURNS boolean
  AS $$
BEGIN
  RETURN(
    SELECT
      auth.uid()) = resource_user_id;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

-- Function to check if user is authenticated
CREATE OR REPLACE FUNCTION auth.is_authenticated()
  RETURNS boolean
  AS $$
BEGIN
  RETURN(
    SELECT
      auth.uid()) IS NOT NULL;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

