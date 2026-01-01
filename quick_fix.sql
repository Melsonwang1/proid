-- Quick fix for user_profiles table
-- Run this in Supabase SQL Editor

-- First, drop the existing table if it has issues
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Recreate with proper structure
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
    CONSTRAINT unique_user_profile UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create permissive policies
CREATE POLICY "Enable all access for user_profiles" ON public.user_profiles FOR ALL USING (true);

-- Create indexes
CREATE INDEX idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_is_active ON public.user_profiles(is_active);

-- Verify the structure
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;