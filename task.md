# SmartNest Branded App UI Refinements Tasklist

- [x] Backend: Revert auto-population of default rooms in `backend/routes/rooms.py`
- [x] Mobile: Re-enable "New Room" dynamic option and restore tabs in `RoomSelectionScreen.js` (only show tabs if `rooms.length > 0`)
- [x] Mobile: Remove the floating "+" action button from `DashboardScreen.js`
- [x] Mobile: Replace the "Event History" tab in `AppNavigator.js` with an "Add Device" tab
- [x] Mobile: Implement native Kotlin WifiScanner module for Android Wi-Fi scan results
- [x] Mobile: Register WifiScannerPackage in MainApplication.kt and hook to React Native
- [x] Mobile: Build horizontal ScrollView list of saved Wi-Fi networks in ProvisioningScreen
- [x] Mobile: Create in-app Modal overlay list to scan and select local Wi-Fi router networks
- [x] Backend: Publish MQTT remote factory reset command when a room is deleted to reset hardware devices automatically
- [x] Firmware: Update `SmartNest_Provisioning_Firmware.ino` to match Go Smart AIO V2 hardware pin mapping (GPIO 15, 5, 4, 22)
- [x] Firmware: Integrate relay-based step fan speed combinations (GPIO 21, 19, 18) in the Arduino provisioning firmware
- [x] Firmware: Add MQTT subscription check for `action: factory_reset` to clear configurations and reboot
- [x] Verification: Build the updated APK and name it `4layers.apk`
