import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Image } from 'react-native';
import { Text, TextInput, Snackbar, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';
import logoImg from '../../assets/4layers_logo.png';

export default function RegisterScreen({ navigation }) {
  const theme = useTheme();
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Alert Snackbar states
  const [snackMsg, setSnackMsg] = useState('');
  const [snackIsError, setSnackIsError] = useState(true);
  const [showSnackbar, setShowSnackbar] = useState(false);

  const validateEmail = (emailStr) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr);
  };

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setSnackMsg('Please fill all registration fields.');
      setSnackIsError(true);
      setShowSnackbar(true);
      return;
    }

    if (username.length < 3) {
      setSnackMsg('Username must be at least 3 characters.');
      setSnackIsError(true);
      setShowSnackbar(true);
      return;
    }

    if (!validateEmail(email.trim())) {
      setSnackMsg('Please enter a valid email address.');
      setSnackIsError(true);
      setShowSnackbar(true);
      return;
    }

    if (password !== confirmPassword) {
      setSnackMsg('Passwords do not match.');
      setSnackIsError(true);
      setShowSnackbar(true);
      return;
    }

    if (password.length < 6) {
      setSnackMsg('Password must be at least 6 characters.');
      setSnackIsError(true);
      setShowSnackbar(true);
      return;
    }

    setLoading(true);
    setSnackMsg('');

    try {
      const registerPayload = {
        username: username.trim(),
        email: email.trim(),
        password: password
      };

      await apiClient.post('/api/users/register', registerPayload);

      // Success
      setSnackIsError(false);
      setSnackMsg('Registration successful! Redirecting...');
      setShowSnackbar(true);
      
      setTimeout(() => {
        navigation.navigate('Login');
      }, 1500);
    } catch (error) {
      console.error('[Register] Sync Error:', error);
      const detail = error.response?.data?.detail || 'Registration failed. Try again.';
      setSnackIsError(true);
      setSnackMsg(detail);
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
        {/* Top Header Section with simple clean logo */}
        <View style={styles.headerSection}>
          <View style={styles.logoContainer}>
            <Image source={logoImg} style={{ width: 64, height: 64 }} resizeMode="contain" />
          </View>
          
          <Text style={styles.title}>4Layers</Text>
          <Text style={styles.subtitle}>Register Controller</Text>
        </View>

        {/* Input Form Section */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Create Account</Text>

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
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            textColor="#FFFFFF"
            activeOutlineColor="#22C55E"
            outlineColor="#262626"
            left={<TextInput.Icon icon="email" iconColor="#9CA3AF" />}
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

          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            textColor="#FFFFFF"
            activeOutlineColor="#22C55E"
            outlineColor="#262626"
            left={<TextInput.Icon icon="shield-lock" iconColor="#9CA3AF" />}
            style={styles.input}
          />

          {/* Simple Clean Green Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleRegister}
            disabled={loading}
            style={[styles.submitBtn, { opacity: loading ? 0.7 : 1 }]}
          >
            {loading ? (
              <Text style={styles.btnText}>Registering...</Text>
            ) : (
              <Text style={styles.btnText}>Register</Text>
            )}
          </TouchableOpacity>

          {/* Sync Account Prompt */}
          <View style={styles.loginPrompt}>
            <Text style={styles.promptText}>Already registered?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.loginLink, { color: '#1fa971' }]}> Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Snackbar
          visible={showSnackbar}
          onDismiss={() => setShowSnackbar(false)}
          duration={4000}
          style={{ backgroundColor: snackIsError ? '#7F1D1D' : '#14532D', borderWidth: 1, borderColor: snackIsError ? '#EF4444' : '#1fa971' }}
          action={{
            label: 'OK',
            textColor: snackIsError ? '#FCA5A5' : '#86EFAC',
            onPress: () => setShowSnackbar(false),
          }}
        >
          <Text style={{ color: snackIsError ? '#FCA5A5' : '#FFFFFF', fontWeight: 'bold' }}>
            {snackMsg}
          </Text>
        </Snackbar>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#121827',
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
    backgroundColor: '#121827',
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
    marginBottom: 12,
    backgroundColor: '#0b0f19',
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
  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  promptText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  loginLink: {
    fontWeight: '700',
    fontSize: 14,
  },
});
