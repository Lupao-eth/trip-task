import { supabase } from '../lib/supabase';

export type BookingStatus = 'pending' | 'accepted' | 'on_the_way' | 'completed' | 'cancelled';
export type BookingType = 'trip' | 'task';

export interface Booking {
  id: string;
  user_id: string;
  rider_id: string | null;
  pickup_location: string;
  dropoff_location: string;
  scheduled_time: string | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
  notes: string | null;
  price: number | null;
  distance: number | null;
  duration: number | null;
  is_asap: boolean;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  booking_type: BookingType;
  name: string;
}

export interface CreateBookingData {
  pickup_location: string;
  dropoff_location: string;
  scheduled_time?: string;
  notes?: string;
  is_asap?: boolean;
  booking_type: BookingType;
  name: string;
}

export interface UpdateBookingData {
  status?: BookingStatus;
  notes?: string;
  price?: number;
  distance?: number;
  duration?: number;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
}

export const bookingService = {
  async createBooking(data: CreateBookingData): Promise<{ data: Booking | null; error: Error | null }> {
    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { data: null, error: new Error('User not authenticated') };
      }

      const { data: booking, error } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          pickup_location: data.pickup_location,
          dropoff_location: data.dropoff_location,
          scheduled_time: data.scheduled_time,
          notes: data.notes,
          is_asap: data.is_asap,
          booking_type: data.booking_type,
          name: data.name
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: booking, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Unknown error occurred') };
    }
  },

  async getBooking(id: string): Promise<{ data: Booking | null; error: Error | null }> {
    try {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: booking, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Unknown error occurred') };
    }
  },

  async getUserBookings(status?: BookingStatus): Promise<{ data: Booking[] | null; error: Error | null }> {
    try {
      let query = supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: bookings, error } = await query;

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: bookings, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Unknown error occurred') };
    }
  },

  async updateBooking(id: string, data: UpdateBookingData): Promise<Booking> {
    const { data: booking, error } = await supabase
      .from('bookings')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return booking;
  },

  async cancelBooking(id: string, reason: string): Promise<{ data: Booking | null; error: Error | null }> {
    try {
      const { data: booking, error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: (await supabase.auth.getUser()).data.user?.id,
          cancellation_reason: reason,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: booking, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Unknown error occurred') };
    }
  },

  async completeBooking(id: string): Promise<{ data: Booking | null; error: Error | null }> {
    try {
      const { data: booking, error } = await supabase
        .from('bookings')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: booking, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Unknown error occurred') };
    }
  },

  async acceptBooking(id: string, riderId: string): Promise<{ data: Booking | null; error: Error | null }> {
    try {
      const { data: booking, error } = await supabase
        .from('bookings')
        .update({
          status: 'accepted',
          rider_id: riderId,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: booking, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Unknown error occurred') };
    }
  },

  async startTrip(id: string): Promise<{ data: Booking | null; error: Error | null }> {
    try {
      const { data: booking, error } = await supabase
        .from('bookings')
        .update({
          status: 'on_the_way',
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: booking, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Unknown error occurred') };
    }
  },
}; 