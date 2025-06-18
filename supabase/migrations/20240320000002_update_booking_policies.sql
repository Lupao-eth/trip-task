-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;

-- Create new policy that allows riders to see pending bookings
CREATE POLICY "Users can view their own bookings and riders can see pending bookings"
ON bookings FOR SELECT
USING (
  auth.uid() = user_id OR 
  auth.uid() = rider_id OR
  (
    status = 'pending' AND 
    rider_id IS NULL AND
    EXISTS (
      SELECT 1 FROM rider_profiles 
      WHERE rider_profiles.user_id = auth.uid()
    )
  )
); 