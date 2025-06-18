-- Create the booking status enum type
CREATE TYPE booking_status AS ENUM (
  'pending',
  'accepted',
  'on_the_way',
  'completed',
  'cancelled'
);

-- Create the booking type enum type
CREATE TYPE booking_type AS ENUM (
  'trip',
  'task'
);

-- Create the bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  status booking_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  price DECIMAL(10,2),
  distance DECIMAL(10,2),
  duration INTEGER, -- in minutes
  is_asap BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  booking_type booking_type NOT NULL DEFAULT 'trip'
);

-- Add foreign key constraints
ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_user
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_rider
  FOREIGN KEY (rider_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_cancelled_by
  FOREIGN KEY (cancelled_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- Create an index on user_id for faster queries
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_rider_id_idx ON bookings(rider_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
CREATE INDEX IF NOT EXISTS bookings_scheduled_time_idx ON bookings(scheduled_time);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;
DROP POLICY IF EXISTS "Riders can update assigned bookings" ON bookings;
DROP POLICY IF EXISTS "Riders can accept pending bookings" ON bookings;

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

-- Allow users to create their own bookings
CREATE POLICY "Users can create their own bookings"
ON bookings FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own bookings
CREATE POLICY "Users can update their own bookings"
ON bookings FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = rider_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = rider_id);

-- Allow riders to update assigned bookings
CREATE POLICY "Riders can update assigned bookings"
ON bookings FOR UPDATE
USING (auth.uid() = rider_id)
WITH CHECK (auth.uid() = rider_id);

-- Allow riders to accept pending bookings
CREATE POLICY "Riders can accept pending bookings"
ON bookings FOR UPDATE
USING (
  status = 'pending' AND 
  rider_id IS NULL AND 
  EXISTS (
    SELECT 1 FROM rider_profiles 
    WHERE user_id = auth.uid() 
    AND is_available = true
  )
)
WITH CHECK (
  status = 'accepted' AND 
  rider_id = auth.uid()
);

-- Grant necessary permissions
GRANT ALL ON bookings TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check if a user can send messages for a booking
CREATE OR REPLACE FUNCTION can_send_message(user_id UUID, booking_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bookings
    WHERE id = booking_id
    AND (bookings.user_id = user_id OR bookings.rider_id = user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies for messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view messages for their bookings
CREATE POLICY "Users can view messages for their bookings"
ON messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM bookings
        WHERE bookings.id = messages.booking_id
        AND (bookings.user_id = auth.uid() OR bookings.rider_id = auth.uid())
    )
);

-- Policy to allow users to insert messages for their bookings
CREATE POLICY "Users can insert messages for their bookings"
ON messages FOR INSERT
WITH CHECK (
    can_send_message(auth.uid(), booking_id)
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION can_send_message TO authenticated;
GRANT SELECT, INSERT ON messages TO authenticated;

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their bookings"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = messages.booking_id
      AND (bookings.user_id = auth.uid() OR bookings.rider_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages for their bookings"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = messages.booking_id
      AND (bookings.user_id = auth.uid() OR bookings.rider_id = auth.uid())
    )
  );

-- Grant necessary permissions
GRANT ALL ON messages TO authenticated;
GRANT EXECUTE ON FUNCTION can_send_message TO authenticated;

-- Create the accept_booking function
CREATE OR REPLACE FUNCTION accept_booking(booking_id UUID)
RETURNS void AS $$
DECLARE
  current_user_id UUID;
  rider_profile_exists BOOLEAN;
  booking_exists BOOLEAN;
BEGIN
  -- Get the current user's ID
  current_user_id := auth.uid();
  
  -- Check if the user has a rider profile and is available
  SELECT EXISTS (
    SELECT 1 FROM rider_profiles 
    WHERE user_id = current_user_id 
    AND is_available = true
  ) INTO rider_profile_exists;
  
  IF NOT rider_profile_exists THEN
    RAISE EXCEPTION 'User is not an available rider';
  END IF;

  -- Check if the booking exists and is available
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE id = booking_id
    AND status = 'pending'
    AND rider_id IS NULL
  ) INTO booking_exists;

  IF NOT booking_exists THEN
    RAISE EXCEPTION 'Booking is not available for acceptance';
  END IF;
  
  -- Update the booking
  UPDATE bookings
  SET 
    status = 'accepted',
    rider_id = current_user_id,
    updated_at = NOW()
  WHERE 
    id = booking_id
    AND status = 'pending'
    AND rider_id IS NULL;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update booking';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_booking TO authenticated; 