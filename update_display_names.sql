-- Update existing user_profiles with display_name from users table
-- Run this once to backfill existing profiles

-- Update user_profiles where display_name is NULL or empty
UPDATE user_profiles
SET display_name = TRIM(CONCAT(u.first_name, ' ', u.last_name))
FROM users u
WHERE user_profiles.user_id = u.id
  AND (user_profiles.display_name IS NULL OR user_profiles.display_name = '');

-- Create user_profiles for users who don't have one yet
INSERT INTO user_profiles (user_id, display_name, is_active, is_available_as_buddy, is_seeking_buddy)
SELECT 
    u.id,
    TRIM(CONCAT(u.first_name, ' ', u.last_name)),
    true,
    true,
    false
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.user_id = u.id
);

-- Verify the update
SELECT 
    up.user_id,
    up.display_name,
    u.first_name,
    u.last_name,
    u.email
FROM user_profiles up
JOIN users u ON up.user_id = u.id
ORDER BY up.user_id;
