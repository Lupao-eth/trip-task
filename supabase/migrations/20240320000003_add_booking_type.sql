-- Add booking_type column to bookings table
ALTER TABLE bookings
ADD COLUMN booking_type TEXT NOT NULL DEFAULT 'trip' CHECK (booking_type IN ('trip', 'task'));

-- Update existing bookings to have 'trip' as their type
UPDATE bookings
SET booking_type = 'trip'
WHERE booking_type IS NULL; 