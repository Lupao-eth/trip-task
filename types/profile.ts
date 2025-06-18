export interface RiderProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  vehicle_type: string;
  vehicle_plate: string;
  is_available: boolean;
  current_location: string | null;
  rating: number;
  total_trips: number;
  created_at: string;
  updated_at: string;
} 