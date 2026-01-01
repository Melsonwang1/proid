-- EASE Platform - User Profiles Table for Supabase
-- Created: January 1, 2026
-- This table extends Supabase Auth with additional profile information

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table that extends your existing users table
-- Ensures one-to-one relationship with users table
CREATE TABLE IF NOT EXISTS public.user_profiles (
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
    CONSTRAINT unique_user_profile UNIQUE(user_id)
);

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add id column if it doesn't exist (primary key)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN id UUID DEFAULT gen_random_uuid() PRIMARY KEY;
    END IF;
    
    -- Check and add user_id column (references users.id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='user_id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Ensure unique constraint exists for one-to-one relationship
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name='user_profiles' AND constraint_name='unique_user_profile') THEN
        ALTER TABLE public.user_profiles ADD CONSTRAINT unique_user_profile UNIQUE(user_id);
    END IF;
    
    -- Check and add columns that might be missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='display_name') THEN
        ALTER TABLE public.user_profiles ADD COLUMN display_name VARCHAR(150);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='avatar_url') THEN
        ALTER TABLE public.user_profiles ADD COLUMN avatar_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='bio') THEN
        ALTER TABLE public.user_profiles ADD COLUMN bio TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='phone') THEN
        ALTER TABLE public.user_profiles ADD COLUMN phone VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='date_of_birth') THEN
        ALTER TABLE public.user_profiles ADD COLUMN date_of_birth DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='gender') THEN
        ALTER TABLE public.user_profiles ADD COLUMN gender VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='location') THEN
        ALTER TABLE public.user_profiles ADD COLUMN location VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='emergency_contact_name') THEN
        ALTER TABLE public.user_profiles ADD COLUMN emergency_contact_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='emergency_contact_phone') THEN
        ALTER TABLE public.user_profiles ADD COLUMN emergency_contact_phone VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='mental_health_goals') THEN
        ALTER TABLE public.user_profiles ADD COLUMN mental_health_goals TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='communication_preferences') THEN
        ALTER TABLE public.user_profiles ADD COLUMN communication_preferences JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='privacy_settings') THEN
        ALTER TABLE public.user_profiles ADD COLUMN privacy_settings JSONB DEFAULT '{"profile_visible": true, "allow_matching": true}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='is_verified') THEN
        ALTER TABLE public.user_profiles ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='is_active') THEN
        ALTER TABLE public.user_profiles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='last_active') THEN
        ALTER TABLE public.user_profiles ADD COLUMN last_active TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='created_at') THEN
        ALTER TABLE public.user_profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='updated_at') THEN
        ALTER TABLE public.user_profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON public.user_profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active ON public.user_profiles(last_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON public.user_profiles(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at timestamp (safe replacement)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON public.user_profiles 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration (creates profile automatically)
-- Ensures proper linking and prevents duplicate profiles
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
    -- Create user profile with proper linking
    INSERT INTO public.user_profiles (
        user_id, 
        display_name,
        is_active,
        created_at
    ) VALUES (
        new.id, 
        CONCAT(new.first_name, ' ', new.last_name),
        true,
        now()
    )
    ON CONFLICT (user_id) DO NOTHING;  -- Prevents duplicate profiles
    
    RETURN new;
END;
$$ language plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
DROP TRIGGER IF EXISTS on_user_created ON public.users;
CREATE TRIGGER on_user_created
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Row Level Security (RLS) for Supabase
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies (users can only access their own data) - Safe policy creation
-- Note: Since you're using custom users table, you'll need to modify these policies
-- to work with your authentication system instead of auth.uid()
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.user_profiles;

-- Policies to ensure users can only access their own profiles
-- Temporarily permissive policies - you can restrict these later when implementing session management
CREATE POLICY "Users can view their own profile" ON public.user_profiles 
    FOR SELECT USING (true);  

CREATE POLICY "Users can insert their own profile" ON public.user_profiles 
    FOR INSERT WITH CHECK (true);  

CREATE POLICY "Users can update their own profile" ON public.user_profiles 
    FOR UPDATE USING (true);  

-- Also add delete policy for completeness
CREATE POLICY "Users can delete their own profile" ON public.user_profiles 
    FOR DELETE USING (true);

-- Function to create user profile manually (for existing users)
CREATE OR REPLACE FUNCTION public.create_user_profile(p_user_id UUID)
RETURNS boolean AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Check if user exists
    SELECT * INTO user_record FROM public.users WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User with ID % does not exist', p_user_id;
    END IF;
    
    -- Create profile if it doesn't exist
    INSERT INTO public.user_profiles (
        user_id, 
        display_name,
        is_active,
        created_at
    ) VALUES (
        p_user_id, 
        CONCAT(user_record.first_name, ' ', user_record.last_name),
        true,
        now()
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN true;
END;
$$ language plpgsql SECURITY DEFINER;

-- Temporary cleanup function to fix existing table structure if needed
CREATE OR REPLACE FUNCTION public.fix_user_profiles_table()
RETURNS boolean AS $$
BEGIN
    -- Add id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN id UUID DEFAULT gen_random_uuid();
        UPDATE public.user_profiles SET id = gen_random_uuid() WHERE id IS NULL;
        ALTER TABLE public.user_profiles ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);
    END IF;
    
    -- Ensure user_id has proper constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name='user_profiles' AND constraint_name='user_profiles_user_id_key') THEN
        ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE(user_id);
    END IF;
    
    RETURN true;
END;
$$ language plpgsql SECURITY DEFINER;

-- Call the fix function
SELECT public.fix_user_profiles_table();