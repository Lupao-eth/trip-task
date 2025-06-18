-- Add foreign key constraint between bookings and profiles
ALTER TABLE bookings
ADD CONSTRAINT bookings_user_id_profiles_fkey
FOREIGN KEY (user_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

-- Create a view to join bookings with profiles
CREATE OR REPLACE VIEW booking_with_profile AS
SELECT 
    b.*,
    json_build_object(
        'id', p.id,
        'full_name', p.username,
        'avatar_url', p.avatar_url
    ) as user
FROM bookings b
LEFT JOIN profiles p ON b.user_id = p.id; 