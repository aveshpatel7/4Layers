package com.smartnest.app

import android.content.Context
import android.net.wifi.WifiManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray

import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority
import com.google.android.gms.common.api.ResolvableApiException
import android.content.IntentSender

class WifiScannerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return "WifiScanner"
    }

    @ReactMethod
    fun getWifiNetworks(promise: Promise) {
        try {
            val context = reactApplicationContext.applicationContext
            val wifiManager = context.getSystemService(Context.WIFI_SERVICE) as WifiManager

            val handler = android.os.Handler(android.os.Looper.getMainLooper())
            var hasResolved = false

            val sendResults = {
                if (!hasResolved) {
                    hasResolved = true
                    try {
                        val scanResults = wifiManager.scanResults
                        val array: WritableArray = Arguments.createArray()
                        val ssids = mutableSetOf<String>()
                        for (result in scanResults) {
                            val ssid = result.SSID
                            if (ssid != null && ssid.isNotEmpty() && !ssids.contains(ssid)) {
                                ssids.add(ssid)
                                val map = Arguments.createMap()
                                map.putString("ssid", ssid)
                                map.putInt("level", result.level) // Signal strength in dBm
                                array.pushMap(map)
                            }
                        }
                        promise.resolve(array)
                    } catch (e: Exception) {
                        promise.reject("ERROR", e.message, e)
                    }
                }
            }

            var receiver: android.content.BroadcastReceiver? = null
            receiver = object : android.content.BroadcastReceiver() {
                override fun onReceive(c: Context?, intent: android.content.Intent?) {
                    try {
                        context.unregisterReceiver(this)
                    } catch (e: Exception) {}
                    sendResults()
                }
            }

            val filter = android.content.IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION)
            try {
                context.registerReceiver(receiver, filter)
            } catch (e: Exception) {}

            // Trigger scan
            try {
                wifiManager.startScan()
            } catch (e: Exception) {
                // Ignore throttle exception
            }

            // Fallback timeout after 1500ms in case scan is throttled or broadcast doesn't fire
            handler.postDelayed({
                try {
                    receiver?.let { context.unregisterReceiver(it) }
                } catch (e: Exception) {}
                sendResults()
            }, 1500)

        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isBluetoothEnabled(promise: Promise) {
        try {
            val bluetoothAdapter = android.bluetooth.BluetoothAdapter.getDefaultAdapter()
            if (bluetoothAdapter == null) {
                promise.resolve(false)
            } else {
                promise.resolve(bluetoothAdapter.isEnabled)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun enableBluetooth(promise: Promise) {
        try {
            val currentActivity = currentActivity
            if (currentActivity != null) {
                val intent = android.content.Intent(android.bluetooth.BluetoothAdapter.ACTION_REQUEST_ENABLE)
                currentActivity.startActivityForResult(intent, 1001)
                promise.resolve(true)
            } else {
                promise.reject("NO_ACTIVITY", "Current activity is null")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isLocationEnabled(promise: Promise) {
        try {
            val locationManager = reactApplicationContext.getSystemService(Context.LOCATION_SERVICE) as android.location.LocationManager
            val isGpsEnabled = locationManager.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)
            val isNetworkEnabled = locationManager.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER)
            promise.resolve(isGpsEnabled || isNetworkEnabled)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestLocationEnable(promise: Promise) {
        try {
            val currentActivity = currentActivity
            if (currentActivity != null) {
                val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000).build()
                val builder = LocationSettingsRequest.Builder()
                    .addLocationRequest(locationRequest)
                    .setAlwaysShow(true)

                val client = LocationServices.getSettingsClient(currentActivity)
                val task = client.checkLocationSettings(builder.build())

                task.addOnSuccessListener {
                    promise.resolve(true)
                }

                task.addOnFailureListener { exception: Exception ->
                    if (exception is ResolvableApiException) {
                        try {
                            exception.startResolutionForResult(currentActivity, 1002)
                            promise.resolve(true)
                        } catch (sendEx: IntentSender.SendIntentException) {
                            promise.reject("ERROR", sendEx.message, sendEx)
                        }
                    } else {
                        val intent = android.content.Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                        currentActivity.startActivity(intent)
                        promise.resolve(true)
                    }
                }
            } else {
                promise.reject("NO_ACTIVITY", "Current activity is null")
            }
        } catch (e: Exception) {
            try {
                val currentActivity = currentActivity
                if (currentActivity != null) {
                    val intent = android.content.Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                    currentActivity.startActivity(intent)
                    promise.resolve(true)
                } else {
                    promise.reject("ERROR", e.message, e)
                }
            } catch (fallbackEx: Exception) {
                promise.reject("ERROR", fallbackEx.message, fallbackEx)
            }
        }
    }
}
