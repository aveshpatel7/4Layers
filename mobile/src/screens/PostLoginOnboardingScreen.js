import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Image, Linking, Alert } from 'react-native';
import { Text, TextInput, Snackbar, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';

const TOKENS = {
  bg: '#0b0f19',
  surface: '#121827',
  surfaceLow: '#1a2234',
  accent: '#1fa971',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  border: 'rgba(255, 255, 255, 0.08)',
  error: '#EF4444'
};

export default function PostLoginOnboardingScreen({ route, navigation, onOnboardingComplete }) {
  const user = route.params?.user || {};
  
  const [step, setStep] = useState(user.phone_number ? 'TERMS' : 'PHONE');
  const [phoneNumber, setPhoneNumber] = useState(user.phone_number || '');
  const [termsAccepted, setTermsAccepted] = useState(user.terms_accepted || false);
  const [loading, setLoading] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);

  const handlePhoneSubmit = () => {
    const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      setShowSnackbar(true);
      return;
    }
    setStep('TERMS');
  };

  const handleFinalSubmit = async () => {
    if (!termsAccepted) {
      setErrorMsg('Please accept the Privacy Policy & Terms of Service to continue.');
      setShowSnackbar(true);
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/api/users/me/onboarding', {
        phone_number: phoneNumber.trim(),
        terms_accepted: true
      });
      
      if (onOnboardingComplete) {
        onOnboardingComplete();
      }
    } catch (err) {
      console.error('[Onboarding] Error submitting data:', err);
      const detail = err.response?.data?.detail || 'Failed to save account setup. Try again.';
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
        {/* Progress Header */}
        <View style={styles.header}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{step === 'PHONE' ? 'Step 1 of 2' : 'Step 2 of 2'}</Text>
          </View>
          <Text style={styles.title}>Account Onboarding</Text>
          <Text style={styles.subtitle}>
            {step === 'PHONE' 
              ? 'Register your primary contact for device alerts & recovery'
              : 'Review and accept service terms'}
          </Text>
        </View>

        {step === 'PHONE' ? (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="cellphone-check" size={32} color={TOKENS.accent} />
            </View>

            <Text style={styles.cardTitle}>Mobile Number Registration</Text>
            <Text style={styles.cardDescription}>
              Enter your mobile number to receive critical smart home security alerts and account recovery SMS.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Phone Number</Text>
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                mode="outlined"
                keyboardType="phone-pad"
                textColor="#FFFFFF"
                activeOutlineColor={TOKENS.accent}
                outlineColor="#262626"
                left={<TextInput.Icon icon="phone" iconColor={TOKENS.textSecondary} />}
                style={styles.input}
                placeholder="e.g. +91 9876543210"
                placeholderTextColor={TOKENS.textSecondary}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePhoneSubmit}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Continue to Terms</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#000000" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="shield-check-outline" size={32} color={TOKENS.accent} />
            </View>

            <Text style={styles.cardTitle}>Terms & Privacy Policy</Text>
            <Text style={styles.cardDescription}>
              Please review and accept 4Layers SmartNest Terms of Service and Privacy Policy to access your console.
            </Text>

            <View style={styles.termsBox}>
              <ScrollView style={{ maxHeight: 140 }}>
                <Text style={styles.termsText}>
                  <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>1. Device Control & Automation:{'\n'}</Text>
                  You agree to use 4Layers SmartNest IoT Cloud infrastructure safely in accordance with hardware electrical ratings.{'\n\n'}
                  <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>2. Data Privacy & Encryption:{'\n'}</Text>
                  Telemetry data, switchboard relay states, and scheduled automation profiles are encrypted in transit via SSL/TLS and MQTT WSS.{'\n\n'}
                  <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>3. Account Security:{'\n'}</Text>
                  You are responsible for maintaining control of your registered mobile number ({phoneNumber}) and account access credentials.
                </Text>
              </ScrollView>
            </View>

            {/* Checkbox item */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setTermsAccepted(!termsAccepted)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <MaterialCommunityIcons name="check" size={16} color="#000000" />}
              </View>
              <Text style={styles.checkboxLabel}>
                I have read and agree to the <Text style={{ color: TOKENS.accent, fontWeight: 'bold' }}>Terms of Service</Text> and <Text style={{ color: TOKENS.accent, fontWeight: 'bold' }}>Privacy Policy</Text>.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleFinalSubmit}
              disabled={loading}
              style={[styles.primaryBtn, { opacity: loading ? 0.7 : 1 }]}
            >
              {loading ? (
                <Text style={styles.primaryBtnText}>Completing Setup...</Text>
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Accept & Complete Setup</Text>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#000000" />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStep('PHONE')}
              style={{ alignSelf: 'center', marginTop: 12 }}
            >
              <Text style={{ color: TOKENS.textSecondary, fontSize: 12 }}>Change phone number</Text>
            </TouchableOpacity>
          </View>
        )}

        <Snackbar
          visible={showSnackbar}
          onDismiss={() => setShowSnackbar(false)}
          duration={3500}
          style={{ backgroundColor: '#7F1D1D', borderWidth: 1, borderColor: '#EF4444' }}
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
    backgroundColor: TOKENS.bg,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  stepBadge: {
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.3)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  stepBadgeText: {
    color: TOKENS.accent,
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: TOKENS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  card: {
    backgroundColor: TOKENS.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: TOKENS.surfaceLow,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TOKENS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: TOKENS.surfaceLow,
  },
  termsBox: {
    backgroundColor: TOKENS.surfaceLow,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
    marginBottom: 16,
  },
  termsText: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    lineHeight: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: TOKENS.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: TOKENS.textSecondary,
    lineHeight: 16,
  },
  primaryBtn: {
    backgroundColor: TOKENS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
    gap: 8,
    elevation: 4,
    shadowColor: TOKENS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryBtnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
    flexShrink: 1,
  },
});
