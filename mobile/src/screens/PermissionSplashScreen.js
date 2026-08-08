import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Image, StatusBar, Platform, PermissionsAndroid, BackHandler, NativeModules } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import logoImg from '../../assets/4layers_logo.png';
import CustomAppModal from '../components/CustomAppModal';

const TOKENS = {
  bg: '#0E0E0E',
  surface: '#1C1B1B',
  accent: '#1fa971',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  border: 'rgba(255, 255, 255, 0.08)'
};

export default function PermissionSplashScreen({ onPermissionsGranted }) {
  const [statusText, setStatusText] = useState('Initializing system permissions...');
  
  // Custom Modal State
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    iconName: 'shield-alert-outline',
    primaryText: 'Allow',
    secondaryText: 'Exit App',
    onPrimary: () => {},
    onSecondary: () => {}
  });

  useEffect(() => {
    let isMounted = true;

    const requestAppPermissions = async () => {
      // Simulate splash branding delay for premium feel
      await new Promise(resolve => setTimeout(resolve, 800));
      if (!isMounted) return;

      if (Platform.OS === 'web') {
        onPermissionsGranted();
        return;
      }

      try {
        let isGranted = false;

        // Step 1: Check Runtime OS Permissions (Location & Bluetooth)
        setStatusText('Checking location & bluetooth permissions...');
        if (Platform.OS === 'android') {
          if (Platform.Version >= 31) { // Android 12+
            const permissions = [
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
            ];
            
            const granted = await PermissionsAndroid.requestMultiple(permissions);
            
            const locOk = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
            const btScanOk = granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
            const btConnOk = granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;

            isGranted = locOk && btScanOk && btConnOk;
          } else { // Android 11 and lower
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              {
                title: 'Location & Bluetooth Permission',
                message: '4Layers SmartNest requires Location and Bluetooth permissions to discover and pair IoT hardware devices.',
                buttonPositive: 'Grant Permissions'
              }
            );
            isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
          }
        } else {
          isGranted = true;
        }

        if (!isGranted) {
          setModalConfig({
            visible: true,
            title: 'Permissions Required',
            message: 'Location and Bluetooth permissions are required for smart device pairing and network discovery.',
            iconName: 'shield-lock-outline',
            primaryText: 'Retry',
            secondaryText: 'Exit App',
            onPrimary: () => {
              setModalConfig(prev => ({ ...prev, visible: false }));
              requestAppPermissions();
            },
            onSecondary: () => Platform.OS === 'android' && BackHandler.exitApp()
          });
          return;
        }

        // Step 2: Check & In-App Enable Physical Bluetooth Hardware
        if (NativeModules.WifiScanner && NativeModules.WifiScanner.isBluetoothEnabled) {
          setStatusText('Checking Bluetooth adapter state...');
          const isBtOn = await NativeModules.WifiScanner.isBluetoothEnabled();
          if (!isBtOn) {
            setStatusText('Requesting Bluetooth enable...');
            await NativeModules.WifiScanner.enableBluetooth().catch(() => {});
            
            let retries = 10;
            let btEnabledAfterPrompt = false;
            while (retries > 0) {
              await new Promise(r => setTimeout(r, 500));
              const checkNow = await NativeModules.WifiScanner.isBluetoothEnabled();
              if (checkNow) {
                btEnabledAfterPrompt = true;
                break;
              }
              retries--;
            }

            if (!btEnabledAfterPrompt) {
              setModalConfig({
                visible: true,
                title: 'Bluetooth Required',
                message: 'Bluetooth is turned OFF. 4Layers needs Bluetooth turned ON to discover and control smart switchboards.',
                iconName: 'bluetooth-off',
                primaryText: 'Turn ON',
                secondaryText: 'Exit App',
                onPrimary: () => {
                  setModalConfig(prev => ({ ...prev, visible: false }));
                  requestAppPermissions();
                },
                onSecondary: () => Platform.OS === 'android' && BackHandler.exitApp()
              });
              return;
            }
          }
        }

        // Step 3: Check & In-App Enable Physical Location (GPS) Hardware
        if (NativeModules.WifiScanner && NativeModules.WifiScanner.isLocationEnabled) {
          setStatusText('Checking Location (GPS) state...');
          const isGpsOn = await NativeModules.WifiScanner.isLocationEnabled();
          if (!isGpsOn) {
            setStatusText('Requesting Location (GPS) enable...');
            // Trigger native SettingsClient Location dialog or custom app modal
            setModalConfig({
              visible: true,
              title: 'Location (GPS) Required',
              message: '4Layers needs Location turned ON to discover nearby Wi-Fi routers and Bluetooth switchboard hardware.',
              iconName: 'map-marker-off-outline',
              primaryText: 'Turn ON',
              secondaryText: 'Exit App',
              onPrimary: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                await NativeModules.WifiScanner.requestLocationEnable().catch(() => {});
                setTimeout(() => requestAppPermissions(), 1200);
              },
              onSecondary: () => Platform.OS === 'android' && BackHandler.exitApp()
            });
            return;
          }
        }

        // Step 4: Both permissions and physical hardware adapters are confirmed ON!
        setStatusText('Hardware ready! Launching console...');
        await new Promise(resolve => setTimeout(resolve, 300));
        onPermissionsGranted();
      } catch (err) {
        console.warn('[PermissionSplash] Error checking hardware state:', err);
        onPermissionsGranted();
      }
    };

    requestAppPermissions();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0E0E0E" translucent={false} />
      
      <View style={styles.logoCard}>
        <Image source={logoImg} style={styles.logo} resizeMode="contain" />
      </View>

      <Text style={styles.title}>4Layers</Text>
      <Text style={styles.subtitle}>IoT Control System</Text>

      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={TOKENS.accent} />
        <Text style={styles.loadingText}>{statusText}</Text>
      </View>

      <CustomAppModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        iconName={modalConfig.iconName}
        primaryText={modalConfig.primaryText}
        secondaryText={modalConfig.secondaryText}
        onPrimary={modalConfig.onPrimary}
        onSecondary={modalConfig.onSecondary}
        dangerSecondary
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Enterprise Hardware Control Console</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoCard: {
    width: 96,
    height: 96,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: TOKENS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: TOKENS.accent,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 10,
  },
  loadingText: {
    color: TOKENS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 32,
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  }
});
