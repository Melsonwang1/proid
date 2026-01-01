-- EASE Platform: Buddy Matching and Messaging System
-- PostgreSQL Schema for Supabase

-- User profiles table for additional buddy matching fields (extends existing users table)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional fields for buddy matching
    bio TEXT,
    interests TEXT[], -- Array of interests for matching
    age_range TEXT CHECK (age_range IN ('18-25', '26-35', '36-45', '46-55', '55+')),
    timezone TEXT,
    preferred_communication TEXT CHECK (preferred_communication IN ('text', 'voice', 'video', 'any')),
    support_goals TEXT[], -- What they want support with
    is_seeking_buddy BOOLEAN DEFAULT false,
    is_available_as_buddy BOOLEAN DEFAULT false,
    buddy_matching_preferences JSONB -- Store complex matching preferences
);

-- Buddy matching requests/preferences table
CREATE TABLE buddy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN ('seeking', 'offering', 'both')),
    preferences JSONB NOT NULL, -- Matching criteria preferences
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'fulfilled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, request_type)
);

-- Buddy pairs/relationships table
CREATE TABLE buddy_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    paired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
    pairing_reason JSONB, -- Why they were matched (interests, goals, etc.)
    ended_at TIMESTAMP WITH TIME ZONE,
    ended_by UUID REFERENCES auth.users(id),
    end_reason TEXT,
    
    -- Ensure no duplicate pairs and prevent self-pairing
    UNIQUE(user1_id, user2_id),
    CONSTRAINT no_self_buddy CHECK (user1_id != user2_id),
    CONSTRAINT ordered_pair CHECK (user1_id < user2_id) -- Ensure consistent ordering
);

-- Messages table for communication between users
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    buddy_pair_id UUID REFERENCES buddy_pairs(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    
    -- Prevent self-messaging
    CONSTRAINT no_self_message CHECK (sender_id != recipient_id)
);

-- Message reactions table (optional - for emoji reactions)
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction TEXT NOT NULL, -- emoji or reaction type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(message_id, user_id, reaction)
);

-- Conversation threads table (for grouping messages)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buddy_pair_id UUID REFERENCES buddy_pairs(id) ON DELETE CASCADE,
    participant1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    participant2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message_id UUID REFERENCES messages(id),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT false,
    
    UNIQUE(participant1_id, participant2_id),
    CONSTRAINT no_self_conversation CHECK (participant1_id != participant2_id),
    CONSTRAINT ordered_participants CHECK (participant1_id < participant2_id)
);

-- Indexes for better performance
CREATE INDEX idx_user_profiles_seeking_buddy ON user_profiles(is_seeking_buddy);
CREATE INDEX idx_user_profiles_available_buddy ON user_profiles(is_available_as_buddy);
CREATE INDEX idx_user_profiles_interests ON user_profiles USING GIN(interests);
CREATE INDEX idx_user_profiles_support_goals ON user_profiles USING GIN(support_goals);
CREATE INDEX idx_buddy_requests_user_id ON buddy_requests(user_id);
CREATE INDEX idx_buddy_requests_status ON buddy_requests(status);
CREATE INDEX idx_buddy_pairs_user1 ON buddy_pairs(user1_id);
CREATE INDEX idx_buddy_pairs_user2 ON buddy_pairs(user2_id);
CREATE INDEX idx_buddy_pairs_status ON buddy_pairs(status);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_buddy_pair ON messages(buddy_pair_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_conversations_participants ON conversations(participant1_id, participant2_id);
CREATE INDEX idx_conversations_last_activity ON conversations(last_activity DESC);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- User profiles can be viewed/updated by the owner
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view profiles of potential buddies" ON user_profiles
    FOR SELECT USING (is_available_as_buddy = true);

-- Buddy requests policies
CREATE POLICY "Users can manage their own buddy requests" ON buddy_requests
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view active buddy requests for matching" ON buddy_requests
    FOR SELECT USING (status = 'active' AND request_type IN ('offering', 'both'));

-- Buddy pairs policies
CREATE POLICY "Users can view their own buddy relationships" ON buddy_pairs
    FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can update their own buddy relationships" ON buddy_pairs
    FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages policies
CREATE POLICY "Users can view messages they sent or received" ON messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own messages" ON messages
    FOR UPDATE USING (auth.uid() = sender_id);

-- Message reactions policies
CREATE POLICY "Users can manage reactions to messages they can see" ON message_reactions
    FOR ALL USING (
        auth.uid() = user_id AND 
        message_id IN (
            SELECT id FROM messages 
            WHERE sender_id = auth.uid() OR recipient_id = auth.uid()
        )
    );

-- Conversations policies
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

-- Functions for buddy matching algorithm
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
        WHERE id = user_uuid
    ),
    potential_matches AS (
        SELECT 
            up.id,
            up.interests,
            up.support_goals,
            -- Calculate compatibility score based on shared interests and goals
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
        WHERE up.id != user_uuid
        AND up.is_available_as_buddy = true
        AND up.id NOT IN (
            -- Exclude users already paired
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
        pm.id,
        pm.score,
        pm.shared_interests,
        pm.shared_goals
    FROM potential_matches pm
    WHERE pm.score > 0
    ORDER BY pm.score DESC
    LIMIT 10;
END;
$$;

-- Function to create a buddy pair
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
    -- Ensure consistent ordering (smaller UUID first)
    IF user1_uuid < user2_uuid THEN
        ordered_user1 := user1_uuid;
        ordered_user2 := user2_uuid;
    ELSE
        ordered_user1 := user2_uuid;
        ordered_user2 := user1_uuid;
    END IF;
    
    -- Create the buddy pair
    INSERT INTO buddy_pairs (user1_id, user2_id, pairing_reason)
    VALUES (
        ordered_user1, 
        ordered_user2,
        jsonb_build_object(
            'matched_by', 'system',
            'match_date', NOW()
        )
    )
    RETURNING id INTO pair_id;
    
    -- Create conversation thread
    INSERT INTO conversations (buddy_pair_id, participant1_id, participant2_id)
    VALUES (pair_id, ordered_user1, ordered_user2);
    
    -- Update buddy request statuses
    UPDATE buddy_requests 
    SET status = 'fulfilled', updated_at = NOW()
    WHERE user_id IN (user1_uuid, user2_uuid) AND status = 'active';
    
    RETURN pair_id;
END;
$$;

-- Function to send a message
CREATE OR REPLACE FUNCTION send_message(
    sender_uuid UUID, 
    recipient_uuid UUID, 
    message_content TEXT,
    msg_type TEXT DEFAULT 'text'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    message_id UUID;
    conversation_id UUID;
    pair_id UUID;
BEGIN
    -- Find the buddy pair and conversation
    SELECT bp.id, c.id 
    INTO pair_id, conversation_id
    FROM buddy_pairs bp
    JOIN conversations c ON c.buddy_pair_id = bp.id
    WHERE (bp.user1_id = sender_uuid AND bp.user2_id = recipient_uuid)
       OR (bp.user1_id = recipient_uuid AND bp.user2_id = sender_uuid)
    AND bp.status = 'active';
    
    -- Insert the message
    INSERT INTO messages (sender_id, recipient_id, buddy_pair_id, content, message_type)
    VALUES (sender_uuid, recipient_uuid, pair_id, message_content, msg_type)
    RETURNING id INTO message_id;
    
    -- Update conversation last activity and last message
    UPDATE conversations 
    SET last_message_id = message_id, last_activity = NOW()
    WHERE id = conversation_id;
    
    RETURN message_id;
END;
$$;

-- Trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_buddy_requests_updated_at BEFORE UPDATE ON buddy_requests
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Helper function to get array intersection (if not available)
CREATE OR REPLACE FUNCTION array_intersect(a1 TEXT[], a2 TEXT[])
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ARRAY(
        SELECT unnest(a1)
        INTERSECT
        SELECT unnest(a2)
    );
$$;

-- Sample data for testing (optional)
-- You can uncomment this to add some test data

/*
-- Sample interests and goals
INSERT INTO users (id, email, first_name, last_name, interests, support_goals, age_range, is_seeking_buddy, is_available_as_buddy) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'alice@example.com', 'Alice', 'Johnson', 
 ARRAY['mindfulness', 'exercise', 'reading'], 
 ARRAY['anxiety_management', 'stress_relief'], 
 '26-35', true, true),
('550e8400-e29b-41d4-a716-446655440002', 'bob@example.com', 'Bob', 'Smith',
 ARRAY['exercise', 'music', 'travel'],
 ARRAY['depression_support', 'motivation'],
 '26-35', true, true);

-- Sample buddy request
INSERT INTO buddy_requests (user_id, request_type, preferences) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'seeking', 
 '{"age_range": ["26-35", "36-45"], "interests": ["exercise", "mindfulness"], "goals": ["anxiety_management"]}');
*/

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;