import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Image, ActivityIndicator, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NavigationProps } from '../types';
import { riderService } from '../services/riderService';
import { BookingWithUser } from '../types/booking';
import { useAuth } from '../contexts/AuthContext';

const AvailableBookingsScreen: React.FC = () => {
  const [bookings, setBookings] = useState<BookingWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<NavigationProps>();
  const { user } = useAuth();

  const checkRiderStatus = async () => {
    try {
      const { isRider, error } = await riderService.isRider();
      if (error) throw error;
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

      // First check if user is a rider
      const isRiderUser = await checkRiderStatus();
      
      if (!isRiderUser) {
        console.error('User is not a rider');
        setError('This app is for riders only. Please use the customer app instead.');
        return;
      }

      const { data, error } = await riderService.getAvailableBookings();
      
      if (error) {
        throw error;
      }

      if (data) {
        setBookings(data);
      }
    } catch (err) {
      setError('Failed to load bookings. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAcceptBooking = async (bookingId: string) => {
    try {
      setLoading(true);
      
      // Prevent multiple clicks
      if (loading) {
        return;
      }
      
      const { error } = await riderService.acceptBooking(bookingId);
      
      if (error) {
        Alert.alert('Error', 'Failed to accept booking. Please try again.');
        return;
      }
      
      Alert.alert('Success', 'Booking accepted successfully');
      
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (booking: BookingWithUser) => {
    navigation.navigate('BookingDetails', { bookingId: booking.id });
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderBookingCard = (booking: BookingWithUser) => {
    const isTrip = booking.notes?.toLowerCase().includes('trip:') ?? false;
    const bookingType = getBookingTypeLabel(isTrip ? 'trip' : 'task');

    const onAcceptPress = () => {
      handleAcceptBooking(booking.id);
    };

    const onViewDetailsPress = () => {
      handleViewDetails(booking);
    };

    return (
      <View key={booking.id} style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.bookingType}>
            <Ionicons 
              name={isTrip ? 'car' : 'cart'} 
              size={20} 
              color="#64748b" 
            />
            <Text style={styles.bookingTypeText}>{bookingType}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>PENDING</Text>
          </View>
        </View>

        <View style={styles.bookingContent}>
          <Text style={styles.customerName}>{booking.name || 'Unknown User'}</Text>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={16} color="#64748b" />
            <Text style={styles.detailText} numberOfLines={1}>
              From: {booking.pickup_location}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={16} color="#64748b" />
            <Text style={styles.detailText} numberOfLines={1}>
              To: {booking.dropoff_location}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color="#64748b" />
            <Text style={styles.detailText}>
              {booking.is_asap ? 'ASAP' : (booking.scheduled_time ? formatTime(booking.scheduled_time) : 'No time set')}
            </Text>
          </View>
        </View>

        <View style={styles.bookingFooter}>
          <Text style={styles.bookingId}>Booking ID: {booking.id.slice(0, 8)}</Text>
          <View style={styles.bookingActions}>
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={onAcceptPress}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
              <Text style={styles.buttonText}>
                {loading ? 'Accepting...' : 'Accept'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.viewDetailsButton]}
              onPress={onViewDetailsPress}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>View Details</Text>
              <Ionicons name="chevron-forward" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
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
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate('RiderHome')}>
          <Ionicons name="home" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Available Bookings</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#1e293b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No available bookings</Text>
          </View>
        ) : (
          bookings.map((booking) => renderBookingCard(booking))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  bookingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 8,
  },
  statusBadge: {
    backgroundColor: '#f97316',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  bookingContent: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#1e293b',
    marginLeft: 8,
    flex: 1,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingId: {
    fontSize: 14,
    color: '#64748b',
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginHorizontal: 8,
  },
  acceptButton: {
    backgroundColor: '#22c55e',
  },
  viewDetailsButton: {
    backgroundColor: '#f97316',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
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
});

export default AvailableBookingsScreen; 