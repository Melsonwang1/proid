-- EMERGENCY FIX for user_profiles table (Custom Auth Version)
-- Copy and paste this ENTIRE block into Supabase SQL Editor and run it

-- Step 1: Temporarily disable RLS to fix the table
ALTER TABLE IF EXISTS public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.buddy_pairs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop and recreate users table with correct structure for custom auth
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.buddy_pairs CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.buddy_requests CASCADE;
DROP TABLE IF EXISTS public.message_reactions CASCADE;

-- Recreate users table if needed
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Insert test users
INSERT INTO public.users (id, email, first_name, last_name, password_hash, created_at)
VALUES 
(
    '1d305467-70c4-4e65-a9d2-cead88516c49'::UUID,
    'shenshouting10@gmail.com',
    'xiaoting',
    'shen',
    '647a3cd5930f4355bf2abbc7fd4a0e8fd95',
    NOW()
),
(
    'b30702a4-2099-4d40-8602-4aefd18c904b'::UUID,
    'melsonwang@gmail.com',
    'Melson',
    'Wang',
    '5e884898da28047d9166c5e58c13a36e45c3c3a8b69c86c6e935f3e3f3c73a40',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = NOW();

-- Step 4: Create user_profiles table with correct structure (user_id as foreign key)
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
    
    -- Buddy matching fields
    interests TEXT[],
    age_range VARCHAR(20),
    timezone VARCHAR(50),
    preferred_communication VARCHAR(50),
    support_goals TEXT[],
    is_seeking_buddy BOOLEAN DEFAULT FALSE,
    is_available_as_buddy BOOLEAN DEFAULT TRUE,
    buddy_matching_preferences JSONB,
    
    CONSTRAINT unique_user_profile UNIQUE(user_id)
);

-- Step 5: Insert test user profiles with matching data
INSERT INTO public.user_profiles (user_id, display_name, interests, support_goals, is_available_as_buddy, is_seeking_buddy, age_range)
VALUES 
(
    '1d305467-70c4-4e65-a9d2-cead88516c49'::UUID,
    'xiaoting shen',
    ARRAY['mindfulness', 'exercise'],
    ARRAY['anxiety_management'],
    TRUE,
    TRUE,
    '18-25'
),
(
    'b30702a4-2099-4d40-8602-4aefd18c904b'::UUID,
    'Melson Wang', 
    ARRAY['mindfulness', 'exercise', 'reading', 'music'],
    ARRAY['anxiety_management', 'self_esteem'],
    TRUE,
    TRUE,
    '26-35'
);

-- Step 6: Create buddy system tables
CREATE TABLE public.buddy_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    paired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
    pairing_reason JSONB,
    ended_at TIMESTAMP WITH TIME ZONE,
    ended_by UUID REFERENCES public.users(id),
    end_reason TEXT,
    
    UNIQUE(user1_id, user2_id),
    CONSTRAINT no_self_buddy CHECK (user1_id != user2_id),
    CONSTRAINT ordered_pair CHECK (user1_id < user2_id)
);

CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buddy_pair_id UUID REFERENCES buddy_pairs(id) ON DELETE CASCADE,
    participant1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    participant2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    last_message_id UUID,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT false,
    
    UNIQUE(participant1_id, participant2_id),
    CONSTRAINT no_self_conversation CHECK (participant1_id != participant2_id),
    CONSTRAINT ordered_participants CHECK (participant1_id < participant2_id)
);

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    buddy_pair_id UUID REFERENCES buddy_pairs(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    
    CONSTRAINT no_self_message CHECK (sender_id != recipient_id)
);

-- Step 7: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON public.user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_seeking_buddy ON public.user_profiles(is_seeking_buddy);
CREATE INDEX IF NOT EXISTS idx_user_profiles_available_buddy ON public.user_profiles(is_available_as_buddy);
CREATE INDEX IF NOT EXISTS idx_users_id ON public.users(id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Step 8: Create array_intersect function for buddy matching
CREATE OR REPLACE FUNCTION array_intersect(anyarray, anyarray)
RETURNS anyarray
LANGUAGE sql
AS $$
    SELECT ARRAY(
        SELECT UNNEST($1)
        INTERSECT
        SELECT UNNEST($2)
    );
$$;

-- Step 9: Create buddy matching function
CREATE OR REPLACE FUNCTION find_potential_buddies(user_uuid UUID)
RETURNS TABLE (
    potential_buddy_id UUID,
    compatibility_score INTEGER,
    matching_interests TEXT[],
    matching_goals TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_info AS (
        SELECT interests, support_goals, age_range, timezone
        FROM user_profiles 
        WHERE user_id = user_uuid
    ),
    potential_matches AS (
        SELECT 
            up.user_id,
            up.interests,
            up.support_goals,
            (
                COALESCE(array_length(array_intersect(up.interests, ui.interests), 1), 0) * 3 +
                COALESCE(array_length(array_intersect(up.support_goals, ui.support_goals), 1), 0) * 5 +
                CASE WHEN up.age_range = ui.age_range THEN 2 ELSE 0 END +
                CASE WHEN up.timezone = ui.timezone THEN 1 ELSE 0 END
            ) AS score,
            array_intersect(up.interests, ui.interests) AS shared_interests,
            array_intersect(up.support_goals, ui.support_goals) AS shared_goals
        FROM user_profiles up
        CROSS JOIN user_info ui
        WHERE up.user_id != user_uuid
        AND up.is_available_as_buddy = true
        AND up.user_id NOT IN (
            SELECT CASE 
                WHEN user1_id = user_uuid THEN user2_id 
                ELSE user1_id 
            END
            FROM buddy_pairs 
            WHERE (user1_id = user_uuid OR user2_id = user_uuid) 
            AND status = 'active'
        )
    )
    SELECT 
        pm.user_id,
        pm.score,
        pm.shared_interests,
        pm.shared_goals
    FROM potential_matches pm
    WHERE pm.score > 0
    ORDER BY pm.score DESC
    LIMIT 10;
END;
$$;

-- Step 10: Create buddy pair function
CREATE OR REPLACE FUNCTION create_buddy_pair(user1_uuid UUID, user2_uuid UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    pair_id UUID;
    ordered_user1 UUID;
    ordered_user2 UUID;
BEGIN
    IF user1_uuid < user2_uuid THEN
        ordered_user1 := user1_uuid;
        ordered_user2 := user2_uuid;
    ELSE
        ordered_user1 := user2_uuid;
        ordered_user2 := user1_uuid;
    END IF;
    
    INSERT INTO buddy_pairs (user1_id, user2_id, pairing_reason)
    VALUES (
        ordered_user1, 
        ordered_user2,
        jsonb_build_object('matched_by', 'system', 'match_date', NOW())
    )
    RETURNING id INTO pair_id;
    
    INSERT INTO conversations (buddy_pair_id, participant1_id, participant2_id)
    VALUES (pair_id, ordered_user1, ordered_user2);
    
    RETURN pair_id;
END;
$$;

-- Step 11: Enable RLS with permissive policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddy_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Enable all access for user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable all access for users" ON public.users;
DROP POLICY IF EXISTS "Enable all access for buddy_pairs" ON public.buddy_pairs;
DROP POLICY IF EXISTS "Enable all access for conversations" ON public.conversations;
DROP POLICY IF EXISTS "Enable all access for messages" ON public.messages;

-- Create new policies
CREATE POLICY "Enable all access for user_profiles" ON public.user_profiles FOR ALL USING (true);
CREATE POLICY "Enable all access for users" ON public.users FOR ALL USING (true);
CREATE POLICY "Enable all access for buddy_pairs" ON public.buddy_pairs FOR ALL USING (true);
CREATE POLICY "Enable all access for conversations" ON public.conversations FOR ALL USING (true);
CREATE POLICY "Enable all access for messages" ON public.messages FOR ALL USING (true);

-- Step 12: Test the setup
SELECT 'Setup complete! Tables created and test users added.' as status;

SELECT 'Users in database:' as check_type, id, email, first_name, last_name 
FROM public.users;

SELECT 'User profiles:' as check_type, user_id, interests, support_goals, is_available_as_buddy
FROM public.user_profiles;