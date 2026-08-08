import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Image } from 'react-native';
import { Text, TextInput, Snackbar, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import logoImg from '../../assets/4layers_logo.png';

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
            <Image source={logoImg} style={{ width: 64, height: 64 }} resizeMode="contain" />
          </View>
          
          <Text style={styles.title}>4Layers</Text>
          <Text style={styles.subtitle}>Control Console</Text>
        </View>

        {/* Input Form Section */}
        <View style={styles.formCard}>
          {/* Google OAuth Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setErrorMsg('Google OAuth login initialized. Select your Google account.');
              setShowSnackbar(true);
            }}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              gap: 10,
              elevation: 2
            }}
          >
            <MaterialCommunityIcons name="google" size={20} color="#DB4437" />
            <Text style={{ color: '#000000', fontWeight: '700', fontSize: 14 }}>
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
    backgroundColor: '#1C1B1B',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
