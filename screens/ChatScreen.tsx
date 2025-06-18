import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AppLayout } from '../components/AppLayout';
import { NavigationProps, RootStackParamList } from '../types';
import { format, parseISO } from 'date-fns';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { BookingWithUser, UserProfile } from '../types/booking';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRider } from '../contexts/RiderContext';

const SUPABASE_URL = 'https://rhasilvpqqtalrfubhxm.supabase.co';

type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

type MessageSender = {
  id: string;
  username: string;
  avatar_url: string;
};

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  booking_id: string;
  sender: MessageSender;
  image_url: string | null;
  file_url: string | null;
  file_name: string | null;
};

type MessageWithSender = Message;

interface Booking {
  id: string;
  rider_id: string;
  status: string;
  created_at: string;
  rider: {
    id: string;
    username: string;
    avatar_url: string;
  };
}

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

interface StatusButtonProps {
  bookingStatus: string;
  onStatusUpdate: (newStatus: string) => void;
}

const StatusButton: React.FC<StatusButtonProps> = ({ bookingStatus, onStatusUpdate }) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePress = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    
    try {
      if (bookingStatus === 'accepted') {
        await onStatusUpdate('on_the_way');
      } else if (bookingStatus === 'on_the_way') {
        await onStatusUpdate('completed');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (bookingStatus === 'accepted') {
    return (
      <TouchableOpacity
        style={[styles.statusButton, styles.onTheWayButton]}
        onPress={handlePress}
        disabled={isUpdating}
      >
        <Ionicons name="car" size={20} color="#fff" />
        <Text style={styles.statusButtonText}>
          {isUpdating ? 'Updating...' : 'On the Way'}
        </Text>
      </TouchableOpacity>
    );
  } else if (bookingStatus === 'on_the_way') {
    return (
      <TouchableOpacity
        style={[styles.statusButton, styles.completeButton]}
        onPress={handlePress}
        disabled={isUpdating}
      >
        <Ionicons name="checkmark-circle" size={20} color="#fff" />
        <Text style={styles.statusButtonText}>
          {isUpdating ? 'Updating...' : 'Complete'}
        </Text>
      </TouchableOpacity>
    );
  }
  return null;
};

const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute<ChatScreenRouteProp>();
  const { user } = useAuth();
  const [activeBookings, setActiveBookings] = useState<BookingWithUser[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(0);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const messagesListRef = useRef<FlatList>(null);
  const { width } = Dimensions.get('window');
  const isWeb = Platform.OS === 'web';
  const { bookingId } = route.params || {};
  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'image' | 'file';
    uri: string;
    name?: string;
    base64?: string;
  } | null>(null);
  const subscriptionRef = useRef<any>(null);
  const { riderProfile } = useRider();
  const [bookingStatus, setBookingStatus] = useState<string>('pending');
  const [isRider, setIsRider] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        if (isMounted) setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        if (isMounted) setKeyboardHeight(0);
      }
    );

    loadActiveBookings();

    return () => {
      isMounted = false;
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;
    let channel: any = null;

    const fetchInitialData = async () => {
      try {
        if (isMounted) setLoading(true);

        // Fetch booking with rider profile
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            *,
            rider:profiles!bookings_rider_id_fkey(id, username, avatar_url)
          `)
          .eq('id', bookingId)
          .single();

        if (bookingError) throw bookingError;

        // Format booking data
        const formattedBooking = {
          ...bookingData,
          rider: {
            id: bookingData.rider.id,
            username: bookingData.rider.username || 'Unknown',
            avatar_url: bookingData.rider.avatar_url || ''
          }
        };

        setBooking(formattedBooking);
        setIsRider(formattedBooking.rider_id === user?.id);
        setBookingStatus(formattedBooking.status);

        // Fetch messages with sender profiles
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey(id, username, avatar_url)
          `)
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        const formattedMessages = messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          created_at: msg.created_at,
          sender_id: msg.sender_id,
          booking_id: msg.booking_id,
          sender: {
            id: msg.sender.id,
            username: msg.sender.username || 'Unknown',
            avatar_url: msg.sender.avatar_url || ''
          },
          image_url: msg.image_url,
          file_url: msg.file_url,
          file_name: msg.file_name
        }));

        if (isMounted) {
          setMessages(formattedMessages);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setError('Failed to load data');
          setLoading(false);
        }
      }
    };

    fetchInitialData();

    // Set up polling for new messages
    pollInterval = setInterval(async () => {
      try {
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        // Fetch sender profiles
        const senderIds = messagesData?.map(msg => msg.sender_id) || [];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', senderIds);

        if (profilesError) throw profilesError;

        // Combine messages with sender profiles
        const messagesWithSenders = messagesData?.map(message => {
          const senderProfile = profilesData?.find(profile => profile.id === message.sender_id);
          if (!senderProfile) {
            return null;
          }
          return {
            id: message.id,
            content: message.content,
            created_at: message.created_at,
            sender_id: message.sender_id,
            booking_id: message.booking_id,
            sender: {
              id: senderProfile.id,
              username: senderProfile.username || 'Unknown',
              avatar_url: senderProfile.avatar_url || ''
            },
            image_url: message.image_url || null,
            file_url: message.file_url || null,
            file_name: message.file_name || null
          } as Message;
        }).filter((msg): msg is Message => msg !== null) || [];

        if (isMounted) setMessages(messagesWithSenders);
      } catch (err) {
        if (isMounted) setError('Error polling messages');
      }
    }, 2000);

    // Set up real-time subscription as backup
    channel = supabase.channel(`booking_chat_${bookingId}`);
    
    channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `booking_id=eq.${bookingId}`,
      }, async (payload) => {
        // Fetch the sender profile for the new message
        const { data: senderProfile, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .eq('id', payload.new.sender_id)
          .single();

        if (profileError) {
          return;
        }

        // Add the new message to the state with the sender profile
        const messageWithSender: Message = {
          id: payload.new.id,
          booking_id: payload.new.booking_id,
          sender_id: payload.new.sender_id,
          content: payload.new.content,
          created_at: payload.new.created_at,
          sender: {
            id: senderProfile.id,
            username: senderProfile.username || 'Unknown',
            avatar_url: senderProfile.avatar_url || ''
          },
          image_url: payload.new.image_url || null,
          file_url: payload.new.file_url || null,
          file_name: payload.new.file_name || null
        };

        if (!isMounted) return;
        setMessages(currentMessages => [...currentMessages, messageWithSender]);

        // Scroll to bottom when new message arrives
        setTimeout(() => {
          if (isMounted && flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
      })
      .subscribe((status) => {
      });

    return () => {
      isMounted = false;
      if (channel) channel.unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
      setIsImageModalVisible(false); // Close modal on unmount
    };
  }, [bookingId]);

  // Add auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      messagesListRef.current?.scrollToEnd({ animated: false });
    }
  }, [messages]);

  const loadActiveBookings = async () => {
    try {
      // First get the bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .or(`user_id.eq.${user?.id},rider_id.eq.${user?.id}`)
        .in('status', ['accepted', 'on_the_way'])
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      // Then get the user profiles
      const userIds = bookings?.map(b => [b.user_id, b.rider_id]).flat().filter(Boolean) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const bookingsWithUsers = bookings?.map(booking => ({
        ...booking,
        user: profiles?.find(p => p.id === booking.user_id),
        rider: profiles?.find(p => p.id === booking.rider_id)
      })) || [];

      setActiveBookings(bookingsWithUsers);
    } catch (err) {
      Alert.alert('Error', 'Failed to load active bookings');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(id, username, avatar_url)
        `)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(messages.map(msg => ({
        ...msg,
        sender: {
          id: msg.sender.id,
          username: msg.sender.username || 'Unknown',
          avatar_url: msg.sender.avatar_url || ''
        }
      })));
    } catch (error: any) {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !bookingId || !user) return;

    setSending(true);
    try {
      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          booking_id: bookingId,
          sender_id: user.id,
          content: newMessage.trim(),
        })
        .select(`
          *,
          sender:profiles(id, username, avatar_url)
        `)
        .single();

      if (error) throw error;

      const formattedMessage = {
        id: message.id,
        content: message.content,
        created_at: message.created_at,
        sender_id: message.sender_id,
        booking_id: message.booking_id,
        sender: {
          id: message.sender.id,
          username: message.sender.username || 'Unknown',
          avatar_url: message.sender.avatar_url || ''
        },
        image_url: message.image_url || null,
        file_url: message.file_url || null,
        file_name: message.file_name || null
      };

      setMessages(prev => [...prev, formattedMessage]);
      setNewMessage('');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleImagePress = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const handleCloseImagePreview = () => {
    setSelectedImage(null);
  };

  const getMimeType = (extension: string): string => {
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  };

  const handleFilePress = async (fileUrl: string) => {
    try {
      if (Platform.OS === 'web') {
        window.open(fileUrl, '_blank');
      } else {
        // On mobile, open in browser or associated app
        await Linking.openURL(fileUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open file');
    }
  };

  const uploadAndSendImage = async (imageUri: string) => {
    if (!bookingId || !user) {
      return;
    }

    try {
      setSending(true);
      
      // Convert image URI to Blob using XMLHttpRequest
      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
          resolve(xhr.response);
        };
        xhr.onerror = reject;
        xhr.responseType = 'blob';
        xhr.open('GET', imageUri, true);
        xhr.send(null);
      });

      if (!blob || blob.size === 0) {
        throw new Error('Invalid image data: Empty or invalid blob');
      }

      // Create a safe filename
      const fileName = `${Date.now()}.jpg`;
      const filePath = `${bookingId}/${fileName}`;

      // Convert blob to base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64String = base64Data.split(',')[1];

      // Upload using Supabase client with base64
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, decode(base64String), {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
    }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const content = `image:${publicUrl}`;
      
      // Send the message with the image URL
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
        booking_id: bookingId,
        sender_id: user.id,
          content: content
        });

      if (messageError) {
        throw new Error(`Failed to save message: ${messageError.message}`);
      }

    } catch (error: any) {
      Alert.alert(
        'Upload Failed',
        `Failed to upload image: ${error.message || 'Unknown error'}. Please try again.`
      );
    } finally {
      setSending(false);
    }
  };

  // Helper function to decode base64
  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        allowsMultipleSelection: false,
      });

      if (result.canceled) {
        return;
      }
            
      if (!result.assets || result.assets.length === 0) {
        return;
      }

      const selectedImage = result.assets[0];

      // Upload image directly
      await uploadAndSendImage(selectedImage.uri);
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return;
      }

      if (!result.assets || result.assets.length === 0) {
        return;
      }

      const selectedFile = result.assets[0];

      // Upload file directly
      await uploadAndSendFile(selectedFile.uri, selectedFile.name);
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const uploadAndSendFile = async (fileUri: string, fileName: string) => {
    if (!bookingId || !user) {
      return;
    }

    try {
      setSending(true);
      
      // Convert file URI to Blob
      const response = await fetch(fileUri);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }
      
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Invalid file data');
      }

      // Create a safe filename
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${bookingId}/${safeFileName}`;

      // Upload using Supabase client
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, blob, {
          contentType: blob.type || 'application/octet-stream',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const content = `file:${publicUrl}`;
      
      // Send the message with the file URL
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          booking_id: bookingId,
          sender_id: user.id,
          content: content
        });

      if (messageError) {
        throw new Error(`Failed to save message: ${messageError.message}`);
      }

    } catch (error: any) {
      Alert.alert(
        'Upload Failed',
        `Failed to upload file: ${error.message || 'Unknown error'}. Please try again.`
      );
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item: message }: { item: MessageWithSender }) => {
    const isCurrentUser = message.sender_id === user?.id;
    const messageStyle = [
      styles.messageBubble,
      isCurrentUser ? styles.ownMessage : styles.otherMessage,
    ];

    const renderMessageContent = () => {
      if (message.content.startsWith('image:')) {
        const imageUrl = message.content.replace('image:', '');
    return (
          <TouchableOpacity onPress={() => handleImagePress(imageUrl)}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        );
      }

      if (message.content.startsWith('file:')) {
        const fileUrl = message.content.replace('file:', '');
        const fileName = fileUrl.split('/').pop() || 'File';
        return (
          <TouchableOpacity onPress={() => handleFilePress(fileUrl)}>
            <View style={styles.fileContainer}>
              <Ionicons name="document" size={24} color="#666" />
              <Text style={styles.fileName} numberOfLines={1}>
                {fileName}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }

      return (
        <Text style={[
          styles.messageText,
          isCurrentUser ? styles.currentUserMessageText : styles.otherUserMessageText
        ]}>
          {message.content}
        </Text>
      );
    };

    return (
      <View style={messageStyle}>
        {renderMessageContent()}
        <Text style={styles.messageTime}>
          {new Date(message.created_at).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    );
  };

  const renderBookingCard = (booking: BookingWithUser) => {
    const isRider = booking.rider_id === user?.id;
    const otherUser = isRider ? booking.user : booking.rider;
    const isAvailable = booking.status === 'pending' && !booking.rider_id;
    const isActive = booking.status === 'accepted' || booking.status === 'on_the_way';
    const isCompleted = booking.status === 'completed';
    const isCancelled = booking.status === 'cancelled';

    return (
      <TouchableOpacity
        key={booking.id}
        style={styles.bookingCard}
        onPress={() => navigation.navigate('Chat', { bookingId: booking.id })}
      >
        <View style={styles.bookingHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.username}>{otherUser?.username || 'Unknown User'}</Text>
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
          {booking.price && (
            <Text style={styles.priceText}>
              ${Number(booking.price).toFixed(2)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderWebLayout = () => (
    <View style={styles.webContainer}>
      <View style={styles.webSidebar}>
        <Text style={styles.sectionTitle}>Active Bookings</Text>
        <ScrollView style={styles.bookingsList}>
          {activeBookings.map(renderBookingCard)}
        </ScrollView>
      </View>
      <View style={styles.webChatContainer}>
        {booking ? (
          <>
            <View style={styles.chatHeader}>
              <Image
                source={{ uri: booking.rider.avatar_url || 'https://via.placeholder.com/40' }}
                style={styles.chatAvatar}
              />
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatName}>{booking.rider.username}</Text>
                <Text style={styles.chatStatus}>Active Booking</Text>
              </View>
            </View>
            <FlatList
              ref={messagesListRef}
              data={messages}
              keyExtractor={item => `${item.id}-${item.created_at}`}
              contentContainerStyle={styles.messagesListContent}
              renderItem={renderMessage}
            />
            <View style={styles.webInputContainer}>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={() => {}}
                activeOpacity={0.7}
              >
                <Ionicons name="attach" size={24} color="#64748b" />
              </TouchableOpacity>
              <TextInput
                style={styles.webInput}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, (!newMessage.trim()) && styles.sendButtonDisabled]}
                onPress={() => sendMessage()}
                disabled={!newMessage.trim()}
              >
                <Ionicons
                  name="send"
                  size={24}
                  color={newMessage.trim() ? '#fff' : '#94a3b8'}
                />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.noBookingSelected}>
            <Ionicons name="chatbubble-outline" size={48} color="#94a3b8" />
            <Text style={styles.noBookingText}>Select a booking to start chatting</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderMobileLayout = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Chat</Text>
        <View style={styles.headerRight}>
          {isRider && (
            <StatusButton bookingStatus={bookingStatus} onStatusUpdate={updateBookingStatus} />
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {activeBookings.map((booking) => renderBookingCard(booking))}
        </ScrollView>
      </View>
  );

  const renderFullScreenImage = () => {
    if (!selectedImage) return null;
    return (
      <TouchableOpacity
        style={styles.fullScreenImageContainer}
        onPress={() => setSelectedImage(null)}
        activeOpacity={1}
      >
              <Image
          source={{ uri: selectedImage }}
          style={styles.fullScreenImage}
          resizeMode="contain"
        />
      </TouchableOpacity>
    );
  };

  const renderInputSection = () => (
    <View style={styles.inputContainer}>
      {selectedMedia ? (
        <View style={styles.mediaPreviewContainer}>
          {selectedMedia.type === 'image' ? (
            <Image
              source={{ uri: selectedMedia.uri }}
              style={styles.mediaPreview}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.filePreview}>
              <Ionicons name="document" size={24} color="#666" />
              <Text style={styles.filePreviewName} numberOfLines={1}>
                {selectedMedia.name}
              </Text>
              </View>
          )}
          <View style={styles.mediaActions}>
            <TouchableOpacity
              style={styles.mediaActionButton}
              onPress={() => setSelectedMedia(null)}
            >
              <Ionicons name="close-circle" size={24} color="#ff4444" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mediaActionButton}
              onPress={() => {}}
            >
              <Ionicons name="send" size={24} color="#4CAF50" />
            </TouchableOpacity>
            </View>
        </View>
      ) : (
        <View style={styles.inputWrapper}>
          <TouchableOpacity
            style={styles.attachmentButton}
            onPress={pickImage}
          >
            <Ionicons name="image" size={24} color="#666" />
          </TouchableOpacity>
              <TouchableOpacity
                style={styles.attachmentButton}
            onPress={pickFile}
              >
            <Ionicons name="document" size={24} color="#666" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
            placeholderTextColor="#999"
                multiline
            onContentSizeChange={(e) => {
              setInputHeight(e.nativeEvent.contentSize.height);
            }}
              />
              <TouchableOpacity
            style={[
              styles.sendButton,
              !newMessage.trim() && styles.sendButtonDisabled
            ]}
                onPress={sendMessage}
                disabled={!newMessage.trim()}
              >
                <Ionicons
                  name="send"
                  size={24}
              color={newMessage.trim() ? '#007AFF' : '#999'}
                />
              </TouchableOpacity>
          </View>
        )}
    </View>
  );

  const renderImageModal = () => (
    <Modal
      visible={isImageModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setIsImageModalVisible(false)}
    >
      <View style={styles.modalContainer}>
      <TouchableOpacity
          style={styles.modalCloseButton}
          onPress={() => setIsImageModalVisible(false)}
      >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        {selectedImage && (
        <Image
          source={{ uri: selectedImage }}
            style={styles.modalImage}
          resizeMode="contain"
        />
        )}
      </View>
    </Modal>
  );

  const updateBookingStatus = async (newStatus: string) => {
    try {
      // Perform the update with explicit conditions
      const { data: updateResult, error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .match({ 
          id: bookingId,
          status: bookingStatus // Only update if current status matches
        })
        .select();

      if (updateError) {
        Alert.alert('Error', 'Failed to update booking status');
        return;
      }

      if (!updateResult || updateResult.length === 0) {
        Alert.alert('Error', 'Failed to update booking status');
        return;
      }

      // If we get here, the update was successful
      setBookingStatus(newStatus);
      Alert.alert('Success', `Booking status updated to ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      Alert.alert('Error', 'Failed to update booking status');
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMessages();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleOnTheWay = async () => {
    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'on_the_way' })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      // Update local state
      setBooking(prev => prev ? { ...prev, status: 'on_the_way' } : null);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update status. Please try again.');
    }
  };

  const fetchBooking = async () => {
    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          rider:profiles(id, name, avatar),
          driver:profiles(id, name, avatar)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError) throw bookingError;

      setBooking(bookingData);
      setIsRider(bookingData.rider_id === user?.id);
    } catch (error: any) {
      setError('Failed to load booking details');
    }
  };

  if (!bookingId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('RiderHome')} style={styles.headerButton}>
              <Ionicons name="home" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Chat</Text>
          <View style={styles.headerRight}>
            {isRider && (
              <StatusButton bookingStatus={bookingStatus} onStatusUpdate={updateBookingStatus} />
            )}
          </View>
        </View>

        <ScrollView style={styles.content}>
          {activeBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyStateText}>No active chats</Text>
            </View>
          ) : (
            activeBookings.map(renderBookingCard)
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#fff' }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>
                {booking?.rider_id === user?.id ? 'Driver' : 'Rider'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {booking?.status === 'completed' ? 'Trip Completed' : 'Active Trip'}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {isRider && (
                <StatusButton bookingStatus={bookingStatus} onStatusUpdate={updateBookingStatus} />
              )}
            </View>
          </View>
          <View style={{ flex: 1, flexDirection: 'column' }}>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={pickImage}
              >
                <Ionicons name="image" size={24} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={pickFile}
              >
                <Ionicons name="document" size={24} color="#666" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                placeholderTextColor="#999"
                multiline
                onContentSizeChange={(e) => {
                  setInputHeight(e.nativeEvent.contentSize.height);
                }}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !newMessage.trim() && styles.sendButtonDisabled
                ]}
                onPress={sendMessage}
                disabled={!newMessage.trim()}
              >
                <Ionicons
                  name="send"
                  size={24}
                  color={newMessage.trim() ? '#007AFF' : '#999'}
                />
              </TouchableOpacity>
            </View>
            {/* Message container preview at the very bottom */}
            <View style={styles.messageContainerPreview}>
              <Text style={styles.messageTitle}>Message Preview</Text>
              <Text style={styles.messagePreviewText}>{newMessage}</Text>
            </View>
          </View>
          <Modal
            visible={!!selectedImage}
            transparent={true}
            animationType="fade"
            onRequestClose={handleCloseImagePreview}
          >
            <View style={styles.modalContainer}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={handleCloseImagePreview}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
              {selectedImage && (
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </Modal>
        </>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    padding: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  messagesList: {
    padding: 16,
  },
  messagesListContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  messageContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    marginTop: 'auto',
  },
  messageTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  attachmentButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onTheWayButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 'auto',
  },
  onTheWayButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    marginBottom: 16,
    padding: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#f97316',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
  },
  messageHeader: {
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  currentUserMessageText: {
    color: '#ffffff',
  },
  otherUserMessageText: {
    color: '#1e293b',
  },
  messageTime: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginRight: 4,
  },
  statusButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  completeButton: {
    backgroundColor: '#22c55e',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  noBookingSelected: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  noBookingText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  webBubble: {
    maxWidth: 400,
  },
  webInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  webInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    fontSize: 16,
    color: '#1e293b',
    maxHeight: 100,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  fullScreenImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  webContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  webSidebar: {
    width: 320,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  webChatContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  mobileContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mobileBookingsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  mobileBookingsList: {
    marginTop: 12,
  },
  mobileBookingsListContent: {
    paddingRight: 16,
  },
  bookingsList: {
    flex: 1,
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
  selectedBookingCard: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginRight: 8,
  },
  bookingType: {
    fontSize: 12,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
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
  locationContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 8,
    flex: 1,
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
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  chatContainer: {
    flex: 1,
    position: 'relative',
    paddingTop: 10,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  chatStatus: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  modalImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  mediaPreviewContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    padding: 8,
    marginHorizontal: 8,
  },
  mediaPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  filePreviewName: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  mediaActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  mediaActionButton: {
    padding: 4,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  fileName: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  bookingStatus: {
    fontSize: 14,
    color: '#64748b',
  },
  messageContainerPreview: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
    padding: 8,
  },
  messagePreviewText: {
    fontSize: 16,
    color: '#222',
    marginTop: 4,
  },
});

export default ChatScreen; 