-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;
DROP POLICY IF EXISTS "Riders can update assigned bookings" ON bookings;

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create new policies with proper permissions
-- Allow users to view their own bookings (as customer or rider)
CREATE POLICY "Users can view their own bookings"
ON bookings FOR SELECT
USING (
  auth.uid() = user_id OR 
  auth.uid() = rider_id
);

-- Allow authenticated users to create bookings
CREATE POLICY "Authenticated users can create bookings"
ON bookings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own bookings (as customer)
CREATE POLICY "Users can update their own bookings"
ON bookings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow riders to update bookings assigned to them
CREATE POLICY "Riders can update assigned bookings"
ON bookings FOR UPDATE
TO authenticated
USING (auth.uid() = rider_id)
WITH CHECK (auth.uid() = rider_id);

-- Grant necessary permissions
GRANT ALL ON bookings TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated; 