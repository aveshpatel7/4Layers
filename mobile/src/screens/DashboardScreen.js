import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getUniversalDevices, sendUniversalCapabilityCommand } from '../api/client';
import UniversalDeviceCard from '../components/UniversalDeviceCard';

export default function DashboardScreen() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setDevices(await getUniversalDevices());
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not load GO SMART devices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const command = async (device, component, capability, value) => {
    if (!device?.presence?.online || capability?.writable !== true) return;
    const key = `${device.id}:${component.id}:${capability.id}`;
    setBusy((prev) => ({ ...prev, [key]: true }));
    try {
      await sendUniversalCapabilityCommand(device.id, component.id, capability.id, value);
      setTimeout(load, 500);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Command failed.');
    } finally {
      setBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.brand}>GO SMART</Text>
          <Text style={styles.subtitle}>Universal Home</Text>
        </View>
        <TouchableOpacity onPress={() => { setRefreshing(true); load(); }} style={styles.iconBtn}>
          <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#FFFFFF" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FFFFFF" />}
          contentContainerStyle={styles.content}
        >
          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.platformStrip}>
            <MaterialCommunityIcons name="shape-outline" size={18} color="#FFFFFF" />
            <View style={styles.platformText}>
              <Text style={styles.platformTitle}>DYNAMIC DEVICE UI</Text>
              <Text style={styles.platformSub}>Controls are generated from each device profile automatically.</Text>
            </View>
          </View>

          {devices.length === 0 && (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="home-lightning-bolt-outline" size={44} color="#FFFFFF" />
              <Text style={styles.emptyTitle}>No GO SMART device yet</Text>
              <Text style={styles.emptySub}>Add a device. Its hardware capabilities will appear here automatically.</Text>
            </View>
          )}

          {devices.map((device) => (
            <UniversalDeviceCard key={device.id} device={device} busy={busy} onCommand={command} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: { paddingTop: 48, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#171717' },
  headerText: { flex: 1 },
  brand: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', letterSpacing: 2 },
  subtitle: { color: '#808080', marginTop: 2, fontSize: 12 },
  iconBtn: { width: 42, height: 42, borderWidth: 1, borderColor: '#303030', borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  error: { color: '#FFFFFF', backgroundColor: '#111111', borderWidth: 1, borderColor: '#333333', borderRadius: 12, padding: 12, marginBottom: 12 },
  platformStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#252525', backgroundColor: '#080808', borderRadius: 16, padding: 13, marginBottom: 14 },
  platformText: { flex: 1 },
  platformTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  platformSub: { color: '#777777', fontSize: 11, marginTop: 3 },
  empty: { borderWidth: 1, borderColor: '#222222', borderRadius: 18, padding: 28, alignItems: 'center', marginTop: 30 },
  emptyTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 17, marginTop: 12 },
  emptySub: { color: '#818181', textAlign: 'center', marginTop: 6 },
});
