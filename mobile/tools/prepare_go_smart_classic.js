const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'src', 'screens', 'ProvisioningScreen.js');
let s = fs.readFileSync(file, 'utf8');

function replaceBetween(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end marker: ${endMarker}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const scanFn = `  const startScanning = async () => {
    if (Platform.OS === 'web') {
      showToast('Bluetooth scanning is not supported in the web browser.');
      return;
    }

    const hasPerms = await requestAddDevicePermissions();
    if (!hasPerms) return;

    if (!ssid.trim() || !wifiPassword.trim()) {
      showToast('Please enter your Wi-Fi SSID and Password.');
      return;
    }

    try {
      const savedPasswordsStr = (await AsyncStorage.getItem('@4Layers:wifi_passwords')) || '{}';
      const savedPasswords = JSON.parse(savedPasswordsStr);
      savedPasswords[ssid.trim()] = wifiPassword.trim();
      await AsyncStorage.setItem('@4Layers:wifi_passwords', JSON.stringify(savedPasswords));
    } catch (_) {}

    const bridge = NativeModules.GoSmartProvisioning;
    if (!bridge || !bridge.scanGoSmartDevices) {
      Alert.alert('GO SMART Find', 'GO SMART BLE provisioning module is not available in this build.');
      return;
    }

    setDevicesList([]);
    setIsScanning(true);
    setCurrentStage('SCANNING');
    setStatusText('GO SMART Find is searching nearby...');

    try {
      const found = await bridge.scanGoSmartDevices();
      const list = Array.isArray(found) ? found.map((item) => ({
        id: item.id,
        name: 'GO SMART Find',
        nodeId: item.nodeId,
        rssi: item.rssi,
      })) : [];
      setDevicesList(list);
      setStatusText(list.length ? 'GO SMART device found.' : 'Scan finished.');
    } catch (error) {
      console.error('[GO SMART Find] Scan failed:', error);
      Alert.alert('GO SMART Find', error?.message || 'Bluetooth scan failed. Ensure Bluetooth is enabled.');
      setCurrentStage('INPUT');
    } finally {
      setIsScanning(false);
    }
  };

`;

s = replaceBetween(
  s,
  '  const startScanning = async () => {',
  '  const startWifiProvisioning = async () => {',
  scanFn
);

const selectFn = `  const handleDeviceSelect = async (selectedDevice) => {
    setIsScanning(false);
    setCurrentStage('CHECKLIST');
    setChecklist({
      wifiCredentials: 'RUNNING',
      applyConnection: 'PENDING',
      provisionCloud: 'PENDING'
    });
    setStatusText('Connecting with GO SMART Find...');

    const bridge = NativeModules.GoSmartProvisioning;
    const nodeId = String(selectedDevice?.nodeId || '').trim().toUpperCase();

    try {
      if (!bridge || !bridge.provisionWifi) {
        throw new Error('GO SMART BLE provisioning module is not available.');
      }
      if (!nodeId) {
        throw new Error('Automatic Node ID was not received from this switchboard.');
      }

      setStatusText('Sending Wi-Fi credentials securely...');
      const result = await bridge.provisionWifi(
        selectedDevice.id,
        nodeId,
        ssid.trim(),
        wifiPassword.trim()
      );

      const confirmedNodeId = String(result?.nodeId || nodeId).trim().toUpperCase();
      setChecklist(prev => ({ ...prev, wifiCredentials: 'DONE', applyConnection: 'RUNNING' }));
      setStatusText(\`Wi-Fi saved. Node ID: \${confirmedNodeId}\`);

      await new Promise(resolve => setTimeout(resolve, 6000));
      setChecklist(prev => ({ ...prev, applyConnection: 'DONE', provisionCloud: 'RUNNING' }));

      const isNewRoom = selectedRoomId === 'NEW';
      let provisionResponse = null;
      let retries = 15;
      while (retries > 0) {
        try {
          provisionResponse = await provisionDevice(
            confirmedNodeId,
            deviceType,
            boardName,
            isNewRoom ? null : selectedRoomId,
            isNewRoom ? newRoomName : null,
            isNewRoom ? newRoomType : 'living_room'
          );
          break;
        } catch (apiErr) {
          retries--;
          if (retries <= 0) throw apiErr;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      const generatedDeviceId = provisionResponse?.id || provisionResponse?.device?.id || 'SUCCESS';
      setChecklist(prev => ({ ...prev, provisionCloud: 'DONE' }));
      setStatusText(\`GO SMART setup complete. Node ID: \${confirmedNodeId}\`);
      setProvisionedMac(confirmedNodeId);
      setCurrentStage('DONE');
      console.log('[GO SMART Find] Registered device:', generatedDeviceId, confirmedNodeId);
    } catch (err) {
      console.error('[GO SMART Find] Provisioning failed:', err);
      setChecklist({ wifiCredentials: 'FAILED', applyConnection: 'FAILED', provisionCloud: 'FAILED' });
      setCurrentStage('INPUT');
      setStatusText(err?.response?.data?.detail || err?.message || 'GO SMART setup failed');
      Alert.alert('Setup Issue', err?.response?.data?.detail || err?.message || 'Could not complete GO SMART device setup.');
    }
  };

`;

s = replaceBetween(
  s,
  '  const handleDeviceSelect = async (selectedDevice) => {',
  '\n\n  return (',
  selectFn
);

// Text/branding only: layout and component structure stay exactly the classic app.
s = s.replaceAll('Scanning for 4Layers devices...', 'GO SMART Find is searching nearby...');
s = s.replaceAll('Scan for 4Layers', 'GO SMART Find');
s = s.replaceAll('Waiting for 4Layers advertisement...', 'Waiting for GO SMART Find...');
s = s.replaceAll('No 4Layers devices found nearby.', 'No GO SMART devices found nearby.');
s = s.replace('<Text style={styles.deviceMac}>{item.id}</Text>', '<Text style={styles.deviceMac}>Node ID: {item.nodeId || \'Auto\'}</Text>');

fs.writeFileSync(file, s, 'utf8');

const brandFiles = [
  path.join(root, 'src', 'screens', 'LoginScreen.js'),
  path.join(root, 'src', 'screens', 'RegisterScreen.js'),
  path.join(root, 'src', 'screens', 'PostLoginOnboardingScreen.js'),
];
for (const brandFile of brandFiles) {
  if (!fs.existsSync(brandFile)) continue;
  let t = fs.readFileSync(brandFile, 'utf8');
  t = t.replace(/>4Layers</g, '>GO SMART<');
  t = t.replaceAll('4Layers Terms of Service', 'GO SMART Terms of Service');
  t = t.replaceAll('4Layers IoT Cloud', 'GO SMART IoT Cloud');
  fs.writeFileSync(brandFile, t, 'utf8');
}

console.log('GO SMART classic UI prepared: layout preserved, backend/BLE internals updated.');
