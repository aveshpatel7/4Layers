import React, { useEffect } from 'react';
import { StyleSheet, View, Image, StatusBar, Platform, PermissionsAndroid, BackHandler, Alert } from 'react-native';
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
  useEffect(() => {
    let isMounted = true;

    const requestAppPermissions = async () => {
      // Simulate splash branding delay for premium feel
      await new Promise(resolve => setTimeout(resolve, 1200));
      if (!isMounted) return;

      if (Platform.OS === 'web') {
        onPermissionsGranted();
        return;
      }

      try {
        let isGranted = false;

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

        if (isGranted) {
          onPermissionsGranted();
        } else {
          Alert.alert(
            'Permissions Required',
            'Location and Bluetooth permissions are required for smart device pairing and network discovery.',
            [
              {
                text: 'Retry',
                onPress: () => requestAppPermissions()
              },
              {
                text: 'Exit App',
                style: 'destructive',
                onPress: () => {
                  if (Platform.OS === 'android') {
                    BackHandler.exitApp();
                  }
                }
              }
            ],
            { cancelable: false }
          );
        }
      } catch (err) {
        console.warn('[PermissionSplash] Error checking permissions:', err);
        // Fallback safely so user isn't stuck
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
        <Text style={styles.loadingText}>Initializing system permissions...</Text>
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
