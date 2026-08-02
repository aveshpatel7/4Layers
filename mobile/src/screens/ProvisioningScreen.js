import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  FlatList,
  Linking,
  StatusBar,
  PermissionsAndroid,
  NativeModules,
  Modal
} from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, Snackbar, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BleManager } from 'react-native-ble-plx';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { provisionDevice } from '../api/client';

const TOKENS = {
  bg: '#131313',
  surface: '#1E1E1E',
  surfaceLow: '#18181B',
  accent: '#22C55E',
  border: 'rgba(255,255,255,0.05)',
  textPrimary: '#dfe2f1',
  textSecondary: '#9CA3AF',
  error: '#EF4444'
};

// BLE UUID configuration
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const WIFI_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
const MAC_CHAR_UUID = '0000ffe2-0000-1000-8000-00805f9b34fb';
const DEVICE_ID_CHAR_UUID = '0000ffe3-0000-1000-8000-00805f9b34fb';

// Base64 encoding/decoding helper functions
const base64Encode = (str) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0, len = str.length; i < len; i += 3) {
    const c1 = str.charCodeAt(i) & 0xff;
    const c2 = i + 1 < len ? str.charCodeAt(i + 1) & 0xff : NaN;
    const c3 = i + 2 < len ? str.charCodeAt(i + 2) & 0xff : NaN;
    const byte1 = c1 >> 2;
    const byte2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
    const byte3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
    const byte4 = isNaN(c3) ? 64 : c3 & 63;
    out += chars.charAt(byte1) + chars.charAt(byte2) + (byte3 === 64 ? '=' : chars.charAt(byte3)) + (byte4 === 64 ? '=' : chars.charAt(byte4));
  }
  return out;
};

const base64Decode = (str) => {
  if (!str) return '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charAt(i);
    if (char === '=') break;
    const val = chars.indexOf(char);
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
};

const ROOM_TYPES = [
  { id: 'living_room', label: 'Living Room', icon: 'sofa' },
  { id: 'kitchen', label: 'Kitchen', icon: 'chef-hat' },
  { id: 'bedroom', label: 'Bedroom', icon: 'bed' },
  { id: 'office', label: 'Office/Study', icon: 'laptop' },
  { id: 'bathroom', label: 'Bathroom', icon: 'shower' }
];

const getRoomIcon = (type) => {
  const found = ROOM_TYPES.find(r => r.id === type);
  return found ? found.icon : 'home-outline';
};

export default function ProvisioningScreen({ route, navigation }) {
  const { homeId, roomId, roomName, roomType, newRoomName: paramNewRoomName, newRoomType: paramNewRoomType } = route.params || {};

  const [manager] = useState(() => Platform.OS !== 'web' ? new BleManager() : null);
  const [isScanning, setIsScanning] = useState(false);
  const [devicesList, setDevicesList] = useState([]);
  const [statusText, setStatusText] = useState('Idle');
  const connectedDeviceIdRef = useRef(null);
  
  // Wi-Fi and setup states
  const [pairingMethod, setPairingMethod] = useState('WIFI'); // WIFI or BLE
  const [ssid, setSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showWifiInputs, setShowWifiInputs] = useState(true);
  const [deviceType, setDeviceType] = useState('light'); // light, fan, AC
  
  // Wi-Fi scanning & saved credentials state
  const [savedWifiList, setSavedWifiList] = useState([]);
  const [scannedWifiList, setScannedWifiList] = useState([]);
  const [isScanningWifi, setIsScanningWifi] = useState(false);
  const [showWifiScanModal, setShowWifiScanModal] = useState(false);
  
  // Manual onboarding states
  const [manualMacAddress, setManualMacAddress] = useState('');
  const [isProvisioningManual, setIsProvisioningManual] = useState(false);
  const [provisionedMac, setProvisionedMac] = useState('');
  
  // Room and Board states
  const [homes, setHomes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedHomeId, setSelectedHomeId] = useState(homeId || null);
  const [selectedRoomId, setSelectedRoomId] = useState(roomId || (paramNewRoomName ? 'NEW' : '')); // selected room UUID or 'NEW'
  const [newRoomName, setNewRoomName] = useState(paramNewRoomName || '');
  const [newRoomType, setNewRoomType] = useState(paramNewRoomType || 'living_room');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [boardName, setBoardName] = useState('');
  
  // Setup flow stages
  const [currentStage, setCurrentStage] = useState('ENTRY'); // ENTRY, INPUT, SCANNING, CHECKLIST, DONE, MANUAL
  const [checklist, setChecklist] = useState({
    wifiCredentials: 'PENDING', // PENDING, RUNNING, DONE, FAILED
    applyConnection: 'PENDING',
    provisionCloud: 'PENDING'
  });
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Clean up BLE manager on unmount
  useEffect(() => {
    return () => {
      if (manager) {
        manager.stopDeviceScan();
        if (connectedDeviceIdRef.current) {
          manager.cancelDeviceConnection(connectedDeviceIdRef.current)
            .catch((err) => console.warn('[BLE Clean] Cleanup connection cancel failed:', err));
        }
        manager.destroy();
      }
    };
  }, [manager]);

  const fetchHomesAndRooms = async () => {
    try {
      setLoadingRooms(true);
      const homesRes = await apiClient.get('/api/homes');
      setHomes(homesRes.data);
      
      let activeHomeId = null;
      if (homesRes.data && homesRes.data.length > 0) {
        activeHomeId = homesRes.data[0].id;
      } else {
        const createHomeRes = await apiClient.post('/api/homes', { name: 'SmartNest Home' });
        activeHomeId = createHomeRes.data.id;
        setHomes([createHomeRes.data]);
      }
      setSelectedHomeId(activeHomeId);

      const roomsRes = await apiClient.get(`/api/rooms/home/${activeHomeId}`);
      setRooms(roomsRes.data);
      if (roomsRes.data && roomsRes.data.length > 0) {
        setSelectedRoomId(roomsRes.data[0].id);
      } else {
        setSelectedRoomId('NEW');
      }
    } catch (err) {
      console.warn('[ProvisioningScreen] Error loading homes/rooms:', err);
      showToast('Failed to load rooms list.');
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (!roomId && !paramNewRoomName) {
      fetchHomesAndRooms();
    }
  }, []);

  const showToast = (msg) => {
    setSnackbarMessage(msg);
    setShowSnackbar(true);
  };

  const getTargetRoomDetails = () => {
    if (roomId && roomId !== 'NEW') {
      return {
        name: roomName || 'Selected Room',
        type: roomType || 'living_room',
        icon: getRoomIcon(roomType),
        isNew: false
      };
    } else {
      return {
        name: paramNewRoomName || 'New Room',
        type: paramNewRoomType || 'living_room',
        icon: getRoomIcon(paramNewRoomType),
        isNew: true
      };
    }
  };

  const renderRoomSummaryAndBoardField = () => {
    const details = getTargetRoomDetails();
    return (
      <View style={{ marginTop: 16 }}>
        {/* Destination Room Summary */}
        <View style={styles.connectedNetworkContainer}>
          <View style={styles.connectedNetworkHeader}>
            <View style={{ backgroundColor: TOKENS.accent, width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
              <MaterialCommunityIcons name={details.icon} size={20} color="#002112" />
            </View>
            <View style={styles.connectedNetworkTextGroup}>
              <Text style={[styles.label, { fontSize: 10, marginBottom: 2 }]}>
                {details.isNew ? 'New Room to Create' : 'Destination Room'}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: TOKENS.textPrimary }}>
                {details.name}
              </Text>
            </View>
          </View>
        </View>

        {/* Board Custom Name Prefix */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Board Name / Prefix (Optional)</Text>
          <TextInput
            value={boardName}
            onChangeText={setBoardName}
            mode="outlined"
            textColor="#FFFFFF"
            theme={{ colors: { primary: TOKENS.accent, background: TOKENS.surfaceLow } }}
            style={styles.input}
            placeholder="e.g. Main Board, TV Panel, Bedside Board"
            placeholderTextColor={TOKENS.textSecondary}
          />
        </View>
      </View>
    );
  };
  
  // Auto-detect connected Wi-Fi SSID and retrieve saved password when credentials input stage is active
  useEffect(() => {
    let unsubscribe = null;

    if (currentStage === 'INPUT') {
      const requestPermissionsAndListen = async () => {
        try {
          if (Platform.OS === 'android') {
            const hasLocationPermission = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );
            if (!hasLocationPermission) {
              await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
              );
            }
          }
        } catch (err) {
          console.warn('[Permissions] Failed to check/request location permission:', err);
        }

        // Subscribe to network state changes dynamically
        unsubscribe = NetInfo.addEventListener(async (state) => {
          if (state.type === 'wifi' && state.details && state.details.ssid) {
            const detectedSsid = state.details.ssid;
            // Clean detected SSID and ensure it is not the ESP32 setup AP itself
            const cleanSsid = detectedSsid ? detectedSsid.replace(/"/g, '') : '';
            const lowerSsid = cleanSsid.toLowerCase();
            if (cleanSsid && cleanSsid !== '<unknown ssid>' && !lowerSsid.includes('setup') && !lowerSsid.includes('smartnest')) {
              setSsid(cleanSsid);

              // Read saved password for this detected SSID from AsyncStorage
              try {
                const savedPasswordsStr = await AsyncStorage.getItem('@SmartNest:wifi_passwords');
                if (savedPasswordsStr) {
                  const savedPasswords = JSON.parse(savedPasswordsStr);
                  if (savedPasswords[cleanSsid]) {
                    setWifiPassword(savedPasswords[cleanSsid]);
                    setShowWifiInputs(false); // Hide inputs by default since password is saved
                  } else {
                    setWifiPassword('');
                    setShowWifiInputs(true);
                  }
                } else {
                  setWifiPassword('');
                  setShowWifiInputs(true);
                }
              } catch (e) {
                console.warn('[AsyncStorage] Error reading wifi passwords:', e);
                setShowWifiInputs(true);
              }
            } else {
              setShowWifiInputs(true);
            }
          } else {
            setShowWifiInputs(true);
          }
        });
      };

      requestPermissionsAndListen();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentStage]);

  const handleManualProvision = async () => {
    if (!manualMacAddress.trim()) {
      Alert.alert('Error', 'Please enter a valid MAC Address / Node ID');
      return;
    }
    if (!deviceType.trim()) {
      Alert.alert('Error', 'Please enter a device type');
      return;
    }

    try {
      setIsProvisioningManual(true);
      const isNewRoom = selectedRoomId === 'NEW';
      const res = await provisionDevice(
        manualMacAddress.trim().toUpperCase(),
        deviceType.trim().toLowerCase(),
        boardName,
        isNewRoom ? null : selectedRoomId,
        isNewRoom ? newRoomName : null,
        isNewRoom ? newRoomType : 'living_room'
      );
      
      Alert.alert(
        'Success',
        'Device registered successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('DevicesHome');
            }
          }
        ]
      );
    } catch (error) {
      console.error('[Manual Provision] Failed:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to provision device manually.');
    } finally {
      setIsProvisioningManual(false);
    }
  };

  const handleOpenWifiSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.WIFI_SETTINGS');
      } else {
        await Linking.openURL('App-Prefs:root=WIFI');
      }
    } catch (error) {
      console.error('Failed to open Wi-Fi settings:', error);
      Alert.alert('Error', 'Unable to open Wi-Fi settings. Please open them manually.');
    }
  };

  const loadSavedWifiCredentials = async () => {
    try {
      const savedPasswordsStr = await AsyncStorage.getItem('@SmartNest:wifi_passwords') || '{}';
      const savedPasswords = JSON.parse(savedPasswordsStr);
      const list = Object.entries(savedPasswords).map(([name, pass]) => ({ ssid: name, pass }));
      setSavedWifiList(list);
    } catch (e) {
      console.warn('[AsyncStorage] Error reading wifi credentials list:', e);
    }
  };

  const handleScanWifiNetworks = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Wi-Fi scanning is not supported on web.');
      return;
    }
    
    setIsScanningWifi(true);
    setShowWifiScanModal(true);
    setScannedWifiList([]);

    try {
      if (Platform.OS === 'android') {
        const hasLocationPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (!hasLocationPermission) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Location permission is required to scan Wi-Fi.');
            setIsScanningWifi(false);
            return;
          }
        }
      }

      if (NativeModules.WifiScanner) {
        const networks = await NativeModules.WifiScanner.getWifiNetworks();
        // Sort networks by signal strength descending if level exists
        if (Array.isArray(networks)) {
          networks.sort((a, b) => (b.level || 0) - (a.level || 0));
          setScannedWifiList(networks);
        }
      } else {
        // Fallback mock list if NativeModule is not registered/mocked (e.g. during development/testing)
        setTimeout(() => {
          setScannedWifiList([
            { ssid: 'Home_WiFi_5G', level: -45 },
            { ssid: 'Office_Router', level: -60 },
            { ssid: 'SmartNest_Demo_Net', level: -75 }
          ]);
          setIsScanningWifi(false);
        }, 1500);
        return;
      }
    } catch (err) {
      console.error('[WifiScan] Error:', err);
      // Fallback
      setScannedWifiList([
        { ssid: 'Home_WiFi_5G', level: -45 },
        { ssid: 'Office_Router', level: -60 }
      ]);
    } finally {
      setIsScanningWifi(false);
    }
  };

  useEffect(() => {
    if (currentStage === 'INPUT') {
      loadSavedWifiCredentials();
    }
  }, [currentStage]);

  const startScanning = async () => {
    if (Platform.OS === 'web') {
      showToast('Bluetooth scanning is not supported in the web browser. Please use the Manual Input or Wi-Fi AP Config method.');
      return;
    }

    if (!ssid.trim() || !wifiPassword.trim()) {
      showToast('Please enter your Wi-Fi SSID and Password.');
      return;
    }

    // Save this password for the SSID locally in AsyncStorage
    try {
      const savedPasswordsStr = await AsyncStorage.getItem('@SmartNest:wifi_passwords') || '{}';
      const savedPasswords = JSON.parse(savedPasswordsStr);
      savedPasswords[ssid.trim()] = wifiPassword.trim();
      await AsyncStorage.setItem('@SmartNest:wifi_passwords', JSON.stringify(savedPasswords));
    } catch (e) {
      console.warn('[AsyncStorage] Error saving wifi password:', e);
    }

    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          ]);
          const scanGranted = granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
          const connectGranted = granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
          const locationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
          
          if (!scanGranted || !connectGranted || !locationGranted) {
            Alert.alert('Permission Denied', 'Bluetooth and Location permissions are required to scan for devices.');
            return;
          }
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Location permission is required to scan for Bluetooth devices.');
            return;
          }
        }
      } catch (err) {
        console.warn('[Permissions] Error checking permissions:', err);
        return;
      }
    }

    setDevicesList([]);
    setIsScanning(true);
    setCurrentStage('SCANNING');
    setStatusText('Scanning for SmartNest devices...');

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('[BLE Scan] Error:', error);
        setIsScanning(false);
        setCurrentStage('INPUT');
        Alert.alert('Scan Error', 'Bluetooth scan failed. Ensure Bluetooth is enabled.');
        return;
      }

      // Filter by name "SmartNest"
      if (device && device.name && device.name.includes('SmartNest')) {
        setDevicesList((prevList) => {
          if (prevList.some((d) => d.id === device.id)) {
            return prevList;
          }
          return [...prevList, device];
        });
      }
    });

    // Auto-stop scan after 36 seconds (3x increase)
    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
      setStatusText('Scan finished.');
    }, 36000);
  };

  const startWifiProvisioning = async () => {
    if (!ssid.trim() || !wifiPassword.trim()) {
      showToast('Please enter your Wi-Fi SSID and Password.');
      return;
    }

    // Save this password for the SSID locally in AsyncStorage
    try {
      const savedPasswordsStr = await AsyncStorage.getItem('@SmartNest:wifi_passwords') || '{}';
      const savedPasswords = JSON.parse(savedPasswordsStr);
      savedPasswords[ssid.trim()] = wifiPassword.trim();
      await AsyncStorage.setItem('@SmartNest:wifi_passwords', JSON.stringify(savedPasswords));
    } catch (e) {
      console.warn('[AsyncStorage] Error saving wifi password:', e);
    }

    setCurrentStage('CHECKLIST');
    setChecklist({
      wifiCredentials: 'RUNNING',
      applyConnection: 'PENDING',
      provisionCloud: 'PENDING'
    });
    setStatusText('Connecting to local SmartNest Hotspot (192.168.4.1)...');

    try {
      const localUrl = `http://192.168.4.1/config?ssid=${encodeURIComponent(ssid.trim())}&pass=${encodeURIComponent(wifiPassword.trim())}`;
      console.log('[WifiProvisioning] Dispatching credentials directly to local ESP32:', localUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const response = await fetch(localUrl, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Local portal returned status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[WifiProvisioning] Local ESP32 response:', data);
      
      if (data.status !== 'success' || !data.node_id) {
        throw new Error(data.message || 'ESP32 failed to save credentials.');
      }
      
      const nodeId = data.node_id;
      setStatusText(`Credentials saved! Node ID: ${nodeId}. Waiting for device reboot...`);
      
      setChecklist(prev => ({
        ...prev,
        wifiCredentials: 'DONE',
        applyConnection: 'RUNNING'
      }));
      
      // Step 2: Applying Wi-Fi Connection
      // Give the hardware 5 seconds to boot and connect to MQTT
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      setChecklist(prev => ({
        ...prev,
        applyConnection: 'DONE',
        provisionCloud: 'RUNNING'
      }));
      
      // Step 3: Registering on Cloud (with retry loop for internet reconnection after SoftAP hotspot disconnects)
      const isNewRoom = selectedRoomId === 'NEW';
      let provisionResponse = null;
      let retries = 18; // Try up to 18 times (3x increase, total ~54 seconds)
      
      while (retries > 0) {
        try {
          setStatusText(`Registering on Cloud (Attempt ${19 - retries}/18)...`);
          provisionResponse = await provisionDevice(
            nodeId, 
            deviceType.trim().toLowerCase(),
            boardName,
            isNewRoom ? null : selectedRoomId,
            isNewRoom ? newRoomName : null,
            isNewRoom ? newRoomType : 'living_room'
          );
          break; // Success!
        } catch (apiErr) {
          retries--;
          if (retries === 0) {
            throw apiErr; // Out of retries, bubble up error
          }
          console.log('[WifiProvisioning] Cloud registry attempt failed, retrying in 3s...', apiErr);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      const generatedDeviceId = provisionResponse.id;
      setStatusText(`Cloud Registration complete: ${generatedDeviceId}`);
      
      setChecklist(prev => ({
        ...prev,
        provisionCloud: 'DONE'
      }));
      
      setProvisionedMac(nodeId);
      setCurrentStage('DONE');
    } catch (err) {
      console.error('[WifiProvisioning] Error:', err);
      setCurrentStage('INPUT');
      setChecklist({
        wifiCredentials: 'FAILED',
        applyConnection: 'FAILED',
        provisionCloud: 'FAILED'
      });
      setStatusText('Error occurred');
      
      Alert.alert(
        'Connection Failed',
        'Could not connect to the SmartNest hardware.\n\nInstructions:\n1. Open your phone\'s Wi-Fi settings.\n2. Connect to the "SmartNest-Setup-XXXXXX" network (no password).\n3. Return here and try again.',
        [
          { text: 'Open Wi-Fi Settings', onPress: handleOpenWifiSettings },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const handleDeviceSelect = async (selectedDevice) => {
    manager.stopDeviceScan();
    setIsScanning(false);
    setCurrentStage('CHECKLIST');
    setChecklist({
      wifiCredentials: 'RUNNING',
      applyConnection: 'PENDING',
      provisionCloud: 'PENDING'
    });
    setStatusText(`Connecting to ${selectedDevice.name}...`);

    try {
      // 1. Connect to BLE device
      connectedDeviceIdRef.current = selectedDevice.id;
      const connectedDevice = await manager.connectToDevice(selectedDevice.id);
      setStatusText('Connected! Discovering services...');
      await connectedDevice.discoverAllServicesAndCharacteristics();

      // 2. Send Wi-Fi SSID and Password
      setStatusText('Sending Wi-Fi credentials...');
      const wifiPayload = JSON.stringify({ ssid: ssid.trim(), pass: wifiPassword.trim() });
      const encodedWifi = base64Encode(wifiPayload);
      
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        WIFI_CHAR_UUID,
        encodedWifi
      );

      // 3. Read MAC Address
      setStatusText('Retrieving hardware identity MAC...');
      const charMac = await connectedDevice.readCharacteristicForService(
        SERVICE_UUID,
        MAC_CHAR_UUID
      );
      const decodedMac = base64Decode(charMac.value).trim();
      setStatusText(`MAC Address Received: ${decodedMac}`);

      // WiFi credentials successfully sent to device
      setChecklist(prev => ({
        ...prev,
        wifiCredentials: 'DONE',
        applyConnection: 'RUNNING'
      }));

      const isNewRoom = selectedRoomId === 'NEW';
      let provisionResponse = null;
      let retries = 18; // Try up to 18 times (3x increase, total ~54 seconds)
      
      while (retries > 0) {
        try {
          setStatusText(`Registering on Cloud (Attempt ${19 - retries}/18)...`);
          provisionResponse = await provisionDevice(
            decodedMac, 
            deviceType,
            boardName,
            isNewRoom ? null : selectedRoomId,
            isNewRoom ? newRoomName : null,
            isNewRoom ? newRoomType : 'living_room'
          );
          break; // Success!
        } catch (apiErr) {
          retries--;
          if (retries === 0) {
            throw apiErr; // Out of retries, bubble up error
          }
          console.log('[BLEProvisioning] Cloud registry attempt failed, retrying in 3s...', apiErr);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      const generatedDeviceId = provisionResponse.id;
      setStatusText(`Cloud Registration complete: ${generatedDeviceId}`);

      // WiFi connection and cloud registration succeeded
      setChecklist(prev => ({
        ...prev,
        applyConnection: 'DONE',
        provisionCloud: 'RUNNING'
      }));

      // 5. Send UUID back to NVS (optional, handle gracefully if board already rebooted and disconnected)
      try {
        setStatusText('Writing UUID configuration to NVS...');
        const encodedUuid = base64Encode(generatedDeviceId);
        await connectedDevice.writeCharacteristicWithResponseForService(
          SERVICE_UUID,
          DEVICE_ID_CHAR_UUID,
          encodedUuid
        );
      } catch (writeErr) {
        console.warn('[BLEProvisioning] Optional UUID write failed (device may have rebooted):', writeErr);
      }

      // 6. Complete provisioning
      setStatusText('Provisioning success!');
      setChecklist(prev => ({
        ...prev,
        provisionCloud: 'DONE'
      }));
      setProvisionedMac(decodedMac);
      setCurrentStage('DONE');
      
      // Disconnect
      connectedDeviceIdRef.current = null;
      await manager.cancelDeviceConnection(selectedDevice.id);
    } catch (err) {
      connectedDeviceIdRef.current = null;
      console.error('[Provisioning] Error:', err);
      setCurrentStage('INPUT');
      setChecklist({
        wifiCredentials: 'FAILED',
        applyConnection: 'FAILED',
        provisionCloud: 'FAILED'
      });
      setStatusText('Error occurred');
      Alert.alert('Setup Failed', err.message || 'An error occurred during the hardware pairing handshake.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.appHeader}>
        <TouchableOpacity 
          onPress={() => {
            if (currentStage === 'ENTRY') {
              navigation.goBack();
            } else if (currentStage === 'INPUT') {
              setCurrentStage('ENTRY');
            } else if (currentStage === 'SCANNING') {
              manager.stopDeviceScan();
              setCurrentStage('INPUT');
            } else {
              setCurrentStage('ENTRY');
            }
          }} 
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={TOKENS.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Provision Node</Text>
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContainer,
          currentStage === 'CHECKLIST' && { flexGrow: 1, justifyContent: 'center' }
        ]} 
        keyboardShouldPersistTaps="handled"
      >
        
        {/* Onboarding Method Entry Selection */}
        {currentStage === 'ENTRY' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add New Device</Text>
            <Text style={styles.entryIntro}>Choose your preferred pairing method to provision a new switchboard node:</Text>
            
            <TouchableOpacity 
              style={styles.entryMethodButton} 
              onPress={() => {
                setPairingMethod('BLE');
                setCurrentStage('INPUT');
              }}
            >
              <MaterialCommunityIcons name="bluetooth" size={24} color={TOKENS.accent} />
              <View style={styles.entryMethodTextGroup}>
                <Text style={styles.entryMethodTitle}>Provision via Bluetooth (BLE)</Text>
                <Text style={styles.entryMethodSubtitle}>Pair using Bluetooth scan</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={TOKENS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.entryMethodButton} 
              onPress={() => {
                setPairingMethod('WIFI');
                setCurrentStage('INPUT');
              }}
            >
              <MaterialCommunityIcons name="wifi" size={24} color={TOKENS.accent} />
              <View style={styles.entryMethodTextGroup}>
                <Text style={styles.entryMethodTitle}>Provision via SoftAP</Text>
                <Text style={styles.entryMethodSubtitle}>Connect via Wi-Fi hotspot</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={TOKENS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.entryMethodButton} 
              onPress={() => Alert.alert("QR Scanner", "QR onboarding is available for pre-registered factory hardware hubs only.")}
            >
              <MaterialCommunityIcons name="qrcode-scan" size={24} color={TOKENS.textSecondary} />
              <View style={styles.entryMethodTextGroup}>
                <Text style={styles.entryMethodTitle}>Scan Device QR Code</Text>
                <Text style={styles.entryMethodSubtitle}>Quick pairing scanning option</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={TOKENS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.entryMethodButton} 
              onPress={() => setCurrentStage('MANUAL')}
            >
              <MaterialCommunityIcons name="keyboard-outline" size={24} color={TOKENS.accent} />
              <View style={styles.entryMethodTextGroup}>
                <Text style={styles.entryMethodTitle}>Add Node Manually</Text>
                <Text style={styles.entryMethodSubtitle}>Provide MAC Address config details</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={TOKENS.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Credentials Form */}
        {currentStage === 'INPUT' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>1. Config Credentials</Text>
            

            
            {showWifiInputs ? (
              <>
                {savedWifiList.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.label, { marginBottom: 6 }]}>Saved Wi-Fi Networks</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {savedWifiList.map((net, index) => (
                        <TouchableOpacity
                          key={index}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSsid(net.ssid);
                            setWifiPassword(net.pass);
                          }}
                          style={{
                            backgroundColor: ssid === net.ssid ? 'rgba(34, 197, 94, 0.15)' : TOKENS.surfaceLow,
                            borderColor: ssid === net.ssid ? TOKENS.accent : TOKENS.border,
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <MaterialCommunityIcons name="wifi" size={14} color={ssid === net.ssid ? TOKENS.accent : TOKENS.textSecondary} />
                          <Text style={{ color: ssid === net.ssid ? '#FFFFFF' : TOKENS.textSecondary, fontSize: 12, fontWeight: 'bold' }}>
                            {net.ssid}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.label}>Wi-Fi SSID</Text>
                    <TouchableOpacity 
                      onPress={handleScanWifiNetworks} 
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <MaterialCommunityIcons name="magnify" size={16} color={TOKENS.accent} />
                      <Text style={{ color: TOKENS.accent, fontSize: 12, fontWeight: 'bold' }}>Scan Networks</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={ssid}
                    onChangeText={setSsid}
                    mode="outlined"
                    textColor="#FFFFFF"
                    theme={{ colors: { primary: TOKENS.accent, background: TOKENS.surfaceLow } }}
                    style={styles.input}
                    placeholder="Enter router SSID"
                    placeholderTextColor={TOKENS.textSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Wi-Fi Password</Text>
                  <TextInput
                    value={wifiPassword}
                    onChangeText={setWifiPassword}
                    mode="outlined"
                    secureTextEntry
                    textColor="#FFFFFF"
                    theme={{ colors: { primary: TOKENS.accent, background: TOKENS.surfaceLow } }}
                    style={styles.input}
                    placeholder="Enter router password"
                    placeholderTextColor={TOKENS.textSecondary}
                  />
                </View>
              </>
            ) : (
              <View style={styles.connectedNetworkContainer}>
                <View style={styles.connectedNetworkHeader}>
                  <MaterialCommunityIcons name="wifi" size={28} color={TOKENS.accent} />
                  <View style={styles.connectedNetworkTextGroup}>
                    <Text style={styles.connectedNetworkLabel}>Target Wi-Fi Network</Text>
                    <Text style={styles.connectedNetworkValue}>{ssid || 'Connected'}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.changeNetworkButton}
                  onPress={() => setShowWifiInputs(true)}
                >
                  <MaterialCommunityIcons name="cog-outline" size={16} color={TOKENS.accent} />
                  <Text style={styles.changeNetworkButtonText}>Change Wi-Fi or Password</Text>
                </TouchableOpacity>
              </View>
            )}





            {renderRoomSummaryAndBoardField()}

            {pairingMethod === 'WIFI' ? (
              <Button
                mode="contained"
                onPress={startWifiProvisioning}
                style={styles.primaryBtn}
                labelStyle={styles.primaryBtnText}
                icon="wifi"
              >
                Connect via SoftAP
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={startScanning}
                style={styles.primaryBtn}
                labelStyle={styles.primaryBtnText}
                icon="bluetooth"
              >
                Scan for SmartNest
              </Button>
            )}
          </View>
        )}

        {/* Scanning and Bluetooth Scan List */}
        {currentStage === 'SCANNING' && (
          <View style={styles.card}>
            <Text style={styles.statusHeading}>{statusText}</Text>
            <View style={styles.listContainer}>
              {devicesList.length === 0 ? (
                <View style={styles.emptyScan}>
                  {isScanning ? (
                    <>
                      <ActivityIndicator size="small" color={TOKENS.accent} style={{ marginBottom: 12 }} />
                      <Text style={styles.scanText}>Waiting for SmartNest advertisement...</Text>
                    </>
                  ) : (
                    <View style={{ alignItems: 'center', width: '100%', paddingHorizontal: 12 }}>
                      <MaterialCommunityIcons name="bluetooth-off" size={40} color={TOKENS.textSecondary} style={{ marginBottom: 12 }} />
                      <Text style={[styles.scanText, { color: TOKENS.error, fontWeight: 'bold', fontSize: 14, textAlign: 'center' }]}>
                        No SmartNest devices found nearby.
                      </Text>
                      <Text style={{ fontSize: 12, color: TOKENS.textSecondary, marginTop: 6, marginBottom: 16, textAlign: 'center', lineHeight: 16 }}>
                        Ensure your switchboard hardware is powered ON and within range.
                      </Text>
                      <Button
                        mode="contained"
                        onPress={startScanning}
                        style={[styles.primaryBtn, { width: '100%', marginBottom: 8 }]}
                        labelStyle={styles.primaryBtnText}
                        icon="refresh"
                      >
                        Retry Scan
                      </Button>
                    </View>
                  )}
                </View>
              ) : (
                <FlatList
                  data={devicesList}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.deviceRow}
                      onPress={() => handleDeviceSelect(item)}
                    >
                      <MaterialCommunityIcons name="bluetooth-connect" size={24} color={TOKENS.accent} />
                      <View style={styles.deviceInfo}>
                        <Text style={styles.deviceName}>{item.name}</Text>
                        <Text style={styles.deviceMac}>{item.id}</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={TOKENS.textSecondary} />
                    </TouchableOpacity>
                  )}
                />
              )}
              
              <Button
                mode="outlined"
                onPress={() => {
                  manager.stopDeviceScan();
                  setCurrentStage('INPUT');
                }}
                style={styles.abortBtn}
                textColor={TOKENS.error}
              >
                Abort Scan
              </Button>
            </View>
          </View>
        )}

        {/* Checklist Progress UI */}
        {currentStage === 'CHECKLIST' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Provisioning Progress</Text>
            
            <View style={styles.checklistContainer}>
              {/* Step 1: wifiCredentials */}
              <View style={styles.checkItem}>
                <View style={[
                  styles.checkCircle,
                  checklist.wifiCredentials === 'DONE' && styles.checkCircleDone,
                  checklist.wifiCredentials === 'RUNNING' && styles.checkCircleRunning
                ]}>
                  {checklist.wifiCredentials === 'DONE' ? (
                    <MaterialCommunityIcons name="check" size={16} color="#002112" />
                  ) : checklist.wifiCredentials === 'RUNNING' ? (
                    <ActivityIndicator size="small" color={TOKENS.accent} />
                  ) : (
                    <Text style={styles.checkNumber}>1</Text>
                  )}
                </View>
                <Text style={[
                  styles.checkLabel,
                  checklist.wifiCredentials === 'RUNNING' && styles.checkLabelActive,
                  checklist.wifiCredentials === 'DONE' && styles.checkLabelCompleted
                ]}>
                  Sending Wi-Fi credentials
                </Text>
              </View>

              {/* Step 2: applyConnection */}
              <View style={styles.checkItem}>
                <View style={[
                  styles.checkCircle,
                  checklist.applyConnection === 'DONE' && styles.checkCircleDone,
                  checklist.applyConnection === 'RUNNING' && styles.checkCircleRunning
                ]}>
                  {checklist.applyConnection === 'DONE' ? (
                    <MaterialCommunityIcons name="check" size={16} color="#002112" />
                  ) : checklist.applyConnection === 'RUNNING' ? (
                    <ActivityIndicator size="small" color={TOKENS.accent} />
                  ) : (
                    <Text style={styles.checkNumber}>2</Text>
                  )}
                </View>
                <Text style={[
                  styles.checkLabel,
                  checklist.applyConnection === 'RUNNING' && styles.checkLabelActive,
                  checklist.applyConnection === 'DONE' && styles.checkLabelCompleted
                ]}>
                  Applying Wi-Fi connection
                </Text>
              </View>

              {/* Step 3: provisionCloud */}
              <View style={styles.checkItem}>
                <View style={[
                  styles.checkCircle,
                  checklist.provisionCloud === 'DONE' && styles.checkCircleDone,
                  checklist.provisionCloud === 'RUNNING' && styles.checkCircleRunning
                ]}>
                  {checklist.provisionCloud === 'DONE' ? (
                    <MaterialCommunityIcons name="check" size={16} color="#002112" />
                  ) : checklist.provisionCloud === 'RUNNING' ? (
                    <ActivityIndicator size="small" color={TOKENS.accent} />
                  ) : (
                    <Text style={styles.checkNumber}>3</Text>
                  )}
                </View>
                <Text style={[
                  styles.checkLabel,
                  checklist.provisionCloud === 'RUNNING' && styles.checkLabelActive,
                  checklist.provisionCloud === 'DONE' && styles.checkLabelCompleted
                ]}>
                  Checking provisioning status
                </Text>
              </View>
            </View>

            <Text style={styles.progressStatusText}>{statusText}</Text>
          </View>
        )}

        {/* Done success Stage */}
        {currentStage === 'DONE' && (
          <View style={styles.card}>
            <View style={styles.doneIconContainer}>
              <MaterialCommunityIcons name="check-circle" size={64} color={TOKENS.accent} />
            </View>
            <Text style={styles.doneHeading}>Onboarding Complete!</Text>
            <Text style={styles.doneMessage}>
              Your switchboard hardware has been provisioned and registered successfully. 7 device channels have been auto-created!
            </Text>
            
            <Button
              mode="contained"
              onPress={() => {
                navigation.navigate('DevicesHome');
              }}
              style={styles.primaryBtn}
              labelStyle={styles.primaryBtnText}
            >
              Go to Dashboard
            </Button>
          </View>
        )}

        {/* Manual Setup Stage */}
        {currentStage === 'MANUAL' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Manual Device Registry</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>MAC Address / Node ID</Text>
              <TextInput
                value={manualMacAddress}
                onChangeText={setManualMacAddress}
                mode="outlined"
                textColor="#FFFFFF"
                theme={{ colors: { primary: TOKENS.accent, background: TOKENS.surfaceLow } }}
                style={styles.input}
                placeholder="e.g. AA:BB:CC:DD:EE:FF or ESP32_CHIP_01"
                placeholderTextColor={TOKENS.textSecondary}
                autoCapitalize="characters"
              />
            </View>



            {renderRoomSummaryAndBoardField()}

            <Button
              mode="contained"
              onPress={handleManualProvision}
              loading={isProvisioningManual}
              disabled={isProvisioningManual}
              style={styles.primaryBtn}
              labelStyle={styles.primaryBtnText}
              icon="plus"
            >
              Add Device Node
            </Button>

            <Button
              mode="outlined"
              onPress={() => setCurrentStage('ENTRY')}
              disabled={isProvisioningManual}
              style={styles.abortBtn}
              textColor={TOKENS.textSecondary}
            >
              Cancel
            </Button>
          </View>
        )}

      </ScrollView>

      <Snackbar
        visible={showSnackbar}
        onDismiss={() => setShowSnackbar(false)}
        duration={3000}
        style={styles.snackbar}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
          {snackbarMessage}
        </Text>
      </Snackbar>

      <Modal
        visible={showWifiScanModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWifiScanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Wi-Fi Network</Text>
              <TouchableOpacity onPress={() => setShowWifiScanModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={TOKENS.textSecondary} />
              </TouchableOpacity>
            </View>

            {isScanningWifi ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={TOKENS.accent} />
                <Text style={styles.modalLoadingText}>Scanning for nearby networks...</Text>
              </View>
            ) : scannedWifiList.length === 0 ? (
              <View style={styles.modalEmpty}>
                <MaterialCommunityIcons name="wifi-off" size={48} color={TOKENS.textSecondary} />
                <Text style={styles.modalEmptyText}>No networks found.</Text>
                <Text style={styles.modalEmptySubtext}>
                  Make sure Location/GPS is turned ON in settings so the app is allowed to scan.
                </Text>
                <TouchableOpacity style={styles.modalRefreshBtn} onPress={handleScanWifiNetworks}>
                  <MaterialCommunityIcons name="refresh" size={16} color="#000000" />
                  <Text style={styles.modalRefreshText}>Rescan</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={scannedWifiList}
                keyExtractor={(item, index) => `${item.ssid}_${index}`}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.wifiItem}
                    onPress={() => {
                      setSsid(item.ssid);
                      // Look up saved password
                      const matched = savedWifiList.find(s => s.ssid === item.ssid);
                      if (matched) {
                        setWifiPassword(matched.pass);
                      } else {
                        setWifiPassword('');
                      }
                      setShowWifiScanModal(false);
                    }}
                  >
                    <View style={styles.wifiItemLeft}>
                      <MaterialCommunityIcons name="wifi" size={20} color={TOKENS.accent} />
                      <Text style={styles.wifiItemName}>{item.ssid}</Text>
                    </View>
                    <View style={styles.wifiItemRight}>
                      {item.level && (
                        <Text style={styles.wifiSignalStrength}>
                          {item.level > -50 ? 'Strong' : (item.level > -70 ? 'Medium' : 'Weak')}
                        </Text>
                      )}
                      <MaterialCommunityIcons name="chevron-right" size={20} color={TOKENS.textSecondary} />
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border
  },
  backBtn: {
    marginRight: 16
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TOKENS.textPrimary
  },
  scrollContainer: {
    padding: 16
  },
  card: {
    backgroundColor: TOKENS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TOKENS.accent,
    marginBottom: 16
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: TOKENS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  input: {
    backgroundColor: TOKENS.surfaceLow
  },
  segmented: {
    marginTop: 4
  },
  segButtonActive: {
    backgroundColor: TOKENS.accent
  },
  segButtonInactive: {
    backgroundColor: TOKENS.surfaceLow
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: TOKENS.accent,
    borderRadius: 12,
    paddingVertical: 4
  },
  primaryBtnText: {
    color: '#002112',
    fontWeight: '800'
  },
  statusHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.textPrimary,
    textAlign: 'center',
    marginVertical: 12
  },
  listContainer: {
    marginTop: 16,
    maxHeight: 300
  },
  emptyScan: {
    alignItems: 'center',
    paddingVertical: 32
  },
  scanText: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    textAlign: 'center'
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: TOKENS.surfaceLow,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  deviceInfo: {
    flex: 1,
    marginLeft: 12
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.textPrimary
  },
  deviceMac: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    marginTop: 2
  },
  abortBtn: {
    marginTop: 16,
    borderColor: TOKENS.error,
    borderRadius: 12
  },
  snackbar: {
    backgroundColor: '#B91C1C',
    borderRadius: 8
  },
  entryIntro: {
    fontSize: 13,
    color: TOKENS.textSecondary,
    marginBottom: 20,
    lineHeight: 18
  },
  entryMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: TOKENS.surfaceLow,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
    marginBottom: 12,
    gap: 16
  },
  entryMethodTextGroup: {
    flex: 1
  },
  entryMethodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.textPrimary
  },
  entryMethodSubtitle: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    marginTop: 2
  },
  checklistContainer: {
    marginVertical: 24,
    gap: 16
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TOKENS.surfaceLow,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkCircleRunning: {
    borderColor: TOKENS.accent,
    backgroundColor: 'rgba(34, 197, 94, 0.05)'
  },
  checkCircleDone: {
    borderColor: TOKENS.accent,
    backgroundColor: TOKENS.accent
  },
  checkNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: TOKENS.textSecondary
  },
  checkLabel: {
    fontSize: 13,
    color: TOKENS.textSecondary
  },
  checkLabelActive: {
    color: TOKENS.accent,
    fontWeight: '700'
  },
  checkLabelCompleted: {
    color: TOKENS.textPrimary
  },
  progressStatusText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: TOKENS.textSecondary,
    textAlign: 'center',
    marginTop: 8
  },
  doneIconContainer: {
    alignItems: 'center',
    marginVertical: 20
  },
  doneHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    textAlign: 'center',
    marginBottom: 12
  },
  doneMessage: {
    fontSize: 13,
    color: TOKENS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 12
  },
  connectedNetworkContainer: {
    backgroundColor: TOKENS.surfaceLow,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    marginBottom: 20
  },
  connectedNetworkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  connectedNetworkTextGroup: {
    flex: 1
  },
  connectedNetworkLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TOKENS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  connectedNetworkValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TOKENS.textPrimary
  },
  changeNetworkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.02)'
  },
  changeNetworkButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: TOKENS.accent
  },
  roomSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  roomSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: TOKENS.surfaceLow,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TOKENS.border,
    gap: 8
  },
  roomSelectItemActive: {
    borderColor: TOKENS.accent,
    backgroundColor: TOKENS.accent
  },
  roomSelectLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.textSecondary
  },
  roomSelectLabelActive: {
    color: '#002112',
    fontWeight: '700'
  },
  newRoomForm: {
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: TOKENS.surfaceLow,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TOKENS.border,
    gap: 6
  },
  typeCardSelected: {
    borderColor: TOKENS.accent,
    backgroundColor: TOKENS.accent
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TOKENS.textSecondary
  },
  typeLabelSelected: {
    color: '#002112',
    fontWeight: '700'
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)'
  },
  warningText: {
    fontSize: 12,
    color: '#dfe2f1',
    flex: 1,
    lineHeight: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: TOKENS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 400,
    maxHeight: '80%',
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF'
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16
  },
  modalLoadingText: {
    color: TOKENS.textSecondary,
    fontSize: 13
  },
  modalEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12
  },
  modalEmptyText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold'
  },
  modalEmptySubtext: {
    color: TOKENS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18
  },
  modalRefreshBtn: {
    backgroundColor: TOKENS.accent,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 12
  },
  modalRefreshText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold'
  },
  wifiItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 8,
    marginBottom: 8
  },
  wifiItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  wifiItemName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  wifiItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  wifiSignalStrength: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  }
});
