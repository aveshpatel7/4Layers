import React, { useState } from 'react';
import { NativeModules, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { requestAddDevicePermissions } from '../utils/permissions';
import { provisionDevice } from '../api/client';

const { GoSmartProvisioning } = NativeModules;

export default function ProvisioningScreen({ navigation }) {
  const [stage, setStage] = useState('SCAN');
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('Ready to find a GO SMART switchboard.');
  const [error, setError] = useState('');

  const scan = async () => {
    setError('');
    const ok = await requestAddDevicePermissions();
    if (!ok) return;
    if (!GoSmartProvisioning?.scanGoSmartDevices) {
      setError('GO SMART BLE module is not available in this build.');
      return;
    }
    setScanning(true);
    setDevices([]);
    setStatus('Finding GO SMART devices nearby...');
    try {
      const result = await GoSmartProvisioning.scanGoSmartDevices();
      const list = Array.isArray(result) ? result : [];
      setDevices(list);
      setStatus(list.length ? 'GO SMART Find ready.' : 'No GO SMART device found nearby.');
    } catch (e) {
      setError(e?.message || 'Bluetooth scan failed.');
      setStatus('Scan stopped.');
    } finally {
      setScanning(false);
    }
  };

  const choose = (device) => {
    setSelected(device);
    setStage('WIFI');
    setStatus('GO SMART Find selected. Enter your 2.4 GHz Wi-Fi.');
  };

  const provision = async () => {
    if (!selected || !ssid.trim() || !password) {
      setError('Select GO SMART Find and enter Wi-Fi SSID/password.');
      return;
    }
    setError('');
    setStage('PROVISION');
    setStatus('Connecting securely over BLE...');
    try {
      const result = await GoSmartProvisioning.provisionWifi(selected.id, selected.nodeId, ssid.trim(), password);
      if (!result?.ok) throw new Error('Provisioning failed.');
      setStatus('Wi-Fi connected. Checking your GO SMART backend...');
      await new Promise(r => setTimeout(r, 2500));
      await provisionDevice(selected.nodeId);
      setStatus('Setup complete.');
      setStage('DONE');
    } catch (e) {
      setError(e?.message || 'Could not complete device setup.');
      setStatus('Setup not completed.');
      setStage('WIFI');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>GO SMART</Text>
        <Text style={styles.subtitle}>Add Device</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {stage === 'SCAN' && (
          <View style={styles.card}>
            <View style={styles.findCircle}><MaterialCommunityIcons name="bluetooth" size={42} color="#FFFFFF" /></View>
            <Text style={styles.title}>GO SMART Find</Text>
            <Text style={styles.body}>Power the switchboard and keep your phone nearby. Device numbers are hidden here; the Node ID is created automatically.</Text>
            <TouchableOpacity onPress={scan} disabled={scanning} style={styles.primary}>
              {scanning ? <ActivityIndicator color="#000000" /> : <Text style={styles.primaryText}>FIND DEVICE</Text>}
            </TouchableOpacity>
            {!!devices.length && (
              <View style={{ marginTop: 18 }}>
                {devices.map((d) => (
                  <TouchableOpacity key={d.id} style={styles.deviceRow} onPress={() => choose(d)}>
                    <View style={styles.smallCircle}><MaterialCommunityIcons name="bluetooth-connect" size={22} color="#FFFFFF" /></View>
                    <View style={{ flex: 1 }}><Text style={styles.deviceName}>GO SMART Find</Text><Text style={styles.deviceHint}>Ready to connect</Text></View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {stage === 'WIFI' && (
          <View style={styles.card}>
            <Text style={styles.title}>Connect GO SMART</Text>
            <Text style={styles.body}>The app already identified the board internally. No Node ID entry is required.</Text>
            <TextInput label="2.4 GHz Wi-Fi SSID" value={ssid} onChangeText={setSsid} mode="outlined" textColor="#FFFFFF" style={styles.input} outlineColor="#333333" activeOutlineColor="#FFFFFF" />
            <TextInput label="Wi-Fi Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} mode="outlined" textColor="#FFFFFF" style={styles.input} outlineColor="#333333" activeOutlineColor="#FFFFFF" right={<TextInput.Icon icon={showPassword ? 'eye-off-outline' : 'eye-outline'} color="#FFFFFF" onPress={() => setShowPassword(v => !v)} />} />
            <TouchableOpacity onPress={provision} style={styles.primary}><Text style={styles.primaryText}>CONNECT</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setStage('SCAN'); setSelected(null); }} style={styles.secondary}><Text style={styles.secondaryText}>Back</Text></TouchableOpacity>
          </View>
        )}

        {stage === 'PROVISION' && (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: 44 }]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={[styles.title, { marginTop: 18 }]}>Setting up GO SMART</Text>
            <Text style={[styles.body, { textAlign: 'center' }]}>{status}</Text>
          </View>
        )}

        {stage === 'DONE' && (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <View style={styles.doneCircle}><MaterialCommunityIcons name="check" size={38} color="#000000" /></View>
            <Text style={[styles.title, { marginTop: 16 }]}>Connected</Text>
            <Text style={styles.nodeLabel}>NODE ID</Text>
            <Text style={styles.nodeValue}>{selected?.nodeId}</Text>
            <Text style={[styles.body, { textAlign: 'center' }]}>This Node ID was created automatically from the switchboard identity and is now shown inside your GO SMART app.</Text>
            <TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('Home')}><Text style={styles.primaryText}>GO TO HOME</Text></TouchableOpacity>
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.status}>{status}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: { paddingTop: 48, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#171717' },
  brand: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', letterSpacing: 2 },
  subtitle: { color: '#808080', marginTop: 2, fontSize: 12 },
  content: { padding: 16, paddingBottom: 42 },
  card: { backgroundColor: '#070707', borderWidth: 1, borderColor: '#222222', borderRadius: 20, padding: 18 },
  findCircle: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderColor: '#FFFFFF', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  smallCircle: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#333333', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  title: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  body: { color: '#929292', lineHeight: 20, marginBottom: 16 },
  primary: { minHeight: 52, backgroundColor: '#FFFFFF', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 18 },
  primaryText: { color: '#000000', fontWeight: '900', letterSpacing: 0.7 },
  secondary: { minHeight: 46, borderWidth: 1, borderColor: '#333333', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { color: '#FFFFFF', fontWeight: '800' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#292929', borderRadius: 14, padding: 12, marginBottom: 8 },
  deviceName: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  deviceHint: { color: '#777777', fontSize: 11, marginTop: 2 },
  input: { backgroundColor: '#070707', marginBottom: 12 },
  doneCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  nodeLabel: { color: '#777777', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 10 },
  nodeValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', fontFamily: 'monospace', marginTop: 3, marginBottom: 12 },
  error: { color: '#FFFFFF', backgroundColor: '#111111', borderWidth: 1, borderColor: '#333333', borderRadius: 12, padding: 12, marginTop: 12 },
  status: { color: '#686868', textAlign: 'center', fontSize: 11, marginTop: 14 },
});