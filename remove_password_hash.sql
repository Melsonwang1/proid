-- Updated EASE Platform Users Table (No Password Hash)
-- This is the correct approach for Supabase

-- Remove the password_hash column since Supabase Auth handles this
ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;

-- Your users table should only contain profile information, not auth credentials
-- Supabase Auth handles all password hashing and storage internally

-- Verify your table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public';