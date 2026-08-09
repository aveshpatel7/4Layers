import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Image, Linking } from 'react-native';
import { Text, TextInput, Snackbar, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import logoImg from '../../assets/4layers_logo.png';

WebBrowser.maybeCompleteAuthSession();

// Backend base URL (same as API client)
const BACKEND_URL = 'https://edabtynvpy.ap-south-1.awsapprunner.com';

export default function LoginScreen({ navigation }) {
  const theme = useTheme();
  const { signIn } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Alert and Snackbar states
  const [errorMsg, setErrorMsg] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);

  // Clear stale token on land/mount to guarantee clean login handshake state
  useEffect(() => {
    const clearStaleToken = async () => {
      try {
        await AsyncStorage.removeItem('user_token');
      } catch (e) {
        console.error('[Login] Error clearing stale token:', e);
      }
    };
    clearStaleToken();
  }, []);

  // Listen for deep link callback from Google OAuth (4layers://auth?token=xxx)
  useEffect(() => {
    const handleDeepLink = async (event) => {
      const url = event?.url || event;
      if (!url) return;
      console.log('[GoogleOAuth] Deep link received:', url);
      
      try {
        const parsed = new URL(url);
        const token = parsed.searchParams?.get('token') || url.match(/token=([^&]+)/)?.[1];
        const error = parsed.searchParams?.get('error') || url.match(/error=([^&]+)/)?.[1];
        
        if (token) {
          console.log('[GoogleOAuth] JWT token received, signing in...');
          setLoading(true);
          await signIn(token);
          setLoading(false);
        } else if (error) {
          console.error('[GoogleOAuth] Error from callback:', error);
          setErrorMsg('Google Login failed: ' + decodeURIComponent(error));
          setShowSnackbar(true);
        }
      } catch (e) {
        console.error('[GoogleOAuth] Deep link parse error:', e);
      }
    };

    // Listen for incoming deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Also check if app was opened via deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url && url.includes('4layers://auth')) {
        handleDeepLink({ url });
      }
    });

    return () => subscription?.remove();
  }, []);

  // Server-side Google OAuth: opens backend /api/users/google/start in browser
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const authUrl = `${BACKEND_URL}/api/users/google/start`;
      console.log('[GoogleOAuth] Opening server-side auth URL:', authUrl);
      
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        '4layers://auth'
      );
      
      console.log('[GoogleOAuth] WebBrowser result:', result.type);
      
      if (result.type === 'success' && result.url) {
        // Parse token from redirect URL
        const token = result.url.match(/token=([^&]+)/)?.[1];
        const error = result.url.match(/error=([^&]+)/)?.[1];
        
        if (token) {
          await signIn(token);
        } else if (error) {
          setErrorMsg('Google Login failed: ' + decodeURIComponent(error));
          setShowSnackbar(true);
        }
      } else if (result.type === 'cancel') {
        console.log('[GoogleOAuth] User cancelled');
      }
    } catch (err) {
      console.error('[GoogleOAuth] Error:', err);
      setErrorMsg('Google Login failed. Please try again.');
      setShowSnackbar(true);
    } finally {
      setLoading(false);
    }
  };



  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter credentials to initialize connection.');
      setShowSnackbar(true);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const urlEncodedBody = `username=${encodeURIComponent(username.trim())}&password=${encodeURIComponent(password)}`;
      
      const response = await apiClient.post('/api/users/login', urlEncodedBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;
      if (access_token) {
        await signIn(access_token);
      } else {
        throw new Error('Access denied');
      }
    } catch (error) {
      console.error('[Login] Sync Error:', error);
      const detail = error.response?.data?.detail || 'Handshake failed. Check credentials.';
      setErrorMsg(detail);
      setShowSnackbar(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Top Header Section with simple modern logo */}
        <View style={styles.headerSection}>
          <View style={styles.logoContainer}>
            <Image source={logoImg} style={{ width: 72, height: 72 }} resizeMode="contain" />
          </View>
          
          <Text style={styles.title}>4Layers</Text>
          <Text style={styles.subtitle}>Control Console</Text>
        </View>

        {/* Input Form Section */}
        <View style={styles.formCard}>
          {/* Sleek Dark Mode Google OAuth Button (Matching Official Google Dark Brand Guidelines) */}
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={loading}
            onPress={() => handleGoogleSignIn()}
            style={{
              backgroundColor: '#131314',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.16)',
              paddingVertical: 12,
              paddingHorizontal: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              gap: 12,
              elevation: 3,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
            }}
          >
            <View style={{ width: 22, height: 22, justifyContent: 'center', alignItems: 'center' }}>
              <MaterialCommunityIcons name="google" size={20} color="#DB4437" />
            </View>
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 0.2 }}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
            <Text style={{ color: '#9CA3AF', fontSize: 11, marginHorizontal: 10, textTransform: 'uppercase', fontWeight: '700' }}>
              or sign in with email
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
          </View>

          <Text style={styles.formTitle}>Sign In</Text>

          <TextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            autoCapitalize="none"
            textColor="#FFFFFF"
            activeOutlineColor="#22C55E"
            outlineColor="#262626"
            left={<TextInput.Icon icon="account" iconColor="#9CA3AF" />}
            style={styles.input}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            textColor="#FFFFFF"
            activeOutlineColor="#22C55E"
            outlineColor="#262626"
            left={<TextInput.Icon icon="shield-lock" iconColor="#9CA3AF" />}
            right={
              <TextInput.Icon 
                icon={showPassword ? 'eye-off' : 'eye'} 
                iconColor="#9CA3AF"
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            style={styles.input}
          />

          {/* Simple Clean Green Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLogin}
            disabled={loading}
            style={[styles.submitBtn, { opacity: loading ? 0.7 : 1 }]}
          >
            {loading ? (
              <Text style={styles.btnText}>Connecting...</Text>
            ) : (
              <Text style={styles.btnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Create Account Prompt */}
          <View style={styles.registerPrompt}>
            <Text style={styles.promptText}>New controller?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={[styles.registerLink, { color: '#1fa971' }]}> Register</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Snackbar
          visible={showSnackbar}
          onDismiss={() => setShowSnackbar(false)}
          duration={4000}
          style={{ backgroundColor: '#7F1D1D', borderWidth: 1, borderColor: '#EF4444' }}
          action={{
            label: 'OK',
            textColor: '#FCA5A5',
            onPress: () => setShowSnackbar(false),
          }}
        >
          <Text style={{ color: '#FCA5A5', fontWeight: 'bold' }}>{errorMsg}</Text>
        </Snackbar>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0E0E',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0E0E0E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#1C1B1B',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#0E0E0E',
  },
  submitBtn: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#1fa971',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  registerPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  promptText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  registerLink: {
    fontWeight: '700',
    fontSize: 14,
  },
});
