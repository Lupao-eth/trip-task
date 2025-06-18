import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NavigationProps } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { RiderProfile } from '../services/riderService';

const { width } = Dimensions.get('window');

interface RiderSidebarProps {
  isVisible: boolean;
  onClose: () => void;
  profile: RiderProfile | null;
}

const RiderSidebar: React.FC<RiderSidebarProps> = ({ isVisible, onClose, profile }) => {
  const navigation = useNavigation<NavigationProps>();
  const { user } = useAuth();

  if (!isVisible) return null;

  const handleNavigation = (screen: string) => {
    onClose();
    navigation.navigate(screen as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.overlay} onTouchEnd={onClose} />
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <Image
            source={{ uri: profile?.avatar_url || user?.user_metadata?.avatar_url || 'https://via.placeholder.com/50' }}
            style={styles.sidebarAvatar}
          />
          <Text style={styles.sidebarUsername}>{profile?.full_name || user?.user_metadata?.username || 'Rider'}</Text>
        </View>
        <View style={styles.sidebarMenu}>
          <TouchableOpacity 
            style={[styles.sidebarItem, navigation.getState().routes[navigation.getState().index].name === 'RiderHome' && styles.activeSidebarItem]}
            onPress={() => handleNavigation('RiderHome')}
          >
            <Ionicons name="home" size={24} color={navigation.getState().routes[navigation.getState().index].name === 'RiderHome' ? '#f97316' : '#64748b'} />
            <Text style={[styles.sidebarItemText, navigation.getState().routes[navigation.getState().index].name === 'RiderHome' && styles.activeSidebarItemText]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sidebarItem, navigation.getState().routes[navigation.getState().index].name === 'AvailableBookings' && styles.activeSidebarItem]}
            onPress={() => handleNavigation('AvailableBookings')}
          >
            <Ionicons name="list" size={24} color={navigation.getState().routes[navigation.getState().index].name === 'AvailableBookings' ? '#f97316' : '#64748b'} />
            <Text style={[styles.sidebarItemText, navigation.getState().routes[navigation.getState().index].name === 'AvailableBookings' && styles.activeSidebarItemText]}>Available Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sidebarItem, navigation.getState().routes[navigation.getState().index].name === 'ActiveBookings' && styles.activeSidebarItem]}
            onPress={() => handleNavigation('ActiveBookings')}
          >
            <Ionicons name="car" size={24} color={navigation.getState().routes[navigation.getState().index].name === 'ActiveBookings' ? '#f97316' : '#64748b'} />
            <Text style={[styles.sidebarItemText, navigation.getState().routes[navigation.getState().index].name === 'ActiveBookings' && styles.activeSidebarItemText]}>Active Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sidebarItem, navigation.getState().routes[navigation.getState().index].name === 'RiderProfile' && styles.activeSidebarItem]}
            onPress={() => handleNavigation('RiderProfile')}
          >
            <Ionicons name="person" size={24} color={navigation.getState().routes[navigation.getState().index].name === 'RiderProfile' ? '#f97316' : '#64748b'} />
            <Text style={[styles.sidebarItemText, navigation.getState().routes[navigation.getState().index].name === 'RiderProfile' && styles.activeSidebarItemText]}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 0.8,
    height: '100%',
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  sidebarAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  sidebarUsername: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  sidebarMenu: {
    padding: 16,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  activeSidebarItem: {
    backgroundColor: '#fff7ed',
  },
  sidebarItemText: {
    fontSize: 16,
    color: '#64748b',
  },
  activeSidebarItemText: {
    color: '#f97316',
    fontWeight: '600',
  },
});

export default RiderSidebar; 