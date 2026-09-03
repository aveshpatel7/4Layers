import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getGoSmartDevices, sendGoSmartDeviceCommand } from '../api/client';

const Pill = ({ active, label, onPress, disabled }) => (
  <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.pill, active && styles.pillActive, disabled && { opacity: 0.35 }]}>
    <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export default function DashboardScreen() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const list = await getGoSmartDevices();
      setDevices(list);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not load GO SMART devices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [load]);

  const command = async (device, key, payload) => {
    if (!device?.presence?.online) return;
    setBusy(p => ({ ...p, [`${device.id}:${key}`]: true }));
    try {
      await sendGoSmartDeviceCommand(device.id, payload);
      setTimeout(load, 900);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Command failed.');
    } finally {
      setBusy(p => ({ ...p, [`${device.id}:${key}`]: false }));
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>GO SMART</Text>
          <Text style={styles.subtitle}>My Devices</Text>
        </View>
        <TouchableOpacity onPress={() => { setRefreshing(true); load(); }} style={styles.iconBtn}>
          <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#FFFFFF" /></View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FFFFFF" />} contentContainerStyle={styles.content}>
          {!!error && <Text style={styles.error}>{error}</Text>}
          {devices.length === 0 && (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="home-lightning-bolt-outline" size={44} color="#FFFFFF" />
              <Text style={styles.emptyTitle}>No GO SMART device yet</Text>
              <Text style={styles.emptySub}>Open Add Device and use GO SMART Find.</Text>
            </View>
          )}
          {devices.map((d) => {
            const online = !!d?.presence?.online;
            const s = d?.state || {};
            return (
              <View key={d.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deviceName}>{d.name || 'GO SMART Switchboard'}</Text>
                    <Text style={styles.nodeId}>Node ID  {d.node_id}</Text>
                  </View>
                  <View style={[styles.statusDot, online && styles.statusDotOn]} />
                  <Text style={styles.statusText}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
                </View>

                <View style={styles.divider} />
                <Text style={styles.section}>LIGHTS</Text>
                <View style={styles.rowWrap}>
                  {[1,2,3,4].map((ch) => {
                    const active = !!s[`switch${ch}`];
                    return <Pill key={ch} active={active} label={`L${ch} ${active ? 'ON' : 'OFF'}`} disabled={!online || busy[`${d.id}:s${ch}`]} onPress={() => command(d, `s${ch}`, { action: 'set_channel', channel: ch, state: !active })} />;
                  })}
                </View>

                <Text style={styles.section}>FAN</Text>
                <View style={styles.rowWrap}>
                  <Pill active={!!s.fan_power} label={s.fan_power ? 'FAN ON' : 'FAN OFF'} disabled={!online || busy[`${d.id}:fan`]} onPress={() => command(d, 'fan', { action: 'set_fan', power: !s.fan_power, speed: s.fan_speed || 1 })} />
                  {[1,2,3,4].map((speed) => <Pill key={speed} active={s.fan_power && s.fan_speed === speed} label={`${speed}`} disabled={!online || busy[`${d.id}:speed${speed}`]} onPress={() => command(d, `speed${speed}`, { action: 'set_fan', power: true, speed })} />)}
                </View>

                <View style={styles.masterRow}>
                  <TouchableOpacity disabled={!online} style={[styles.masterBtn, !online && { opacity: 0.35 }]} onPress={() => command(d, 'masteron', { action: 'master', state: true })}><Text style={styles.masterText}>MASTER ON</Text></TouchableOpacity>
                  <TouchableOpacity disabled={!online} style={[styles.masterBtn, !online && { opacity: 0.35 }]} onPress={() => command(d, 'masteroff', { action: 'master', state: false })}><Text style={styles.masterText}>MASTER OFF</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: { paddingTop: 48, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#171717' },
  brand: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', letterSpacing: 2 },
  subtitle: { color: '#808080', marginTop: 2, fontSize: 12 },
  iconBtn: { width: 42, height: 42, borderWidth: 1, borderColor: '#303030', borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  error: { color: '#FFFFFF', backgroundColor: '#111111', borderWidth: 1, borderColor: '#333333', borderRadius: 12, padding: 12, marginBottom: 12 },
  empty: { borderWidth: 1, borderColor: '#222222', borderRadius: 18, padding: 28, alignItems: 'center', marginTop: 30 },
  emptyTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 17, marginTop: 12 },
  emptySub: { color: '#818181', textAlign: 'center', marginTop: 6 },
  card: { backgroundColor: '#070707', borderWidth: 1, borderColor: '#222222', borderRadius: 20, padding: 16, marginBottom: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  deviceName: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  nodeId: { color: '#8A8A8A', marginTop: 4, fontSize: 12, fontFamily: 'monospace' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#555555', marginRight: 6 },
  statusDotOn: { backgroundColor: '#FFFFFF' },
  statusText: { color: '#BBBBBB', fontSize: 10, fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#1C1C1C', marginVertical: 14 },
  section: { color: '#777777', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8, marginTop: 4 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  pill: { minWidth: 66, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#333333', borderRadius: 12, alignItems: 'center' },
  pillActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  pillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  pillTextActive: { color: '#000000' },
  masterRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  masterBtn: { flex: 1, borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  masterText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
});