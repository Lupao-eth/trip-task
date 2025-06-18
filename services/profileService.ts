import { supabase } from '../lib/supabase';
import { Profile } from '../types';

export const profileService = {
  async getProfile(userId: string): Promise<{ data: Profile | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Unknown error occurred') };
    }
  },

  async upsertProfile(profile: { id: string; username: string; avatar_url?: string | null }): Promise<{ data: Profile | null; error: Error | null }> {
    try {
      const updatedAt = new Date().toISOString();

      // First try to get the existing profile
      const { data: existingProfile, error: getError } = await this.getProfile(profile.id);

      if (getError && !getError.message.includes('no rows')) {
        return { data: null, error: getError };
      }

      // If profile exists, update it
      if (existingProfile) {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            username: profile.username,
            avatar_url: profile.avatar_url || null,
            updated_at: updatedAt,
          })
          .eq('id', profile.id)
          .select()
          .single();

        if (error) {
          return { data: null, error: new Error(error.message) };
        }

        return { data, error: null };
      }

      // If profile doesn't exist, insert it
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url || null,
          updated_at: updatedAt,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Unknown error occurred') };
    }
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<{ data: Profile | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Unknown error occurred') };
    }
  },
}; 