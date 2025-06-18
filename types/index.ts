import { Session, User } from '@supabase/supabase-js';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Booking, BookingStatus } from '../services/bookingService';

export type { Booking, BookingStatus } from '../services/bookingService';

export interface Profile {
  id: string;
  username: string;
  avatar_url?: string | null;
  updated_at?: string;
}

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Home: undefined;
  Trip: undefined;
  Task: undefined;
  BookingStatus: undefined;
  BookingHistory: undefined;
  BookingDetails: { bookingId: string };
  Chat: { bookingId: string };
  // Rider screens
  RiderHome: undefined;
  AvailableBookings: undefined;
  ActiveBookings: undefined;
  RiderProfile: undefined;
};

export type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

export type BookingType = 'trip' | 'task';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export interface RiderContextType {
  isRider: boolean;
  riderProfile: {
    id: string;
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    phone_number: string;
    vehicle_type: string;
    vehicle_plate: string;
    is_available: boolean;
    current_location: string | null;
    rating: number;
    total_trips: number;
    created_at: string;
    updated_at: string;
  } | null;
  loading: boolean;
  error: string | null;
  refreshRiderStatus: () => Promise<void>;
} 