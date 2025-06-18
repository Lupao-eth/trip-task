-- Add foreign key constraints for bookings table
ALTER TABLE bookings
ADD CONSTRAINT bookings_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE bookings
ADD CONSTRAINT bookings_rider_id_fkey
FOREIGN KEY (rider_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;

-- Create a view to join bookings with user profiles
CREATE OR REPLACE VIEW booking_with_user AS
SELECT 
    b.*,
    json_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'avatar_url', p.avatar_url
    ) as user
FROM bookings b
LEFT JOIN profiles p ON b.user_id = p.id; 