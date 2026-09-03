import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text, TextInput } from 'react-native-paper';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Enter email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      if (!res.data?.access_token) throw new Error('Token missing');
      await signIn(res.data.access_token);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}><Text style={styles.brandInitial}>G</Text></View>
        <Text style={styles.brand}>GO SMART</Text>
        <Text style={styles.subtitle}>Your home. Your backend. Your control.</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" mode="outlined" textColor="#FFFFFF" style={styles.input} outlineColor="#333333" activeOutlineColor="#FFFFFF" />
          <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} mode="outlined" textColor="#FFFFFF" style={styles.input} outlineColor="#333333" activeOutlineColor="#FFFFFF" right={<TextInput.Icon icon={showPassword ? 'eye-off-outline' : 'eye-outline'} color="#FFFFFF" onPress={() => setShowPassword(v => !v)} />} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity disabled={loading} style={[styles.primary, loading && { opacity: 0.6 }]} onPress={handleLogin}>
            {loading ? <ActivityIndicator color="#000000" /> : <Text style={styles.primaryText}>SIGN IN</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkButton}><Text style={styles.linkText}>Create GO SMART account</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brandMark: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#FFFFFF', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brandInitial: { color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  brand: { color: '#FFFFFF', textAlign: 'center', fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  subtitle: { color: '#8E8E8E', textAlign: 'center', marginTop: 6, marginBottom: 28 },
  card: { backgroundColor: '#080808', borderWidth: 1, borderColor: '#232323', borderRadius: 20, padding: 18 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 14 },
  input: { backgroundColor: '#080808', marginBottom: 12 },
  error: { color: '#FFFFFF', backgroundColor: '#151515', borderWidth: 1, borderColor: '#444444', padding: 10, borderRadius: 10, marginBottom: 12 },
  primary: { height: 52, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#000000', fontWeight: '900', letterSpacing: 0.7 },
  linkButton: { paddingVertical: 16, alignItems: 'center' },
  linkText: { color: '#FFFFFF', fontWeight: '700' },
});