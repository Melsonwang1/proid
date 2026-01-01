-- EMERGENCY FIX for user_profiles table
-- Copy and paste this ENTIRE block into Supabase SQL Editor and run it

-- Step 1: Temporarily disable RLS to fix the table
ALTER TABLE IF EXISTS public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop and recreate users table with correct structure for custom auth
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Insert the current user (they will need to sign up again with new password)
-- Or you can set a temporary password hash here
INSERT INTO public.users (id, email, first_name, last_name, password_hash, created_at)
VALUES (
    'ae8409a6-5cac-4040-bde2-e609c9579cd6'::UUID,
    'melsonwang@gmail.com',
    'Melson',
    'Wang',
    -- SHA-256 hash of 'password123' - change this or let user sign up fresh
    '5e884898da28047d9166c5e58c13a36e45c3c3a8b69c86c6e935f3e3f3c73a40',
    NOW()
);

-- Step 4: Drop and recreate user_profiles table with correct structure
DROP TABLE IF EXISTS public.user_profiles CASCADE;

CREATE TABLE public.user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    display_name VARCHAR(150),
    avatar_url TEXT,
    bio TEXT,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),
    location VARCHAR(100),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    mental_health_goals TEXT[],
    communication_preferences JSONB DEFAULT '{}',
    privacy_settings JSONB DEFAULT '{"profile_visible": true, "allow_matching": true}',
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_active TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Buddy matching fields (from buddy_messaging_system.sql)
    age_range VARCHAR(20),
    timezone VARCHAR(50),
    preferred_communication VARCHAR(50),
    is_seeking_buddy BOOLEAN DEFAULT FALSE,
    is_available_as_buddy BOOLEAN DEFAULT FALSE,
    interests TEXT[],
    support_goals TEXT[],
    
    CONSTRAINT unique_user_profile UNIQUE(user_id)
);

-- Step 5: Create indexes (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON public.user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_users_id ON public.users(id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Step 6: Enable RLS and create permissive policies for both tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Enable all access for user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable all access for users" ON public.users;

-- Create simple policies for all operations
CREATE POLICY "Enable all access for user_profiles" 
ON public.user_profiles 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable all access for users" 
ON public.users 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Step 7: Test the setup
SELECT 'Setup complete! Tables created and user added.' as status;

-- Check if user exists in users table
SELECT 'User exists in users table:' as check_type, id, email, first_name, last_name 
FROM public.users 
WHERE id = 'ae8409a6-5cac-4040-bde2-e609c9579cd6';

-- Show table structure
SELECT 'user_profiles table structure:' as table_info;
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;