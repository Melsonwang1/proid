-- Create buddy_concerns table for reporting concerns about buddies
-- This table stores reports from users who are worried about their buddy's wellbeing

CREATE TABLE IF NOT EXISTS buddy_concerns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    buddy_name VARCHAR(255),
    concern_type VARCHAR(50) NOT NULL CHECK (concern_type IN (
        'self_harm',
        'crisis', 
        'inappropriate',
        'safety',
        'wellbeing',
        'other'
    )),
    urgency VARCHAR(20) NOT NULL CHECK (urgency IN (
        'immediate',
        'high',
        'medium',
        'low'
    )),
    description TEXT NOT NULL,
    context TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    wants_followup BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending',
        'reviewing',
        'resolved',
        'escalated',
        'closed'
    )),
    admin_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_buddy_concerns_reporter ON buddy_concerns(reporter_id);
CREATE INDEX IF NOT EXISTS idx_buddy_concerns_reported ON buddy_concerns(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_buddy_concerns_status ON buddy_concerns(status);
CREATE INDEX IF NOT EXISTS idx_buddy_concerns_urgency ON buddy_concerns(urgency);
CREATE INDEX IF NOT EXISTS idx_buddy_concerns_created ON buddy_concerns(created_at DESC);

-- Enable Row Level Security
ALTER TABLE buddy_concerns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create concern reports
CREATE POLICY "Users can create concern reports" ON buddy_concerns
    FOR INSERT
    WITH CHECK (auth.uid()::text = reporter_id::text OR reporter_id IS NOT NULL);

-- Policy: Users can view their own submitted reports
CREATE POLICY "Users can view own reports" ON buddy_concerns
    FOR SELECT
    USING (reporter_id = auth.uid() OR reporter_id::text = auth.uid()::text);

-- Policy: Allow anonymous inserts (for custom auth systems)
CREATE POLICY "Allow authenticated inserts" ON buddy_concerns
    FOR INSERT
    WITH CHECK (true);

-- Policy: Service role can do everything (for admin access)
CREATE POLICY "Service role full access" ON buddy_concerns
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_buddy_concerns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER buddy_concerns_updated_at
    BEFORE UPDATE ON buddy_concerns
    FOR EACH ROW
    EXECUTE FUNCTION update_buddy_concerns_updated_at();

-- Grant permissions
GRANT SELECT, INSERT ON buddy_concerns TO anon;
GRANT SELECT, INSERT ON buddy_concerns TO authenticated;

COMMENT ON TABLE buddy_concerns IS 'Stores reports from users who are concerned about their buddy''s wellbeing or safety';
COMMENT ON COLUMN buddy_concerns.concern_type IS 'Type of concern: self_harm, crisis, inappropriate, safety, wellbeing, other';
COMMENT ON COLUMN buddy_concerns.urgency IS 'Urgency level: immediate, high, medium, low';
COMMENT ON COLUMN buddy_concerns.is_anonymous IS 'Whether the reporter wants to remain anonymous to the reported user';
COMMENT ON COLUMN buddy_concerns.wants_followup IS 'Whether the reporter wants to receive follow-up from support team';
