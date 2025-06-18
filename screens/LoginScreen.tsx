import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { profileService } from '../services/profileService';
import { NavigationProps } from '../types';

interface LoginScreenProps {
  navigation: NavigationProps;
  route: {
    params?: {
      message?: string;
      email?: string;
    };
  };
}

interface ValidationErrors {
  email?: string;
  password?: string;
  general?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, route }) => {
  const [email, setEmail] = useState(route.params?.email || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { signIn } = useAuth();

  useEffect(() => {
    if (route.params?.message) {
      setSuccessMessage(route.params.message);
      navigation.setParams({ message: undefined });
    }
    if (route.params?.email) {
      setEmail(route.params.email);
      navigation.setParams({ email: undefined });
    }
  }, [route.params]);

  const validateInputs = () => {
    const newErrors: ValidationErrors = {};
    
    if (!email.trim()) {
      newErrors.email = 'Please enter your email';
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!password.trim()) {
      newErrors.password = 'Please enter your password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    setErrors({});
    setSuccessMessage(null);
    
    if (!validateInputs()) {
      return;
    }

    try {
      setLoading(true);
      const { data, error: signInError } = await signIn(email.trim(), password);

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setErrors({ general: 'Invalid email or password' });
        } else {
          setErrors({ general: `Error during login: ${signInError.message}` });
        }
        return;
      }

      if (data?.user) {
        const { data: profile, error: profileError } = await profileService.getProfile(data.user.id);

        if (profileError) {
          if (profileError.message.includes('not found')) {
            const { error: createError } = await profileService.upsertProfile({
              id: data.user.id,
              username: email.split('@')[0],
              avatar_url: null
            });

            if (createError) {
              setErrors({ general: 'Your account is verified but we had trouble setting up your profile. Please try logging in again.' });
              return;
            }
          } else {
            setErrors({ general: 'There was a problem accessing your profile. Please try logging in again.' });
            return;
          }
        }

        // Show success message
        setSuccessMessage('Welcome back! Redirecting...');
        
        // Wait a moment to show the message
        await new Promise(resolve => setTimeout(resolve, 1000));

        // The auth state change will automatically navigate to Home
        // The Home screen will show the welcome message
      }
    } catch (error) {
      setErrors({ general: `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoidingView}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollView}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.formContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Welcome to TripTask</Text>
              <Text style={styles.subtitle}>Sign in to manage your trips</Text>
            </View>

            {successMessage && (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            {errors.general && (
              <View style={styles.generalErrorContainer}>
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="Email"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  autoComplete="email"
                  textContentType="emailAddress"
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder="Password"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  secureTextEntry
                  editable={!loading}
                  autoComplete="password"
                  textContentType="password"
                />
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => navigation.navigate('SignUp')}
                disabled={loading}
                activeOpacity={0.6}
              >
                <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkTextBold}>Sign Up</Text></Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: height,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isWeb ? 24 : 16,
  },
  formContainer: {
    width: Math.min(width - (isWeb ? 80 : 40), 400),
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: isWeb ? 40 : 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  headerContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
  inputGroup: {
    gap: 16,
    marginBottom: 24,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    height: 56,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#1e293b',
    fontWeight: '500',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  generalErrorContainer: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  generalErrorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  successContainer: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  successText: {
    color: '#166534',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  button: {
    height: 56,
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  linkTextBold: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 16,
  },
}); 