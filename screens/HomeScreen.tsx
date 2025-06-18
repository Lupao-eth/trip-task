import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Animated,
  Platform,
  Dimensions,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { NavigationProps } from '../types';
import { profileService } from '../services/profileService';
import { Profile } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { AppLayout } from '../components/AppLayout';
import { RootStackParamList } from '../types';

interface HomeScreenProps {
  navigation: NavigationProps;
  route: {
    params?: {
      message?: string;
      showWelcome?: boolean;
    };
  };
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, route }) => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.message) {
      setSuccessMessage(route.params.message);
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setSuccessMessage(null);
        });
      }, 5000);

      navigation.setParams({ message: undefined, showWelcome: undefined });

      return () => clearTimeout(timer);
    }
  }, [route.params?.message]);

  useEffect(() => {
    const loadProfile = async () => {
      if (user) {
        try {
          const { data, error } = await profileService.getProfile(user.id);
          if (error) {
            console.error('Error loading profile:', error);
          } else {
            setProfile(data);
          }
        } catch (error) {
          console.error('Error in loadProfile:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadProfile();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    // Implement refresh logic here
    setRefreshing(false);
  };

  const handleNavigation = (screen: 'Trip' | 'Task') => {
    navigation.navigate(screen);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <AppLayout 
      navigation={navigation} 
      title="TripTask"
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3b82f6']}
            tintColor="#3b82f6"
          />
        }
      >
        {successMessage && (
          <Animated.View 
            style={[
              styles.successContainer,
              { opacity: fadeAnim }
            ]}
          >
            <Text style={styles.successText}>{successMessage}</Text>
          </Animated.View>
        )}

        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome to TripTask!</Text>
          <Text style={styles.welcomeSubtitle}>Choose a service to get started</Text>
        </View>

        <View style={styles.servicesContainer}>
          <TouchableOpacity
            style={[styles.serviceCard, { backgroundColor: '#ef4444' }]}
            onPress={() => handleNavigation('Trip')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIcon, { backgroundColor: '#ffffff20' }]}>
              <Ionicons name="car" size={32} color="#ffffff" />
            </View>
            <Text style={[styles.serviceTitle, { color: '#ffffff' }]}>Trip</Text>
            <Text style={[styles.serviceDescription, { color: '#ffffff' }]}>
              Need a ride?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.serviceCard, { backgroundColor: '#f97316' }]}
            onPress={() => handleNavigation('Task')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIcon, { backgroundColor: '#ffffff20' }]}>
              <Ionicons name="cube" size={32} color="#ffffff" />
            </View>
            <Text style={[styles.serviceTitle, { color: '#ffffff' }]}>Task</Text>
            <Text style={[styles.serviceDescription, { color: '#ffffff' }]}>
              Need it? We'll fetch it
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppLayout>
  );
};

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: isWeb ? Math.min(width * 0.1, 120) : 24,
  },
  welcomeSection: {
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
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
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
  },
  servicesContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  serviceCard: {
    flex: 1,
    borderRadius: 16,
    padding: 24,
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
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  serviceIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  serviceDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  successContainer: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(34, 197, 94, 0.1)',
      },
    }),
  },
  successText: {
    color: '#166534',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 24,
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
}); 