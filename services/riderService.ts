import { supabase } from '../lib/supabase';
import { Booking, BookingWithUser } from '../types/booking';
import { RiderProfile } from '../types/profile';
import { RealtimeChannel } from '@supabase/supabase-js';

export const riderService = {
  async isRider(): Promise<{ isRider: boolean; profile: RiderProfile | null; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { isRider: false, profile: null, error: null };
      }

      const { data, error } = await supabase
        .from('rider_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return { isRider: false, profile: null, error: null };
        }
        return { isRider: false, profile: null, error: error as Error };
      }

      if (!data) {
        return { isRider: false, profile: null, error: null };
      }

      return { isRider: true, profile: data as RiderProfile, error: null };
    } catch (error) {
      return { isRider: false, profile: null, error: error as Error };
    }
  },

  async getActiveBookings(): Promise<{ data: BookingWithUser[] | null; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // First check if user is a rider
      const { isRider } = await this.isRider();
      if (!isRider) {
        throw new Error('User is not a rider');
      }

      // First get the bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('rider_id', user.id)
        .in('status', ['accepted', 'on_the_way']);

      if (bookingsError) {
        throw bookingsError;
      }

      if (!bookings || bookings.length === 0) {
        return { data: [], error: null };
      }

      // Then get the user profiles for these bookings
      const userIds = bookings.map(booking => booking.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, updated_at')
        .in('id', userIds);

      if (profilesError) {
        throw profilesError;
      }

      // Create a map of user profiles for easy lookup
      const profileMap = new Map(
        profiles?.map(profile => [profile.id, profile]) || []
      );

      // Transform the data to match BookingWithUser type
      const transformedData = bookings.map(booking => ({
        ...booking,
        user: {
          id: booking.user_id,
          username: profileMap.get(booking.user_id)?.username || 'Unknown User',
          avatar_url: profileMap.get(booking.user_id)?.avatar_url || null,
          updated_at: profileMap.get(booking.user_id)?.updated_at || new Date().toISOString()
        }
      }));

      return { data: transformedData, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  async getAvailableBookings(): Promise<{ data: BookingWithUser[] | null; error: Error | null }> {
    try {
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Not authenticated');
      }

      // Check if user is a rider
      const { isRider, error: riderError } = await this.isRider();
      if (riderError || !isRider) {
        throw new Error('User is not a rider');
      }

      // First get the bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'pending')
        .is('rider_id', null)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        throw bookingsError;
      }

      if (!bookings || bookings.length === 0) {
        return { data: [], error: null };
      }

      // Then get the user profiles for these bookings
      const userIds = bookings.map(booking => booking.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        throw profilesError;
      }

      // Create a map of user profiles for easy lookup
      const profileMap = new Map(
        profiles?.map(profile => [profile.id, profile]) || []
      );

      // Transform the data to match BookingWithUser type
      const transformedData = bookings.map(booking => ({
        ...booking,
        user: {
          id: booking.user_id,
          username: booking.name || profileMap.get(booking.user_id)?.username || 'Unknown User',
          avatar_url: profileMap.get(booking.user_id)?.avatar_url || null
        }
      }));

      return { data: transformedData, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Unknown error occurred') 
      };
    }
  },

  async acceptBooking(bookingId: string): Promise<{ error: Error | null }> {
    try {
      // 1. Verify auth.uid()
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw authError;
      }
      if (!user) {
        throw new Error('Not authenticated');
      }

      // 2. Verify rider profile with detailed check
      const { data: riderProfile, error: riderProfileError } = await supabase
        .from('rider_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (riderProfileError) {
        throw riderProfileError;
      }

      if (!riderProfile || !riderProfile.is_available) {
        throw new Error('User is not an available rider');
      }

      // 3. Call the database function to accept the booking
      const { error: functionError } = await supabase
        .rpc('accept_booking', {
          booking_id: bookingId
        });

      if (functionError) {
        throw functionError;
      }

      // 4. Verify update
      const { data: updatedBooking, error: verifyError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (verifyError) {
        throw verifyError;
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async subscribeToBookings(callback: (payload: any) => void): Promise<RealtimeChannel> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // First check if user is a rider
    const { isRider } = await this.isRider();
    if (!isRider) {
      throw new Error('User is not a rider');
    }

    return supabase
      .channel('bookings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `rider_id=eq.${user.id}`
        },
        callback
      )
      .subscribe();
  },

  async getCompletedBookings(): Promise<{ data: Booking[] | null; error: Error | null }> {
    try {
      // First get the completed bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;
      if (!bookings) return { data: [], error: null };

      // Get unique user IDs from the bookings
      const userIds = [...new Set(bookings.map(booking => booking.user_id))];

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine bookings with user profiles
      const transformedData = bookings.map(booking => ({
        ...booking,
        user: profiles?.find(profile => profile.id === booking.user_id) || null
      }));

      return { data: transformedData, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },
}; 