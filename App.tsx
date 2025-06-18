import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RiderProvider, useRider } from './contexts/RiderContext';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import RiderHomeScreen from './screens/RiderHomeScreen';
import ChatScreen from './screens/ChatScreen';
import TripScreen from './screens/TripScreen';
import TaskScreen from './screens/TaskScreen';
import AvailableBookingsScreen from './screens/AvailableBookingsScreen';
import ActiveBookingsScreen from './screens/ActiveBookingsScreen';
import BookingDetailsScreen from './screens/BookingDetailsScreen';
import BookingStatusScreen from './screens/BookingStatusScreen';
import BookingHistoryScreen from './screens/BookingHistoryScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Home: undefined;
  RiderHome: undefined;
  Chat: { bookingId: string };
  Trip: { tripId: string };
  Task: { taskId: string };
  AvailableBookings: undefined;
  ActiveBookings: undefined;
  BookingDetails: { bookingId: string };
  BookingStatus: undefined;
  BookingHistory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const Navigation = () => {
  const { session, loading: authLoading } = useAuth();
  const { isRider, isLoading: riderLoading } = useRider();

  if (authLoading || riderLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  const headerStyle = {
    backgroundColor: '#fff',
    borderBottomWidth: 0,
  };

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#fff' },
          animation: 'none',
          header: () => null
        }}
      >
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        ) : isRider ? (
          // Rider screens
          <>
            <Stack.Screen name="RiderHome" component={RiderHomeScreen} />
            <Stack.Screen 
              name="AvailableBookings" 
              component={AvailableBookingsScreen}
              options={{
                headerShown: true,
                title: 'Available Bookings',
                headerStyle,
                headerTintColor: '#000',
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen 
              name="ActiveBookings" 
              component={ActiveBookingsScreen}
              options={{
                headerShown: true,
                title: 'Active Bookings',
                headerStyle,
                headerTintColor: '#000',
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen 
              name="Chat" 
              component={ChatScreen}
              options={{
                headerShown: false
              }}
            />
            <Stack.Screen 
              name="BookingDetails" 
              component={BookingDetailsScreen}
              options={{
                headerShown: true,
                title: 'Booking Details',
                headerStyle,
                headerTintColor: '#000',
                headerShadowVisible: false,
              }}
            />
          </>
        ) : (
          // Customer screens
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen 
              name="Trip" 
              component={TripScreen}
              options={{
                headerShown: true,
                title: 'Trip Details',
                headerStyle,
                headerTintColor: '#000',
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen 
              name="Task" 
              component={TaskScreen}
              options={{
                headerShown: true,
                title: 'Task Details',
                headerStyle,
                headerTintColor: '#000',
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen 
              name="Chat" 
              component={ChatScreen}
              options={{
                headerShown: false
              }}
            />
            <Stack.Screen 
              name="BookingStatus" 
              component={BookingStatusScreen}
              options={{
                headerShown: true,
                title: 'Active Bookings',
                headerStyle,
                headerTintColor: '#000',
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen 
              name="BookingHistory" 
              component={BookingHistoryScreen}
              options={{
                headerShown: true,
                title: 'Booking History',
                headerStyle,
                headerTintColor: '#000',
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen 
              name="BookingDetails" 
              component={BookingDetailsScreen}
              options={{
                headerShown: true,
                title: 'Booking Details',
                headerStyle,
                headerTintColor: '#000',
                headerShadowVisible: false,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <RiderProvider>
        <Navigation />
      </RiderProvider>
    </AuthProvider>
  );
} 