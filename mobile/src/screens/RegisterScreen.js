import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { ActivityIndicator, Text, TextInput } from 'react-native-paper';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ navigation }) {
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const register = async () => {
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError('Name, valid email and minimum 8-character password required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/api/auth/register', {
        name: name.trim(), email: email.trim().toLowerCase(), password,
      });
      if (!res.data?.access_token) throw new Error('Token missing');
      await signIn(res.data.access_token);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>GO SMART</Text>
        <Text style={styles.subtitle}>Create your account</Text>
        <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" textColor="#FFFFFF" style={styles.input} outlineColor="#333333" activeOutlineColor="#FFFFFF" />
        <TextInput label="Email" value={email} onChangeText={setEmail} mode="outlined" autoCapitalize="none" keyboardType="email-address" textColor="#FFFFFF" style={styles.input} outlineColor="#333333" activeOutlineColor="#FFFFFF" />
        <TextInput label="Password" value={password} onChangeText={setPassword} mode="outlined" secureTextEntry textColor="#FFFFFF" style={styles.input} outlineColor="#333333" activeOutlineColor="#FFFFFF" />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity disabled={loading} style={styles.primary} onPress={register}>
          {loading ? <ActivityIndicator color="#000000" /> : <Text style={styles.primaryText}>CREATE ACCOUNT</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()}><Text style={styles.linkText}>Back to sign in</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { color: '#FFFFFF', textAlign: 'center', fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  subtitle: { color: '#888888', textAlign: 'center', marginTop: 6, marginBottom: 26 },
  input: { backgroundColor: '#080808', marginBottom: 12 },
  error: { color: '#FFFFFF', backgroundColor: '#151515', padding: 10, borderRadius: 10, marginBottom: 12 },
  primary: { height: 52, backgroundColor: '#FFFFFF', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#000000', fontWeight: '900' },
  link: { padding: 16, alignItems: 'center' },
  linkText: { color: '#FFFFFF', fontWeight: '700' },
});