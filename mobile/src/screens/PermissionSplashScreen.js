import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Image, StatusBar, Platform, PermissionsAndroid, BackHandler, Alert, NativeModules } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import logoImg from '../../assets/4layers_logo.png';

const TOKENS = {
  bg: '#0b0f19',
  surface: '#121827',
  accent: '#00E676',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  border: 'rgba(255, 255, 255, 0.08)'
};

export default function PermissionSplashScreen({ onPermissionsGranted }) {
  const [statusText, setStatusText] = useState('Initializing system permissions...');

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
          Alert.alert(
            'Permissions Required',
            'Location and Bluetooth permissions are required for smart device pairing and network discovery.',
            [
              { text: 'Retry', onPress: () => requestAppPermissions() },
              { text: 'Exit App', style: 'destructive', onPress: () => Platform.OS === 'android' && BackHandler.exitApp() }
            ],
            { cancelable: false }
          );
          return;
        }

        // Step 2: Check & In-App Enable Physical Bluetooth Hardware
        if (NativeModules.WifiScanner && NativeModules.WifiScanner.isBluetoothEnabled) {
          setStatusText('Checking Bluetooth adapter state...');
          const isBtOn = await NativeModules.WifiScanner.isBluetoothEnabled();
          if (!isBtOn) {
            setStatusText('Requesting Bluetooth enable...');
            // Trigger native in-app ACTION_REQUEST_ENABLE popup
            await NativeModules.WifiScanner.enableBluetooth().catch(() => {});
            
            // Wait up to 5s for user to tap "Allow" on native popup
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
              Alert.alert(
                'Bluetooth Required',
                'Bluetooth is turned OFF. 4Layers needs Bluetooth turned ON to discover and control smart switchboards.',
                [
                  { text: 'Turn ON', onPress: () => requestAppPermissions() },
                  { text: 'Exit App', style: 'destructive', onPress: () => Platform.OS === 'android' && BackHandler.exitApp() }
                ],
                { cancelable: false }
              );
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
            // Prompt native Location settings sheet overlay
            Alert.alert(
              'Location Services (GPS) Required',
              '4Layers needs Location turned ON to discover nearby Wi-Fi routers and Bluetooth switchboard hardware.',
              [
                { 
                  text: 'Turn ON', 
                  onPress: async () => {
                    await NativeModules.WifiScanner.requestLocationEnable().catch(() => {});
                    // Wait brief moment and re-check permissions flow
                    setTimeout(() => requestAppPermissions(), 1500);
                  } 
                },
                { text: 'Exit App', style: 'destructive', onPress: () => Platform.OS === 'android' && BackHandler.exitApp() }
              ],
              { cancelable: false }
            );
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
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" translucent={false} />
      
      <View style={styles.logoCard}>
        <Image source={logoImg} style={styles.logo} resizeMode="contain" />
      </View>

      <Text style={styles.title}>4Layers</Text>
      <Text style={styles.subtitle}>IoT Control System</Text>

      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={TOKENS.accent} />
        <Text style={styles.loadingText}>{statusText}</Text>
      </View>

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
    backgroundColor: TOKENS.surface,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: TOKENS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 72,
    height: 72,
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
