import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, RefreshControl, Platform, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { riderService } from '../services/riderService';
import { BookingWithUser } from '../types/booking';
import ChatPanel from '../components/ChatPanel';
import { useAuth } from '../contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { NavigationProps } from '../types';
import { format, parseISO } from 'date-fns';

const { width } = Dimensions.get('window');

const ActiveBookingsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'available' | 'chat' | 'completed'>('active');
  const [activeBookings, setActiveBookings] = useState<BookingWithUser[]>([]);
  const [availableBookings, setAvailableBookings] = useState<BookingWithUser[]>([]);
  const [completedBookings, setCompletedBookings] = useState<BookingWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRider, setIsRider] = useState<boolean | null>(null);
  const navigation = useNavigation<NavigationProps>();
  const { user } = useAuth();

  const checkRiderStatus = async () => {
    try {
      const { isRider, error } = await riderService.isRider();
      if (error) throw error;
      setIsRider(isRider);
      return isRider;
    } catch (err) {
      console.error('Error checking rider status:', err);
      setError('Failed to verify rider status');
      return false;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const isRiderUser = await checkRiderStatus();
      if (!isRiderUser) {
        setError('This app is for riders only. Please use the customer app instead.');
        return;
      }

      // Load both active, available, and completed bookings
      const [activeResult, availableResult, completedResult] = await Promise.all([
        riderService.getActiveBookings(),
        riderService.getAvailableBookings(),
        riderService.getCompletedBookings()
      ]);

      if (activeResult.error) throw activeResult.error;
      if (availableResult.error) throw availableResult.error;
      if (completedResult.error) throw completedResult.error;

      setActiveBookings(activeResult.data || []);
      setAvailableBookings(availableResult.data || []);
      setCompletedBookings(completedResult.data || []);

      // Update selected booking if it exists
      if (selectedBooking) {
        const updatedBooking = activeResult.data?.find(b => b.id === selectedBooking.id);
        if (updatedBooking) {
          setSelectedBooking(updatedBooking);
        }
      }
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError('Failed to load bookings. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    let subscription: RealtimeChannel | null = null;
    
    const setupSubscription = async () => {
      try {
        const isRiderUser = await checkRiderStatus();
        if (!isRiderUser) return;

        subscription = await riderService.subscribeToBookings((payload) => {
          loadData();
        });
      } catch (error) {
        console.error('Error setting up subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleBookingPress = (booking: BookingWithUser) => {
    setSelectedBooking(booking);
  };

  const handleCloseChat = () => {
    setSelectedBooking(null);
  };

  const handleAcceptBooking = async (bookingId: string) => {
    try {
      setLoading(true);
      const { error } = await riderService.acceptBooking(bookingId);
      if (error) throw error;
      
      await loadData();
    } catch (error) {
      console.error('Error accepting booking:', error);
      Alert.alert('Error', 'Failed to accept booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (booking: BookingWithUser) => {
    if (activeTab === 'chat') {
      navigation.navigate('Chat', { bookingId: booking.id });
    } else {
      navigation.navigate('BookingDetails', { bookingId: booking.id });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return '#f97316'; // Orange
      case 'on_the_way':
        return '#3b82f6'; // Blue
      case 'completed':
        return '#10b981'; // Green
      case 'cancelled':
        return '#ef4444'; // Red
      default:
        return '#64748b'; // Gray
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'on_the_way':
        return 'On the way';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const getBookingTypeLabel = (type: string) => {
    switch (type) {
      case 'task':
        return 'Task';
      case 'trip':
        return 'Trip';
      default:
        return 'Booking';
    }
  };

  const renderBookingCard = (booking: BookingWithUser) => {
    const isRider = booking.rider_id === user?.id;
    const otherUser = isRider ? booking.user : booking.rider;
    const isAvailable = booking.status === 'pending' && !booking.rider_id;
    const isActive = booking.status === 'accepted' || booking.status === 'on_the_way';
    const isCompleted = booking.status === 'completed';
    const isCancelled = booking.status === 'cancelled';

    return (
      <View key={booking.id} style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.username}>{booking.name || otherUser?.username || 'Unknown User'}</Text>
            <Text style={styles.bookingType}>
              {booking.booking_type === 'trip' ? 'Trip' : 'Task'}
            </Text>
          </View>
          <Text style={[
            styles.statusText,
            isAvailable && styles.statusAvailable,
            isActive && styles.statusActive,
            isCompleted && styles.statusCompleted,
            isCancelled && styles.statusCancelled
          ]}>
            {booking.status}
          </Text>
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#f97316" />
            <Text style={styles.locationText} numberOfLines={1}>
              {booking.pickup_location}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#f97316" />
            <Text style={styles.locationText} numberOfLines={1}>
              {booking.dropoff_location}
            </Text>
          </View>
        </View>

        <View style={styles.bookingFooter}>
          <Text style={styles.timeText}>
            {booking.scheduled_time ? format(parseISO(booking.scheduled_time), 'MMM d, h:mm a') : 'ASAP'}
          </Text>
          <View style={styles.bookingActions}>
            {activeTab === 'chat' ? (
              <TouchableOpacity
                style={[styles.viewButton, styles.chatButton]}
                onPress={() => handleViewDetails(booking)}
              >
                <Ionicons name="chatbubble" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.viewButtonText}>Chat</Text>
              </TouchableOpacity>
            ) : (
              <>
                {isAvailable && (
                  <TouchableOpacity
                    style={[styles.viewButton, styles.acceptButton]}
                    onPress={() => handleAcceptBooking(booking.id)}
                  >
                    <Text style={styles.viewButtonText}>Accept</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.viewButton, !isAvailable && styles.viewDetailsButton]}
                  onPress={() => handleViewDetails(booking)}
                >
                  <Text style={styles.viewButtonText}>View Details</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderBookings = () => {
    switch (activeTab) {
      case 'active':
        return activeBookings;
      case 'available':
        return availableBookings;
      case 'completed':
        return completedBookings;
      case 'chat':
        return activeBookings;
      default:
        return [];
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        {error.includes('This app is for riders only') ? (
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => navigation.navigate('Login' as never)}
          >
            <Text style={styles.retryButtonText}>Go to Login</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: 32 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('RiderHome')}>
          <Ionicons name="home" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.title}>Bookings</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#1e293b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabContainer}
        style={{ flexGrow: 0 }}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Ionicons 
            name="car" 
            size={20} 
            color={activeTab === 'active' ? '#f97316' : '#64748b'} 
          />
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active
          </Text>
          {activeBookings.length > 0 && (
            <View style={[styles.badge, { backgroundColor: '#f97316' }]}>
              <Text style={styles.badgeText}>{activeBookings.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.activeTab]}
          onPress={() => setActiveTab('available')}
        >
          <Ionicons 
            name="list" 
            size={20} 
            color={activeTab === 'available' ? '#f97316' : '#64748b'} 
          />
          <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>
            Available
          </Text>
          {availableBookings.length > 0 && (
            <View style={[styles.badge, { backgroundColor: '#f97316' }]}>
              <Text style={styles.badgeText}>{availableBookings.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons 
            name="chatbubble" 
            size={20} 
            color={activeTab === 'chat' ? '#f97316' : '#64748b'} 
          />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>
            Chat
          </Text>
          {activeBookings.length > 0 && (
            <View style={[styles.badge, { backgroundColor: '#f97316' }]}>
              <Text style={styles.badgeText}>{activeBookings.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Ionicons 
            name="checkmark-circle" 
            size={20} 
            color={activeTab === 'completed' ? '#22c55e' : '#64748b'} 
          />
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed
          </Text>
          {completedBookings.length > 0 && (
            <View style={[styles.badge, { backgroundColor: '#22c55e' }]}>
              <Text style={styles.badgeText}>{completedBookings.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.bookingsList}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderBookings().length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons 
                name={
                  activeTab === 'active' ? 'car-outline' :
                  activeTab === 'available' ? 'search-outline' :
                  activeTab === 'chat' ? 'chatbubble-outline' :
                  'checkmark-circle-outline'
                } 
                size={48} 
                color="#94a3b8" 
              />
              <Text style={styles.emptyStateText}>
                {activeTab === 'active' ? 'No active bookings' :
                 activeTab === 'available' ? 'No available bookings' :
                 activeTab === 'chat' ? 'No active chats' :
                 'No completed bookings'}
              </Text>
            </View>
          ) : (
            renderBookings().map(booking => renderBookingCard(booking))
          )}
        </ScrollView>

        {selectedBooking && (
          <View style={styles.chatContainer}>
            <ChatPanel
              bookingId={selectedBooking.id}
              onClose={handleCloseChat}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  refreshButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 16,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#fff7ed',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#64748b',
  },
  activeTabText: {
    color: '#f97316',
    fontWeight: '600',
  },
  badge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  bookingsList: {
    flex: 1,
    padding: 16,
  },
  chatContainer: {
    width: width * 0.4,
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#9ca3af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  bookingType: {
    fontSize: 14,
    color: '#f97316',
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#f97316',
    fontWeight: '500',
  },
  bookingDetails: {
    marginBottom: 12,
  },
  locationContainer: {
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#4b5563',
    marginLeft: 8,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    color: '#64748b',
  },
  notesText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    flex: 1,
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  viewButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewButtonText: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chatButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  statusAvailable: {
    color: '#3b82f6',
  },
  statusActive: {
    color: '#f97316',
  },
  statusCompleted: {
    color: '#10b981',
  },
  statusCancelled: {
    color: '#ef4444',
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewDetailsButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
});

export default ActiveBookingsScreen; 