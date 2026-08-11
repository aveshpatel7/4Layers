import { Platform, PermissionsAndroid, NativeModules, Alert } from 'react-native';

/**
 * On-Demand Permission and Hardware Adapter verification for Add Device / Provisioning.
 * Triggers Location & Bluetooth permissions and ensures physical Bluetooth & GPS adapters are ON.
 *
 * Denial Behavior:
 * - If user denies permissions or cancels hardware prompts, shows alert with exact English warning:
 *   "Bluetooth and Location are required to add a new device."
 * - Returns false without exiting the app, allowing the user to retry.
 */
export const requestAddDevicePermissions = async () => {
  if (Platform.OS === 'web') return true;

  try {
    let isGranted = false;

    // 1. Check & Request Runtime OS Permissions (Location & Bluetooth)
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
            message: 'Bluetooth and Location are required to add a new device.',
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
        'Permission Required',
        'Bluetooth and Location are required to add a new device.',
        [{ text: 'OK' }]
      );
      return false;
    }

    // 2. Check & Request Physical Bluetooth Hardware Adapter
    if (NativeModules.WifiScanner && NativeModules.WifiScanner.isBluetoothEnabled) {
      const isBtOn = await NativeModules.WifiScanner.isBluetoothEnabled();
      if (!isBtOn) {
        await NativeModules.WifiScanner.enableBluetooth().catch(() => {});
        let retries = 6;
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
            'Bluetooth Disabled',
            'Bluetooth and Location are required to add a new device.',
            [{ text: 'OK' }]
          );
          return false;
        }
      }
    }

    // 3. Check & Request Physical Location (GPS) Hardware Adapter
    if (NativeModules.WifiScanner && NativeModules.WifiScanner.isLocationEnabled) {
      const isGpsOn = await NativeModules.WifiScanner.isLocationEnabled();
      if (!isGpsOn) {
        await NativeModules.WifiScanner.requestLocationEnable().catch(() => {});
        let retries = 6;
        let gpsEnabledAfterPrompt = false;
        while (retries > 0) {
          await new Promise(r => setTimeout(r, 500));
          const checkNow = await NativeModules.WifiScanner.isLocationEnabled();
          if (checkNow) {
            gpsEnabledAfterPrompt = true;
            break;
          }
          retries--;
        }
        if (!gpsEnabledAfterPrompt) {
          Alert.alert(
            'Location (GPS) Disabled',
            'Bluetooth and Location are required to add a new device.',
            [{ text: 'OK' }]
          );
          return false;
        }
      }
    }

    return true;
  } catch (err) {
    console.warn('[OnDemandPermissions] Error verifying hardware/permissions:', err);
    return true;
  }
};
