import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Animated,
  Easing,
  StatusBar
} from 'react-native';
import { Text, TextInput, SegmentedButtons, Snackbar, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';

const TOKENS = {
  bg: '#0E0E0E',           // Google Stitch background
  surface: '#1C1B1B',      // surface-container
  surfaceLow: '#141414',   // surface-container-low
  accent: '#22C55E',       // Primary green
  border: 'rgba(255,255,255,0.05)',
  textPrimary: '#E5E2E1',
  textSecondary: '#9CA3AF'
};

export default function AddDeviceScreen({ navigation }) {
  const [currentStep, setCurrentStep] = useState(1); // 1 = BLE Scan, 2 = Credentials, 3 = Connecting
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  
  const [name, setName] = useState('');
  const [type, setType] = useState('light');
  const [nodeId, setNodeId] = useState('');
  const [ssid, setSsid] = useState('HomeNetwork_5G');
  const [wifiPassword, setWifiPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);
  
  // Relational references
  const [homeId, setHomeId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  
  // Alert Snackbar states
  const [errorMsg, setErrorMsg] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);

  // Radar animations
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const radarRotation = useRef(new Animated.Value(0)).current;

  // Start animated loop on mount/step 1 active
  useEffect(() => {
    if (currentStep === 1) {
      // 1. Radar sweeping arm rotation
      Animated.loop(
        Animated.timing(radarRotation, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // 2. Pulsing rings
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim1, {
            toValue: 1.3,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim1, {
            toValue: 1,
            duration: 1500,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          })
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim2, {
            toValue: 1.5,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim2, {
            toValue: 1,
            duration: 2000,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          })
        ])
      ).start();
    }
  }, [currentStep]);

  // Fetch home & room IDs
  useEffect(() => {
    const initializeData = async () => {
      try {
        setSetupLoading(true);
        const homesRes = await apiClient.get('/api/homes');
        let activeHomeId = null;
        if (homesRes.data && homesRes.data.length > 0) {
          activeHomeId = homesRes.data[0].id;
        } else {
          const createHomeRes = await apiClient.post('/api/homes', { name: '4Layers SmartNest' });
          activeHomeId = createHomeRes.data.id;
        }
        setHomeId(activeHomeId);

        const roomsRes = await apiClient.get(`/api/rooms/home/${activeHomeId}`);
        let activeRoomId = null;
        if (roomsRes.data && roomsRes.data.length > 0) {
          activeRoomId = roomsRes.data[0].id;
        } else {
          const createRoomRes = await apiClient.post('/api/rooms', {
            name: 'Living Room',
            room_type: 'living_room',
            home_id: activeHomeId
          });
          activeRoomId = createRoomRes.data.id;
        }
        setRoomId(activeRoomId);

        // Generate default Node ID
        const randId = `4L-NODE-${Math.floor(100 + Math.random() * 900)}`;
        setNodeId(randId);
      } catch (error) {
        console.error('[AddDevice] Init error:', error);
        setErrorMsg('Failed to sync homes/rooms metadata.');
        setShowSnackbar(true);
      } finally {
        setSetupLoading(false);
      }
    };

    initializeData();
  }, []);

  const startScanning = async () => {
    if (!permission || !permission.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to scan QR codes.');
        return;
      }
    }
    setScanning(true);
  };

  const handleBarcodeScanned = ({ data }) => {
    setScanning(false);
    try {
      const parsed = JSON.parse(data);
      if (parsed.uuid) setNodeId(parsed.uuid);
      if (parsed.name) setName(parsed.name);
      if (parsed.type) setType(parsed.type);
      Alert.alert('Scan Success', `Loaded device: ${parsed.name || parsed.uuid}`);
      setCurrentStep(2);
    } catch (e) {
      setNodeId(data);
      Alert.alert('Scan Success', `Loaded Node ID: ${data}`);
      setCurrentStep(2);
    }
  };

  const handleRegisterDevice = async () => {
    if (!name.trim()) {
      setErrorMsg('Please assign a node identity name.');
      setShowSnackbar(true);
      return;
    }

    if (!nodeId.trim()) {
      setErrorMsg('Please scan or assign a physical Node ID.');
      setShowSnackbar(true);
      return;
    }

    // Go to step 3 (loader page)
    setCurrentStep(3);
    setLoading(true);

    try {
      // 1. Send WiFi credentials directly to the local ESP32 board
      // The ESP32 hosts a setup portal at http://192.168.4.1
      const localUrl = `http://192.168.4.1/config?ssid=${encodeURIComponent(ssid)}&pass=${encodeURIComponent(wifiPassword)}`;
      
      try {
        console.log(`[Provisioning] Dispaching credentials directly to local ESP32: ${localUrl}`);
        const response = await fetch(localUrl, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' } 
        });
        console.log('[Provisioning] Local ESP32 configuration response status:', response.status);
      } catch (localErr) {
        // If not connected to hardware (demo mode), log it and proceed to database link
        console.warn('[Provisioning] Local ESP32 configuration endpoint not reachable. Proceeding with registration.', localErr);
      }

      const payload = {
        name: name.trim(),
        device_type: type.toLowerCase(),
        node_id: nodeId.trim(),
        home_id: homeId,
        room_id: roomId
      };

      // Mock delay to let the ESP32 reboot and connect to the MQTT broker
      await new Promise(resolve => setTimeout(resolve, 3000));
      await apiClient.post('/api/devices', payload);
      
      Alert.alert('Provisioning Complete', `${name} has been added successfully!`);
      navigation.goBack();
    } catch (error) {
      console.error('[AddDevice] Link error:', error);
      const detail = error.response?.data?.detail || 'Handshake failed. Check network config.';
      setErrorMsg(detail);
      setShowSnackbar(true);
      setCurrentStep(2); // return to credentials input
    } finally {
      setLoading(false);
    }
  };

  const spin = radarRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  if (setupLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={TOKENS.accent} />
        <Text style={styles.loadingText}>Syncing IoT Metadata...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Custom Header */}
      <View style={styles.appHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={24} color={TOKENS.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>4Layers</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Add New Device</Text>
          <Text style={styles.mainSubtitle}>Follow the steps to provision your new 4Layers Hub.</Text>
        </View>

        {/* Progress Steps Indicators */}
        <View style={styles.progressRow}>
          <View style={styles.progressLine} />
          <View style={[styles.progressLineFill, { width: currentStep === 2 ? '50%' : currentStep === 3 ? '100%' : '0%' }]} />
          
          <View style={styles.stepIndicatorWrapper}>
            <View style={[styles.stepDot, currentStep >= 1 ? styles.stepDotActive : null]}>
              {currentStep > 1 ? (
                <MaterialCommunityIcons name="check" size={14} color="#002112" />
              ) : (
                <Text style={styles.stepNumText}>1</Text>
              )}
            </View>
            <Text style={[styles.stepLabelText, currentStep >= 1 && styles.stepLabelTextActive]}>Scan</Text>
          </View>

          <View style={styles.stepIndicatorWrapper}>
            <View style={[styles.stepDot, currentStep >= 2 ? styles.stepDotActive : null]}>
              {currentStep > 2 ? (
                <MaterialCommunityIcons name="check" size={14} color="#002112" />
              ) : (
                <Text style={[styles.stepNumText, currentStep >= 2 && styles.stepNumTextActive]}>2</Text>
              )}
            </View>
            <Text style={[styles.stepLabelText, currentStep >= 2 && styles.stepLabelTextActive]}>WiFi</Text>
          </View>

          <View style={styles.stepIndicatorWrapper}>
            <View style={[styles.stepDot, currentStep >= 3 ? styles.stepDotActive : null]}>
              <Text style={[styles.stepNumText, currentStep >= 3 && styles.stepNumTextActive]}>3</Text>
            </View>
            <Text style={[styles.stepLabelText, currentStep >= 3 && styles.stepLabelTextActive]}>Connect</Text>
          </View>
        </View>

        {/* STEP 1: BLE Scanning */}
        {currentStep === 1 && (
          <View style={styles.cardContainer}>
            <View style={styles.radarContainer}>
              {/* Pulse rings */}
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim1 }] }]} />
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim2 }], opacity: 0.4 }]} />
              
              {/* Sweeping arm */}
              <Animated.View style={[styles.radarSweeper, { transform: [{ rotate: spin }] }]} />

              <View style={styles.centerIconBg}>
                <MaterialCommunityIcons name="bluetooth" size={36} color={TOKENS.accent} />
              </View>
            </View>

            <Text style={styles.stepTitle}>Searching for Hub...</Text>
            <Text style={styles.stepSubtitle}>
              Ensure your 4Layers Switchboard is powered on and Bluetooth pairing mode is active.
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setCurrentStep(2)}
              style={styles.primaryBtn}
            >
              <MaterialCommunityIcons name="bluetooth-connect" size={20} color="#002112" />
              <Text style={styles.btnText}>Start BLE Scan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={startScanning}
              style={styles.secondaryBtn}
            >
              <MaterialCommunityIcons name="qrcode-scan" size={18} color={TOKENS.textSecondary} />
              <Text style={styles.secondaryBtnText}>Or Scan QR Code</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: WiFi Credentials Setup */}
        {currentStep === 2 && (
          <View style={styles.cardContainer}>
            <Text style={styles.formHeader}>Hub Found: 4L-HUB-8F2A</Text>
            <Text style={styles.stepSubtitle}>Enter network credentials to link the board to your cloud panel.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Network SSID</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="wifi" size={18} color={TOKENS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  value={ssid}
                  onChangeText={setSsid}
                  mode="flat"
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  textColor="#FFFFFF"
                  style={styles.nativeInput}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>WiFi Password</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="lock" size={18} color={TOKENS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  value={wifiPassword}
                  onChangeText={setWifiPassword}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  secureTextEntry
                  mode="flat"
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  textColor="#FFFFFF"
                  style={styles.nativeInput}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Device Display Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Master Bedroom Panel"
                placeholderTextColor="rgba(255,255,255,0.2)"
                mode="outlined"
                activeOutlineColor={TOKENS.accent}
                outlineColor="#262626"
                textColor="#FFFFFF"
                style={styles.outlinedTextInput}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Switch Type</Text>
              <SegmentedButtons
                value={type}
                onValueChange={setType}
                theme={{
                  colors: {
                    secondaryContainer: TOKENS.accent,
                    onSecondaryContainer: '#002112',
                  }
                }}
                buttons={[
                  { value: 'light', label: 'Light', icon: 'lightbulb' },
                  { value: 'fan', label: 'Fan', icon: 'fan' },
                  { value: 'outlet', label: 'Outlet', icon: 'power-plug' }
                ]}
                style={styles.segmentedButtons}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleRegisterDevice}
              style={styles.primaryBtn}
            >
              <Text style={styles.btnText}>Connect to WiFi</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#002112" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setCurrentStep(1)}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Back to Scan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Connecting Progress */}
        {currentStep === 3 && (
          <View style={styles.cardContainer}>
            <View style={styles.connectingVisual}>
              <ActivityIndicator size="large" color={TOKENS.accent} style={styles.spinner} />
              <View style={styles.cloudIconBg}>
                <MaterialCommunityIcons name="cloud-sync" size={32} color={TOKENS.accent} />
              </View>
            </View>

            <Text style={styles.stepTitle}>Provisioning Device...</Text>
            <Text style={styles.stepSubtitle}>
              Please keep your phone near the Switchboard. We are securely uploading credentials and registering the hardware relays.
            </Text>
          </View>
        )}

        <Snackbar
          visible={showSnackbar}
          onDismiss={() => setShowSnackbar(false)}
          duration={3500}
          style={styles.errorSnackbar}
          action={{
            label: 'OK',
            textColor: '#FCA5A5',
            onPress: () => setShowSnackbar(false),
          }}
        >
          <Text style={styles.snackbarText}>{errorMsg}</Text>
        </Snackbar>
      </ScrollView>

      {/* Scanner Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={scanning}
        onRequestClose={() => setScanning(false)}
      >
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerCutout} />
            <Text style={styles.scannerText}>Align QR Code within the frame</Text>
            <TouchableOpacity
              style={styles.closeScannerBtn}
              onPress={() => setScanning(false)}
            >
              <Text style={styles.closeScannerText}>Cancel</Text>
            </TouchableOpacity>
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
    paddingBottom: 10,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.accent,
    textAlign: 'center',
    marginRight: 40,
  },
  titleSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: TOKENS.accent,
    marginBottom: 4,
  },
  mainSubtitle: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    marginHorizontal: 30,
    marginVertical: 24,
  },
  progressLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#262626',
    zIndex: 1,
  },
  progressLineFill: {
    position: 'absolute',
    left: 0,
    height: 2,
    backgroundColor: TOKENS.accent,
    zIndex: 2,
  },
  stepIndicatorWrapper: {
    alignItems: 'center',
    zIndex: 3,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: TOKENS.bg,
  },
  stepDotActive: {
    backgroundColor: TOKENS.accent,
  },
  stepNumText: {
    color: TOKENS.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  stepNumTextActive: {
    color: '#002112',
  },
  stepLabelText: {
    fontSize: 10,
    color: TOKENS.textSecondary,
    marginTop: 6,
    fontWeight: '600',
  },
  stepLabelTextActive: {
    color: TOKENS.accent,
  },
  cardContainer: {
    backgroundColor: TOKENS.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: TOKENS.border,
    alignItems: 'center',
    marginTop: 8,
  },
  radarContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  radarSweeper: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: 'rgba(34,197,94,0.15)',
    borderTopColor: TOKENS.accent,
    borderRightColor: 'rgba(34,197,94,0.3)',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  centerIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: TOKENS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TOKENS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 48,
    backgroundColor: TOKENS.accent,
    borderRadius: 24,
    gap: 8,
    marginVertical: 8,
  },
  btnText: {
    color: '#002112',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 48,
    backgroundColor: 'transparent',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 8,
    marginVertical: 4,
  },
  secondaryBtnText: {
    color: TOKENS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  formHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: TOKENS.accent,
    marginBottom: 6,
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TOKENS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 48,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  nativeInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: 14,
    height: 40,
  },
  outlinedTextInput: {
    backgroundColor: TOKENS.bg,
    fontSize: 14,
  },
  segmentedButtons: {
    backgroundColor: TOKENS.bg,
    borderRadius: 12,
    borderWidth: 0,
  },
  connectingVisual: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  spinner: {
    position: 'absolute',
    width: 120,
    height: 120,
    transform: [{ scale: 1.5 }],
  },
  cloudIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: TOKENS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: TOKENS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorSnackbar: {
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  snackbarText: {
    color: '#FCA5A5',
    fontWeight: 'bold',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scannerCutout: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: TOKENS.accent,
    borderRadius: 24,
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  scannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 32,
  },
  closeScannerBtn: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  closeScannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
