import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { NavigationProps } from '../types';
import { Profile } from '../types';
import { profileService } from '../services/profileService';
import { bookingService } from '../services/bookingService';
import { Booking } from '../types';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';

interface AppLayoutProps {
  navigation: NavigationProps;
  title: string;
  children: React.ReactNode;
  profile?: Profile | null;
  headerRight?: React.ReactNode;
  headerLeft?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  navigation,
  title,
  children,
  profile: propProfile,
  headerRight,
  headerLeft,
}) => {
  const { signOut, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarAnim = useState(new Animated.Value(-300))[0];
  const [hasNewBookings, setHasNewBookings] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(propProfile || null);
  const route = useRoute();

  const isActive = (routeName: keyof RootStackParamList) => {
    return route.name === routeName ? styles.sidebarItemActive : null;
  };

  useEffect(() => {
    if (user) {
      checkNewBookings();
      // Set up an interval to check for new bookings every minute
      const interval = setInterval(checkNewBookings, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const loadProfile = async () => {
      if (user && !propProfile) {
        try {
          const { data, error } = await profileService.getProfile(user.id);
          if (error) {
            console.error('Error loading profile:', error);
          } else {
            setProfile(data);
          }
        } catch (error) {
          console.error('Error in loadProfile:', error);
        }
      }
    };

    loadProfile();
  }, [user, propProfile]);

  const checkNewBookings = async () => {
    try {
      const { data: bookings } = await bookingService.getUserBookings();
      if (bookings) {
        // Check if there are any pending bookings
        const hasPending = bookings.some(booking => 
          ['pending', 'accepted', 'on_the_way'].includes(booking.status)
        );
        setHasNewBookings(hasPending);
      }
    } catch (error) {
      console.error('Error checking new bookings:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleSidebar = () => {
    Animated.timing(sidebarAnim, {
      toValue: isSidebarOpen ? -300 : 0,
      duration: 300,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View 
        style={[
          styles.sidebar,
          { transform: [{ translateX: sidebarAnim }] }
        ]}
      >
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Menu</Text>
          <TouchableOpacity onPress={toggleSidebar} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.sidebarContent}>
          <TouchableOpacity 
            style={styles.sidebarItem} 
            onPress={() => {
              toggleSidebar();
              navigation.navigate('Home');
            }}
          >
            <Ionicons name="home-outline" size={24} color="#64748b" />
            <Text style={styles.sidebarItemText}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sidebarItem}
            onPress={() => {
              toggleSidebar();
              // TODO: Navigate to How It Works
              console.log('How It Works pressed');
            }}
          >
            <Ionicons name="information-circle-outline" size={24} color="#64748b" />
            <Text style={styles.sidebarItemText}>How It Works</Text>
          </TouchableOpacity>

          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarSectionTitle}>Book Now!</Text>
            
            <TouchableOpacity 
              style={styles.sidebarSubItem}
              onPress={() => {
                toggleSidebar();
                navigation.navigate('Trip');
              }}
            >
              <Ionicons name="bicycle" size={20} color="#64748b" />
              <Text style={styles.sidebarSubItemText}>Trip</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sidebarSubItem}
              onPress={() => {
                toggleSidebar();
                navigation.navigate('Task');
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#64748b" />
              <Text style={styles.sidebarSubItemText}>Task</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.sidebarItem}
            onPress={() => {
              toggleSidebar();
              navigation.navigate('BookingStatus');
            }}
          >
            <View style={styles.sidebarItemWithBadge}>
              <Ionicons name="time-outline" size={24} color="#64748b" />
              <Text style={styles.sidebarItemText}>Active Bookings</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sidebarItem, styles.sidebarItemSpaced]}
            onPress={() => {
              toggleSidebar();
              navigation.navigate('BookingHistory');
            }}
          >
            <View style={styles.sidebarItemWithBadge}>
              <Ionicons name="calendar-outline" size={24} color="#64748b" />
              <Text style={styles.sidebarItemText}>Booking History</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sidebarItem, styles.sidebarItemSpaced, isActive('Chat')]}
            onPress={() => {
              navigation.navigate('Chat');
              toggleSidebar();
            }}
          >
            <Ionicons 
              name="chatbubble-ellipses" 
              size={24} 
              color={route.name === 'Chat' ? '#3b82f6' : '#64748b'} 
            />
            <Text style={[
              styles.sidebarItemText,
              route.name === 'Chat' && { color: '#3b82f6' }
            ]}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.sidebarItem, styles.sidebarItemSpaced]}
            onPress={() => {
              toggleSidebar();
              // TODO: Navigate to Support
              console.log('Support pressed');
            }}
          >
            <Ionicons name="help-circle-outline" size={24} color="#64748b" />
            <Text style={styles.sidebarItemText}>Support</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sidebarItem}
            onPress={() => {
              toggleSidebar();
              // TODO: Navigate to Settings
              console.log('Settings pressed');
            }}
          >
            <Ionicons name="settings-outline" size={24} color="#64748b" />
            <Text style={styles.sidebarItemText}>Settings</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.sidebarFooter}>
          <TouchableOpacity 
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={24} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {isSidebarOpen && (
        <TouchableOpacity 
          style={styles.overlay} 
          onPress={toggleSidebar}
          activeOpacity={1}
        />
      )}

      <View style={styles.mainContent}>
        <View style={styles.header}>
          {headerLeft || (
            <TouchableOpacity onPress={toggleSidebar} style={styles.menuButton}>
              <Ionicons name="menu" size={24} color="#1e293b" />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>{title}</Text>
          {headerRight || <View style={styles.headerRight} />}
          
          <TouchableOpacity 
            style={styles.profileButton}
            activeOpacity={0.7}
            onPress={() => {
              console.log('Profile pressed');
            }}
          >
            <View style={styles.profileContent}>
              <View style={styles.profileIcon}>
                <Ionicons 
                  name="person-circle-outline" 
                  size={32} 
                  color="#3b82f6" 
                />
              </View>
              {profile?.username && (
                <Text style={styles.profileUsername} numberOfLines={1}>
                  {profile.username}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mainContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Platform.select({
      ios: 16,
      android: 16,
      web: 24,
    }),
    paddingTop: Platform.OS === 'ios' ? 0 : 48,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  menuButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  profileButton: {
    padding: 8,
    borderRadius: 20,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        ':hover': {
          backgroundColor: '#f1f5f9',
        },
      },
    }),
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.1)',
      },
    }),
  },
  profileUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    maxWidth: 120,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    backgroundColor: '#ffffff',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      ios: {
        paddingTop: 60,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        paddingTop: 40,
        elevation: 8,
      },
      web: {
        paddingTop: 24,
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    position: 'absolute',
    top: Platform.select({
      ios: 60,
      android: 40,
      web: 24,
    }),
    left: 0,
    right: 0,
    zIndex: 1,
  },
  sidebarContent: {
    flex: 1,
    paddingTop: Platform.select({
      ios: 120,
      android: 100,
      web: 80,
    }),
    paddingBottom: Platform.select({
      ios: 140,
      android: 120,
      web: 100,
    }),
    ...(Platform.OS === 'web' ? {
      overflowY: 'scroll',
      WebkitOverflowScrolling: 'touch',
    } : {}),
  },
  sidebarFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    position: 'absolute',
    bottom: Platform.select({
      ios: 40,
      android: 32,
      web: 24,
    }),
    left: 0,
    right: 0,
    zIndex: 1,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 8,
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sidebarItemSpaced: {
    marginTop: 8,
  },
  sidebarItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#64748b',
  },
  sidebarSection: {
    paddingVertical: Platform.select({
      ios: 8,
      android: 6,
      web: 8,
    }),
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sidebarSectionTitle: {
    fontSize: Platform.select({
      ios: 14,
      android: 13,
      web: 14,
    }),
    fontWeight: '600',
    color: '#94a3b8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  sidebarSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Platform.select({
      ios: 12,
      android: 10,
      web: 12,
    }),
    paddingLeft: 48,
    gap: 12,
  },
  sidebarSubItemText: {
    fontSize: Platform.select({
      ios: 15,
      android: 14,
      web: 15,
    }),
    color: '#64748b',
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Platform.select({
      ios: 14,
      android: 12,
      web: 14,
    }),
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    marginHorizontal: 8,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  signOutText: {
    fontSize: Platform.select({
      ios: 16,
      android: 15,
      web: 16,
    }),
    fontWeight: '600',
    color: '#ef4444',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  sidebarItemWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -4 }],
    padding: 4,
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  sidebarItemActive: {
    backgroundColor: '#f1f5f9',
  },
}); 