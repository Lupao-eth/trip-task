import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { riderService } from '../services/riderService';
import { RiderProfile } from '../types/profile';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

interface RiderStatus {
  isAvailable: boolean;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
}

interface RiderContextType {
  riderProfile: RiderProfile | null;
  riderStatus: RiderStatus | null;
  isLoading: boolean;
  error: string | null;
  refreshRiderStatus: () => Promise<void>;
  isRider: boolean;
}

const RiderContext = createContext<RiderContextType | undefined>(undefined);

// Check if we're in the rider app
const isRiderApp = Platform.OS === 'web' 
  ? window.location.hostname.includes('rider')
  : false;

const getStoredCheckStatus = (userId: string): boolean => {
  if (Platform.OS === 'web') {
    const stored = localStorage.getItem(`rider_check_${userId}`);
    return stored === 'true';
  }
  return false;
};

const setStoredCheckStatus = (userId: string, status: boolean) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(`rider_check_${userId}`, status.toString());
  }
};

export const RiderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [riderProfile, setRiderProfile] = useState<RiderProfile | null>(null);
  const [riderStatus, setRiderStatus] = useState<RiderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRider, setIsRider] = useState(false);

  const checkRiderProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('rider_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error checking rider profile:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('Error in checkRiderProfile:', err);
      return false;
    }
  }, []);

  const refreshRiderStatus = useCallback(async () => {
    if (!user) {
      setRiderProfile(null);
      setRiderStatus(null);
      setIsRider(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    let didTimeout = false;
    const timeout = setTimeout(() => {
      didTimeout = true;
      setIsLoading(false);
      setError('Could not connect to server. Please check your internet connection or try again later.');
    }, 10000); // 10 seconds

    try {
      // First check if user exists in rider_profiles
      const isRiderUser = await checkRiderProfile(user.id);
      if (didTimeout) return;
      setIsRider(isRiderUser);

      if (isRiderUser) {
        const { profile } = await riderService.isRider();
        if (didTimeout) return;
        setRiderProfile(profile);

        if (profile) {
          setRiderStatus({
            isAvailable: true,
          });
        } else {
          setRiderStatus(null);
        }
      } else {
        setRiderProfile(null);
        setRiderStatus(null);
      }
      setError(null);
    } catch (err) {
      if (!didTimeout) {
        setError('Could not connect to server. Please check your internet connection or try again later.');
      }
    } finally {
      if (!didTimeout) {
        setIsLoading(false);
        clearTimeout(timeout);
      }
    }
  }, [user, checkRiderProfile]);

  useEffect(() => {
    if (user) {
      refreshRiderStatus();
    } else {
      setRiderProfile(null);
      setRiderStatus(null);
      setIsRider(false);
      setIsLoading(false);
      setError(null);
    }
  }, [user, refreshRiderStatus]);

  const value = {
    riderProfile,
    riderStatus,
    isLoading,
    error,
    refreshRiderStatus,
    isRider,
  };

  return <RiderContext.Provider value={value}>{children}</RiderContext.Provider>;
};

export const useRider = () => {
  const context = useContext(RiderContext);
  if (context === undefined) {
    throw new Error('useRider must be used within a RiderProvider');
  }
  return context;
}; 