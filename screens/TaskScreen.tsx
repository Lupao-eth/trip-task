import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Image,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { AppLayout } from '../components/AppLayout';
import { NavigationProps } from '../types';
import { useNavigation } from '@react-navigation/native';
import { bookingService } from '../services/bookingService';
import { useAuth } from '../contexts/AuthContext';

interface TaskScreenProps {
  navigation: NavigationProps;
}

interface FormData {
  name: string;
  itemsList: string;
  storePreference: string;
  dropoffLocation: string;
  isASAP: boolean;
  scheduledTime: Date;
  specialNotes: string;
  attachments: string[];
  taskPriority: 'Low' | 'Normal' | 'High';
}

interface AlertConfig {
  title: string;
  message: string;
  type: 'success' | 'error';
  onConfirm?: () => void;
}

const TaskScreen: React.FC<TaskScreenProps> = () => {
  const navigation = useNavigation<NavigationProps>();
  const { user, session } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    itemsList: '',
    storePreference: '',
    dropoffLocation: '',
    isASAP: true,
    scheduledTime: new Date(),
    specialNotes: '',
    attachments: [],
    taskPriority: 'Normal',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    title: '',
    message: '',
    type: 'error',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleScheduleToggle = (isASAP: boolean) => {
    setFormData(prev => ({ ...prev, isASAP }));
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        setShowDatePicker(false);
        if (event.type === 'set' && selectedDate) {
          const newDate = new Date(selectedDate);
          newDate.setHours(formData.scheduledTime.getHours());
          newDate.setMinutes(formData.scheduledTime.getMinutes());
          setFormData(prev => ({ ...prev, scheduledTime: newDate }));
          // Show time picker after date is selected
          setTimeout(() => {
            setPickerMode('time');
            setShowTimePicker(true);
          }, 100);
        }
      } else {
        setShowTimePicker(false);
        if (event.type === 'set' && selectedDate) {
          const newDate = new Date(formData.scheduledTime);
          newDate.setHours(selectedDate.getHours());
          newDate.setMinutes(selectedDate.getMinutes());
          setFormData(prev => ({ ...prev, scheduledTime: newDate }));
        }
      }
      return;
    }
    
    // For iOS
    if (selectedDate) {
      setFormData(prev => ({ ...prev, scheduledTime: selectedDate }));
    }
  };

  const handleWebDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(event.target.value);
    setFormData(prev => ({ ...prev, scheduledTime: date }));
  };

  const handlePriorityChange = (priority: 'Low' | 'Normal' | 'High') => {
    setFormData(prev => ({ ...prev, taskPriority: priority }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, result.assets[0].uri]
      }));
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const validateTaskForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Task name is required';
    }
    if (!formData.itemsList.trim()) {
      errors.itemsList = 'Please enter what you need';
    }
    if (!formData.storePreference.trim()) {
      errors.storePreference = 'Store preference is required';
    }
    if (!formData.dropoffLocation.trim()) {
      errors.dropoffLocation = 'Dropoff location is required';
    }
    if (!formData.isASAP && !formData.scheduledTime) {
      errors.scheduledTime = 'Please select a scheduled time';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const showAlertMessage = (config: AlertConfig) => {
    setAlertConfig(config);
    setShowAlert(true);
  };

  const handleSubmit = async () => {
    if (!user || !session) {
      showAlertMessage({
        title: 'Error',
        message: 'You must be logged in to create a task',
        type: 'error'
      });
      return;
    }

    if (!validateTaskForm()) {
      const firstError = Object.values(validationErrors)[0];
      showAlertMessage({
        title: 'Missing Information',
        message: firstError,
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const { data: booking, error } = await bookingService.createBooking({
        pickup_location: formData.storePreference,
        dropoff_location: formData.dropoffLocation,
        scheduled_time: formData.scheduledTime,
        notes: `Items: ${formData.itemsList}\nPriority: ${formData.taskPriority}${formData.specialNotes.trim() ? `\nSpecial Notes: ${formData.specialNotes}` : ''}`,
        is_asap: formData.isASAP,
        booking_type: 'task',
        name: formData.name
      });

      if (error) {
        showAlertMessage({
          title: 'Error',
          message: error.message,
          type: 'error'
        });
        return;
      }

      if (booking) {
        showAlertMessage({
          title: 'Success!',
          message: 'Your task has been created successfully!',
          type: 'success',
          onConfirm: () => {
            setShowAlert(false);
            navigation.navigate('BookingStatus');
          }
        });

        // Reset form
        setFormData({
          name: '',
          itemsList: '',
          storePreference: '',
          dropoffLocation: '',
          isASAP: true,
          scheduledTime: new Date(),
          specialNotes: '',
          attachments: [],
          taskPriority: 'Normal',
        });
      }
    } catch (error) {
      showAlertMessage({
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Reset form data or fetch new data here
    setFormData({
      name: '',
      itemsList: '',
      storePreference: '',
      dropoffLocation: '',
      isASAP: true,
      scheduledTime: new Date(),
      specialNotes: '',
      attachments: [],
      taskPriority: 'Normal',
    });
    setRefreshing(false);
  }, []);

  const renderDateTimePicker = () => {
    if (Platform.OS === 'web') {
      return (
        <input
          type="datetime-local"
          value={formData.scheduledTime.toISOString().slice(0, 16)}
          onChange={handleWebDateChange}
          min={new Date().toISOString().slice(0, 16)}
          style={{
            width: '100%',
            padding: 16,
            fontSize: 16,
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            color: '#1e293b',
            marginTop: 12,
          }}
        />
      );
    }

    if (Platform.OS === 'android') {
      if (showDatePicker) {
        return (
          <DateTimePicker
            value={formData.scheduledTime}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        );
      }
      if (showTimePicker) {
        return (
          <DateTimePicker
            value={formData.scheduledTime}
            mode="time"
            display="default"
            onChange={handleDateChange}
          />
        );
      }
      return null;
    }

    // For iOS
    return showDatePicker ? (
      <DateTimePicker
        value={formData.scheduledTime}
        mode="datetime"
        display="spinner"
        onChange={handleDateChange}
        minimumDate={new Date()}
      />
    ) : null;
  };

  const handleAndroidDateTimePress = () => {
    setPickerMode('date');
    setShowDatePicker(true);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#ffffff',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: Platform.select({
        ios: 200,
        android: 180,
        web: 120,
      }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      paddingTop: Platform.OS === 'ios' ? 60 : 16,
      backgroundColor: '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#1e293b',
    },
    formContainer: {
      padding: 16,
    },
    inputGroup: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1e293b',
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: '#1e293b',
      backgroundColor: '#f8fafc',
    },
    itemsInput: {
      height: 100,
    },
    locationInput: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 12,
      backgroundColor: '#f8fafc',
    },
    inputIcon: {
      padding: 16,
    },
    locationTextInput: {
      flex: 1,
      borderWidth: 0,
      paddingLeft: 0,
    },
    helperText: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 4,
    },
    scheduleContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    scheduleOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 12,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      gap: 8,
    },
    scheduleOptionActive: {
      backgroundColor: '#ef4444',
      borderColor: '#ef4444',
    },
    scheduleOptionText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#64748b',
    },
    scheduleOptionTextActive: {
      color: '#ffffff',
    },
    datePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      gap: 8,
    },
    datePickerText: {
      fontSize: 16,
      color: '#1e293b',
    },
    priorityContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    priorityOption: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      alignItems: 'center',
    },
    priorityOptionActive: {
      backgroundColor: '#22c55e',
      borderColor: '#22c55e',
    },
    priorityUrgent: {
      borderColor: '#f97316',
    },
    priorityHigh: {
      borderColor: '#ef4444',
    },
    priorityOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#64748b',
    },
    priorityOptionTextActive: {
      color: '#ffffff',
    },
    attachmentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 12,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderStyle: 'dashed',
      gap: 8,
    },
    attachmentButtonText: {
      fontSize: 16,
      color: '#64748b',
    },
    attachmentsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 12,
    },
    attachmentItem: {
      width: 100,
      height: 100,
      borderRadius: 8,
      overflow: 'hidden',
    },
    attachmentImage: {
      width: '100%',
      height: '100%',
    },
    removeAttachmentButton: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: '#ffffff',
      borderRadius: 12,
    },
    confirmButton: {
      backgroundColor: '#ef4444',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 16,
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
        web: {
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          ':hover': {
            backgroundColor: '#dc2626',
          },
        },
      }),
    },
    confirmButtonText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
    },
    buttonContainer: {
      marginTop: 24,
      marginBottom: Platform.select({
        ios: 120,
        android: 100,
        web: 40,
      }),
      paddingHorizontal: 16,
      paddingBottom: Platform.select({
        ios: 40,
        android: 32,
        web: 0,
      }),
    },
    homeButton: {
      position: 'absolute',
      right: Platform.select({
        ios: 64,
        android: 64,
        web: 72,
      }),
      top: Platform.select({
        ios: Platform.OS === 'ios' ? 0 : 48,
        android: Platform.OS === 'ios' ? 0 : 48,
        web: 48,
      }),
      padding: Platform.select({
        ios: 8,
        android: 8,
        web: 8,
      }),
      zIndex: 1,
      backgroundColor: '#f8fafc',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    submitButton: {
      backgroundColor: '#f97316',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 24,
    },
    submitButtonDisabled: {
      opacity: 0.7,
    },
    submitButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    textArea: {
      height: 100,
      paddingTop: 12,
    },
    inputError: {
      borderColor: '#ef4444',
      borderWidth: 1,
    },
    errorText: {
      color: '#ef4444',
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: 'white',
      borderRadius: 16,
      padding: 24,
      width: '90%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    modalContentSuccess: {
      borderTopWidth: 4,
      borderTopColor: '#22c55e',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    modalIcon: {
      marginRight: 8,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
    },
    modalTitleSuccess: {
      color: '#22c55e',
    },
    modalTitleError: {
      color: '#ef4444',
    },
    closeButton: {
      padding: 4,
    },
    modalMessage: {
      fontSize: 16,
      color: '#475569',
      marginBottom: 24,
      lineHeight: 24,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
    },
    modalButton: {
      padding: 12,
      borderRadius: 8,
      minWidth: 100,
      alignItems: 'center',
    },
    modalButtonPrimary: {
      backgroundColor: '#f97316',
    },
    modalButtonSecondary: {
      backgroundColor: '#f1f5f9',
    },
    modalButtonTextPrimary: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonTextSecondary: {
      color: '#475569',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <AppLayout 
      navigation={navigation} 
      title="Book a Task"
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
            style={Platform.select({
              ios: {},
              android: {},
              web: {},
            })}
          />
        </TouchableOpacity>
      }
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
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
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            {/* Name/Alias Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name/Alias *</Text>
              <TextInput
                style={[styles.input, validationErrors.name && styles.inputError]}
                placeholder="What should we call you?"
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                placeholderTextColor="#94a3b8"
              />
              {validationErrors.name && (
                <Text style={styles.errorText}>{validationErrors.name}</Text>
              )}
              <Text style={styles.helperText}>The rider will call you by this name</Text>
            </View>

            {/* Items List Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>What do you need? *</Text>
              <TextInput
                style={[styles.input, styles.itemsInput, validationErrors.itemsList && styles.inputError]}
                placeholder="List the items you want to buy (one per line)"
                value={formData.itemsList}
                onChangeText={(value) => handleInputChange('itemsList', value)}
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {validationErrors.itemsList && (
                <Text style={styles.errorText}>{validationErrors.itemsList}</Text>
              )}
            </View>

            {/* Store Preference Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Store Preference *</Text>
              <View style={styles.locationInput}>
                <Ionicons name="storefront" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.locationTextInput, validationErrors.storePreference && styles.inputError]}
                  placeholder="Enter store name and location"
                  value={formData.storePreference}
                  onChangeText={(value) => handleInputChange('storePreference', value)}
                  placeholderTextColor="#94a3b8"
                />
              </View>
              {validationErrors.storePreference && (
                <Text style={styles.errorText}>{validationErrors.storePreference}</Text>
              )}
            </View>

            {/* Drop-off Location Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Drop-off Location *</Text>
              <View style={styles.locationInput}>
                <Ionicons name="location" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.locationTextInput, validationErrors.dropoffLocation && styles.inputError]}
                  placeholder="Enter drop-off location"
                  value={formData.dropoffLocation}
                  onChangeText={(value) => handleInputChange('dropoffLocation', value)}
                  placeholderTextColor="#94a3b8"
                />
              </View>
              {validationErrors.dropoffLocation && (
                <Text style={styles.errorText}>{validationErrors.dropoffLocation}</Text>
              )}
            </View>

            {/* Schedule and Timing */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Schedule and Timing *</Text>
              <View style={styles.scheduleContainer}>
                <TouchableOpacity
                  style={[
                    styles.scheduleOption,
                    formData.isASAP && styles.scheduleOptionActive
                  ]}
                  onPress={() => handleScheduleToggle(true)}
                >
                  <Ionicons 
                    name="flash" 
                    size={20} 
                    color={formData.isASAP ? '#ffffff' : '#64748b'} 
                  />
                  <Text style={[
                    styles.scheduleOptionText,
                    formData.isASAP && styles.scheduleOptionTextActive
                  ]}>ASAP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scheduleOption,
                    !formData.isASAP && styles.scheduleOptionActive
                  ]}
                  onPress={() => handleScheduleToggle(false)}
                >
                  <Ionicons 
                    name="calendar" 
                    size={20} 
                    color={!formData.isASAP ? '#ffffff' : '#64748b'} 
                  />
                  <Text style={[
                    styles.scheduleOptionText,
                    !formData.isASAP && styles.scheduleOptionTextActive
                  ]}>Schedule</Text>
                </TouchableOpacity>
              </View>

              {!formData.isASAP && (
                Platform.OS === 'web' ? (
                  renderDateTimePicker()
                ) : (
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={handleAndroidDateTimePress}
                  >
                    <Ionicons name="time" size={20} color="#64748b" />
                    <Text style={styles.datePickerText}>
                      {formData.scheduledTime.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                )
              )}

              {!formData.isASAP && Platform.OS !== 'web' && renderDateTimePicker()}
              {validationErrors.scheduledTime && (
                <Text style={styles.errorText}>{validationErrors.scheduledTime}</Text>
              )}
            </View>

            {/* Task Priority */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Task Priority</Text>
              <View style={styles.priorityContainer}>
                {(['Low', 'Normal', 'High'] as const).map((priority) => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityOption,
                      formData.taskPriority === priority && styles.priorityOptionActive,
                      priority === 'High' && styles.priorityHigh,
                    ]}
                    onPress={() => handlePriorityChange(priority)}
                  >
                    <Text style={[
                      styles.priorityOptionText,
                      formData.taskPriority === priority && styles.priorityOptionTextActive
                    ]}>{priority}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Special Notes Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Special Notes for Rider (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add any special instructions for the rider"
                value={formData.specialNotes}
                onChangeText={(text) => handleInputChange('specialNotes', text)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Attachments */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Attachments (Optional)</Text>
              <TouchableOpacity 
                style={styles.attachmentButton}
                onPress={pickImage}
              >
                <Ionicons name="image-outline" size={24} color="#64748b" />
                <Text style={styles.attachmentButtonText}>Add Photos</Text>
              </TouchableOpacity>

              {formData.attachments.length > 0 && (
                <View style={styles.attachmentsContainer}>
                  {formData.attachments.map((uri, index) => (
                    <View key={index} style={styles.attachmentItem}>
                      <Image source={{ uri }} style={styles.attachmentImage} />
                      <TouchableOpacity
                        style={styles.removeAttachmentButton}
                        onPress={() => removeAttachment(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Confirm Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Create Task</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Alert Modal */}
      <Modal
        visible={showAlert}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAlert(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowAlert(false)}
        >
          <View style={[
            styles.modalContent,
            alertConfig.type === 'success' && styles.modalContentSuccess
          ]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                {alertConfig.type === 'success' ? (
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" style={styles.modalIcon} />
                ) : (
                  <Ionicons name="alert-circle" size={24} color="#ef4444" style={styles.modalIcon} />
                )}
                <Text style={[
                  styles.modalTitle,
                  alertConfig.type === 'success' ? styles.modalTitleSuccess : styles.modalTitleError
                ]}>
                  {alertConfig.title}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowAlert(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalMessage}>{alertConfig.message}</Text>
            <View style={styles.modalButtons}>
              {alertConfig.type === 'success' && alertConfig.onConfirm ? (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSecondary]}
                    onPress={() => setShowAlert(false)}
                  >
                    <Text style={styles.modalButtonTextSecondary}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={alertConfig.onConfirm}
                  >
                    <Text style={styles.modalButtonTextPrimary}>View Task</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => setShowAlert(false)}
                >
                  <Text style={styles.modalButtonTextPrimary}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>
    </AppLayout>
  );
};

export default TaskScreen; 