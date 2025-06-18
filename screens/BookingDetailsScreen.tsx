import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NavigationProps, Booking } from '../types';
import { bookingService } from '../services/bookingService';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

type BookingDetailsRouteProp = RouteProp<{ BookingDetails: { bookingId: string } }, 'BookingDetails'>;

const BookingDetailsScreen: React.FC = () => {
  const route = useRoute<BookingDetailsRouteProp>();
  const navigation = useNavigation<NavigationProps>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUserBooking, setIsUserBooking] = useState(false);

  useEffect(() => {
    loadBooking();
  }, [route.params.bookingId]);

  const loadBooking = async () => {
    try {
      const { data, error } = await bookingService.getBooking(route.params.bookingId);
      if (error) {
        setError(error.message);
        return;
      }
      setBooking(data);
      // Check if this is the current user's booking
      setIsUserBooking(data?.user_id === user?.id);
    } catch (err) {
      setError('Failed to load booking details');
      console.error('Error loading booking:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await bookingService.cancelBooking(route.params.bookingId, 'Cancelled by user');
              if (error) {
                Alert.alert('Error', error.message);
                return;
              }
              Alert.alert('Success', 'Booking cancelled successfully');
              navigation.goBack();
            } catch (err) {
              console.error('Error cancelling booking:', err);
              Alert.alert('Error', 'Failed to cancel booking');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <AppLayout navigation={navigation} title="Booking Details">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      </AppLayout>
    );
  }

  if (error || !booking) {
    return (
      <AppLayout navigation={navigation} title="Booking Details">
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Booking not found'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadBooking}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </AppLayout>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'accepted':
        return '#3b82f6';
      case 'on_the_way':
        return '#8b5cf6';
      case 'completed':
        return '#10b981';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  return (
    <AppLayout 
      navigation={navigation} 
      title="Booking Details"
      headerLeft={
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color="#3b82f6" 
          />
        </TouchableOpacity>
      }
    >
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Booking Details</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
              <Text style={styles.statusText}>
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1).replace('_', ' ')}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Pickup Location:</Text>
              <Text style={styles.value}>{booking.pickup_location}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Dropoff Location:</Text>
              <Text style={styles.value}>{booking.dropoff_location}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Scheduled Time:</Text>
              <Text style={styles.value}>
                {booking.is_asap ? 'ASAP' : formatDate(booking.scheduled_time)}
              </Text>
            </View>
            {booking.notes && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Notes:</Text>
                <Text style={styles.value}>{booking.notes}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Booking ID:</Text>
              <Text style={styles.value}>{booking.id}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Created by:</Text>
              <Text style={styles.value}>{isUserBooking ? 'You' : 'Another User'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Created:</Text>
              <Text style={styles.value}>{formatDate(booking.created_at)}</Text>
            </View>
            {booking.completed_at && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Completed:</Text>
                <Text style={styles.value}>{formatDate(booking.completed_at)}</Text>
              </View>
            )}
            {booking.cancelled_at && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Cancelled:</Text>
                <Text style={styles.value}>{formatDate(booking.cancelled_at)}</Text>
              </View>
            )}
            {booking.cancelled_by && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Cancelled by:</Text>
                <Text style={styles.value}>{booking.cancelled_by === user?.id ? 'You' : 'Another User'}</Text>
              </View>
            )}
            {booking.rider_id && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Assigned to:</Text>
                <Text style={styles.value}>{booking.rider_id === user?.id ? 'You' : 'Another User'}</Text>
              </View>
            )}
          </View>

          {booking.status === 'pending' && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelBooking}
            >
              <Text style={styles.cancelButtonText}>Cancel Booking</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 16,
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
    backgroundColor: '#f97316',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
});

export default BookingDetailsScreen; 