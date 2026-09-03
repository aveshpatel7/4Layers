import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { GO_SMART_BACKEND_URL } from '../api/client';

export default function GoSmartSettingsScreen() {
  const { signOut } = useAuth();
  return (
    <View style={styles.root}>
      <Text style={styles.title}>GO SMART</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Backend</Text>
        <Text style={styles.value}>{GO_SMART_BACKEND_URL}</Text>
        <Text style={styles.note}>MQTT credentials stay on the server. The app sends commands only through the GO SMART backend.</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={signOut}><Text style={styles.buttonText}>SIGN OUT</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', padding: 22, paddingTop: 50 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: 2, marginBottom: 24 },
  card: { backgroundColor: '#080808', borderWidth: 1, borderColor: '#222222', borderRadius: 18, padding: 16 },
  label: { color: '#888888', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  value: { color: '#FFFFFF', marginTop: 6, fontSize: 13 },
  note: { color: '#A0A0A0', marginTop: 12, lineHeight: 19 },
  button: { marginTop: 20, height: 50, borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '900' },
});