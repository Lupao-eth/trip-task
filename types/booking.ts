import { Booking as BaseBooking } from '../services/bookingService';

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Booking extends BaseBooking {
  user: UserProfile;
  rider: UserProfile | null;
}

export type BookingWithUser = Booking; 