-- Fix RLS Policies for EASE Platform Users Table
-- Run this AFTER creating the original users table

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

-- Create new policies that work with Supabase Auth
CREATE POLICY "Users can insert their own profile" 
    ON public.users FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Allow anon users to insert during signup (temporary, gets elevated to authenticated)
CREATE POLICY "Allow signup inserts" 
    ON public.users FOR INSERT 
    TO anon, authenticated
    WITH CHECK (true);

-- Alternative: Disable RLS temporarily during development (NOT recommended for production)
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- To re-enable later:
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;