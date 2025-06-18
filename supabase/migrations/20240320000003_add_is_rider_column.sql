-- Add is_rider column to profiles table
ALTER TABLE profiles
ADD COLUMN is_rider BOOLEAN DEFAULT false;

-- Update existing profiles to set is_rider based on rider_profiles
UPDATE profiles p
SET is_rider = true
WHERE EXISTS (
  SELECT 1 FROM rider_profiles rp
  WHERE rp.user_id = p.id
);

-- Create index for faster lookups
CREATE INDEX profiles_is_rider_idx ON profiles(is_rider); 