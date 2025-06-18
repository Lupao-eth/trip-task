import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NavigationProps } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { bookingService } from '../services/bookingService';
import { Booking, BookingStatus } from '../types';
import { AppLayout } from '../components/AppLayout';

type ActiveTab = 'pending' | 'accepted' | 'on_the_way';

const BookingStatusScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending');

  const fetchBookings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await bookingService.getUserBookings();
      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }
      if (data) {
        console.log('All bookings:', data.length);
        console.log('Booking statuses:', data.map(b => b.status));
        
        // Filter active bookings and sort by created_at
        const activeBookings = data.filter(booking => 
          ['pending', 'accepted', 'on_the_way'].includes(booking.status)
        ).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        console.log('Active bookings:', activeBookings.length);
        console.log('Active booking statuses:', activeBookings.map(b => b.status));
        
        setBookings(activeBookings);
      }
    } catch (error) {
      console.error('Unexpected error fetching bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'pending':
        return '#f59e0b'; // Amber
      case 'accepted':
        return '#3b82f6'; // Blue
      case 'on_the_way':
        return '#8b5cf6'; // Purple
      case 'completed':
        return '#22c55e'; // Green
      case 'cancelled':
        return '#ef4444'; // Red
      default:
        return '#64748b'; // Gray
    }
  };

  const getStatusIcon = (status: BookingStatus) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'accepted':
        return 'checkmark-circle-outline';
      case 'on_the_way':
        return 'car-outline';
      case 'completed':
        return 'checkmark-done-circle-outline';
      case 'cancelled':
        return 'close-circle-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    });
  };

  const filteredBookings = bookings.filter(booking => booking.status === activeTab);

  const renderTab = (tab: ActiveTab, label: string, icon: keyof typeof Ionicons.glyphMap) => {
    const isActive = activeTab === tab;
    const statusColor = getStatusColor(tab);
    const count = bookings.filter(b => b.status === tab).length;
    
    console.log(`Tab ${tab} count:`, count);
    console.log(`Tab ${tab} bookings:`, bookings.filter(b => b.status === tab).map(b => b.id));

    return (
      <TouchableOpacity
        style={[
          styles.tab,
          isActive && { borderBottomColor: statusColor, borderBottomWidth: 2 }
        ]}
        onPress={() => setActiveTab(tab)}
      >
        <Ionicons 
          name={icon} 
          size={20} 
          color={isActive ? statusColor : '#64748b'} 
        />
        <Text style={[
          styles.tabText,
          isActive && { color: statusColor }
        ]}>
          {label}
        </Text>
        {count > 0 && (
          <View style={[styles.badge, { backgroundColor: statusColor }]}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderBookingCard = (booking: Booking) => {
    const statusColor = getStatusColor(booking.status);
    const statusIcon = getStatusIcon(booking.status);
    const isTrip = booking.notes?.toLowerCase().includes('trip:') ?? false;

    return (
      <TouchableOpacity
        key={booking.id}
        style={styles.bookingCard}
        onPress={() => navigation.navigate('BookingDetails', { bookingId: booking.id })}
      >
        <View style={styles.bookingHeader}>
          <View style={styles.bookingType}>
            <Ionicons 
              name={isTrip ? 'car' : 'cart'} 
              size={20} 
              color="#64748b" 
            />
            <Text style={styles.bookingTypeText}>
              {isTrip ? 'Trip' : 'Task'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Ionicons name={statusIcon} size={16} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {booking.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
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
              {booking.is_asap ? 'ASAP' : formatDate(booking.scheduled_time)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color="#64748b" />
            <Text style={styles.detailText}>
              Created: {formatDate(booking.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.bookingFooter}>
          <Text style={styles.bookingId}>Booking ID: {booking.id.slice(0, 8)}</Text>
          <View style={styles.bookingActions}>
            {['accepted', 'on_the_way'].includes(booking.status) && (
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => {
                  navigation.navigate('Chat', { bookingId: booking.id });
                }}
              >
                <Ionicons name="chatbubble" size={16} color="#3b82f6" />
                <Text style={styles.chatButtonText}>Chat</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.viewDetailsButton}
              onPress={() => navigation.navigate('BookingDetails', { bookingId: booking.id })}
            >
              <Text style={styles.viewDetailsText}>View Details</Text>
              <Ionicons name="chevron-forward" size={16} color="#f97316" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <AppLayout 
      navigation={navigation} 
      title="Active Bookings"
      headerRight={
        <TouchableOpacity 
          style={styles.homeButton}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="home" 
            size={24} 
            color="#3b82f6" 
          />
        </TouchableOpacity>
      }
    >
      <View style={styles.tabContainer}>
        {renderTab('pending', 'Pending', 'time-outline')}
        {renderTab('accepted', 'Accepted', 'checkmark-circle-outline')}
        {renderTab('on_the_way', 'On the Way', 'car-outline')}
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading bookings...</Text>
          </View>
        ) : filteredBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>No {activeTab} bookings</Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'pending' ? 'Waiting for your bookings to be accepted' :
               activeTab === 'accepted' ? 'No accepted bookings at the moment' :
               'No active trips or tasks on the way'}
            </Text>
            <TouchableOpacity
              style={styles.createBookingButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
              <Text style={styles.createBookingButtonText}>Create a Booking</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bookingsList}>
            {filteredBookings.map(renderBookingCard)}
          </View>
        )}
      </ScrollView>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    position: 'relative',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  bookingCard: {
    backgroundColor: '#ffffff',
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
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingTypeText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#475569',
    flex: 1,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  bookingId: {
    fontSize: 12,
    color: '#94a3b8',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
    marginRight: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  createBookingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createBookingButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  homeButton: {
    padding: 8,
  },
  bookingsList: {
    flex: 1,
  },
  bookingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  chatButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
});

export default BookingStatusScreen; 