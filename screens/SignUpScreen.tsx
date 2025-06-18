import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { profileService } from '../services/profileService';
import { NavigationProps } from '../types';
import { supabase } from '../lib/supabase';

interface SignUpScreenProps {
  navigation: NavigationProps;
}

interface LoginScreenParams {
  message?: string;
}

interface ValidationErrors {
  username?: string;
  email?: string;
  password?: string;
  general?: string;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { signUp, signIn, signOut } = useAuth();

  const validateInputs = () => {
    const newErrors: ValidationErrors = {};
    
    if (!username.trim()) {
      newErrors.username = 'Please enter a username';
    } else if (username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters long';
    }
    
    if (!email.trim()) {
      newErrors.email = 'Please enter your email';
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!password.trim()) {
      newErrors.password = 'Please enter a password';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    const isValid = validateInputs();
    if (!isValid) {
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccessMessage(null);

    try {
      let signUpData, signUpError;
      try {
        const result = await signUp(email, password);
        signUpData = result.data;
        signUpError = result.error;
      } catch (err) {
        return;
      }

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setErrors({ general: 'This email is already registered. Please try logging in instead.' });
        } else {
          setErrors({ general: signUpError.message });
        }
        return;
      }

      if (!signUpData?.user) {
        setErrors({ general: 'Failed to create user account. Please try again.' });
        return;
      }

      // Sign in the user automatically
      let signInError = null;
      try {
        await signIn(email, password);
      } catch (err) {
        signInError = err;
      }

      if (signInError) {
        // If auto sign-in fails, redirect to login
        navigation.reset({
          index: 0,
          routes: [{ 
            name: 'Login',
            params: { 
              message: 'Account created successfully! Please sign in to continue.',
              email: email // Pass email to pre-fill the login form
            }
          }]
        });
        return;
      }

      // Get the current authenticated user (after sign in)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrors({ general: 'Failed to authenticate user after sign up.' });
        return;
      }

      // Create user profile
      const profileResult = await profileService.upsertProfile({
        id: user.id,
        username: username,
        avatar_url: null
      });

      if (profileResult.error) {
        Alert.alert('Profile Error', profileResult.error.message);
        // If profile creation fails, sign out and redirect to login
        await signOut();
        navigation.reset({
          index: 0,
          routes: [{ 
            name: 'Login',
            params: { 
              message: 'Account created but profile setup failed. Please sign in to try again.',
              email: email
            }
          }]
        });
        return;
      }

      // If everything is successful, navigate to home
      navigation.reset({
        index: 0,
        routes: [{ 
          name: 'Home',
          params: { 
            message: 'Welcome to TripTask! Your account has been created successfully.',
            showWelcome: true
          }
        }]
      });

    } catch (error) {
      setErrors({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Join TripTask</Text>
          <Text style={styles.subtitle}>Create your account to start organizing</Text>
        </View>

        {successMessage && (
          <View style={[styles.successContainer, { opacity: loading ? 0.7 : 1 }]}>
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
              style={[styles.input, errors.username && styles.inputError]}
              placeholder="Username"
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (errors.username) setErrors({ ...errors, username: undefined });
              }}
              autoCapitalize="none"
              editable={!loading}
            />
            {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
          </View>

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
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
            disabled={loading}
          >
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkTextBold}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    width: Math.min(width - 40, 400),
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
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
  buttonContainer: {
    gap: 16,
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
}); 