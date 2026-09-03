package com.smartnest.app

import android.bluetooth.BluetoothDevice
import android.bluetooth.le.ScanResult
import android.os.Handler
import android.os.Looper
import com.espressif.provisioning.DeviceConnectionEvent
import com.espressif.provisioning.ESPConstants
import com.espressif.provisioning.ESPDevice
import com.espressif.provisioning.ESPProvisionManager
import com.espressif.provisioning.listeners.BleScanListener
import com.espressif.provisioning.listeners.ProvisionListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.greenrobot.eventbus.EventBus
import org.greenrobot.eventbus.Subscribe
import org.greenrobot.eventbus.ThreadMode
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

class GoSmartProvisioningModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    private data class FoundDevice(
        val device: BluetoothDevice,
        val serviceUuid: String,
        val nodeId: String,
        val rssi: Int
    )

    private data class PendingProvision(
        val promise: Promise,
        val ssid: String,
        val password: String,
        val nodeId: String,
        val started: AtomicBoolean = AtomicBoolean(false),
        val finished: AtomicBoolean = AtomicBoolean(false)
    )

    private val handler = Handler(Looper.getMainLooper())
    private val foundDevices = ConcurrentHashMap<String, FoundDevice>()
    private val provisionManager: ESPProvisionManager by lazy {
        ESPProvisionManager.getInstance(reactContext)
    }
    private var espDevice: ESPDevice? = null
    private var pendingProvision: PendingProvision? = null

    override fun getName(): String = "GoSmartProvisioning"

    override fun initialize() {
        super.initialize()
        if (!EventBus.getDefault().isRegistered(this)) {
            EventBus.getDefault().register(this)
        }
    }

    override fun invalidate() {
        try { provisionManager.stopBleScan() } catch (_: Exception) {}
        if (EventBus.getDefault().isRegistered(this)) {
            EventBus.getDefault().unregister(this)
        }
        super.invalidate()
    }

    @ReactMethod
    fun scanGoSmartDevices(promise: Promise) {
        val finished = AtomicBoolean(false)
        foundDevices.clear()

        fun resolveNow() {
            if (!finished.compareAndSet(false, true)) return
            val array = Arguments.createArray()
            foundDevices.values.sortedByDescending { it.rssi }.forEach { item ->
                val map = Arguments.createMap()
                map.putString("id", item.device.address)
                // Customer UI must show only this name; raw suffix stays hidden.
                map.putString("displayName", "GO SMART Find")
                map.putString("nodeId", item.nodeId)
                map.putInt("rssi", item.rssi)
                array.pushMap(map)
            }
            promise.resolve(array)
        }

        try {
            provisionManager.searchBleEspDevices("GO SMART Find", object : BleScanListener {
                override fun scanStartFailed() {
                    if (finished.compareAndSet(false, true)) {
                        promise.reject("BLE_OFF", "Bluetooth is disabled or scanning could not start.")
                    }
                }

                override fun onPeripheralFound(device: BluetoothDevice, scanResult: ScanResult) {
                    try {
                        val rawName = scanResult.scanRecord?.deviceName ?: device.name ?: return
                        if (!rawName.startsWith("GO SMART Find", ignoreCase = true)) return
                        val serviceUuid = scanResult.scanRecord?.serviceUuids?.firstOrNull()?.uuid?.toString() ?: return
                        foundDevices[device.address] = FoundDevice(
                            device = device,
                            serviceUuid = serviceUuid,
                            nodeId = deriveNodeId(rawName, device.address),
                            rssi = scanResult.rssi
                        )
                    } catch (_: SecurityException) {
                    }
                }

                override fun scanCompleted() = resolveNow()

                override fun onFailure(e: Exception) {
                    if (finished.compareAndSet(false, true)) {
                        promise.reject("BLE_SCAN_FAILED", e.message ?: "GO SMART BLE scan failed", e)
                    }
                }
            })

            handler.postDelayed({
                try { provisionManager.stopBleScan() } catch (_: Exception) {}
                resolveNow()
            }, 8000)
        } catch (e: Exception) {
            if (finished.compareAndSet(false, true)) {
                promise.reject("BLE_SCAN_FAILED", e.message ?: "GO SMART BLE scan failed", e)
            }
        }
    }

    @ReactMethod
    fun provisionWifi(deviceId: String, nodeId: String, ssid: String, password: String, promise: Promise) {
        val found = foundDevices[deviceId]
        if (found == null) {
            promise.reject("DEVICE_NOT_FOUND", "Run GO SMART Find again and select the switchboard.")
            return
        }
        if (ssid.isBlank()) {
            promise.reject("SSID_REQUIRED", "Wi-Fi SSID is required.")
            return
        }
        if (pendingProvision != null) {
            promise.reject("PROVISION_BUSY", "Another GO SMART provisioning session is already running.")
            return
        }

        try { provisionManager.stopBleScan() } catch (_: Exception) {}

        try {
            val normalizedNode = nodeId.trim().uppercase(Locale.US)
            val esp = provisionManager.createESPDevice(
                ESPConstants.TransportType.TRANSPORT_BLE,
                ESPConstants.SecurityType.SECURITY_1
            )
            esp.setProofOfPossession(autoPop(normalizedNode))
            espDevice = esp
            pendingProvision = PendingProvision(
                promise = promise,
                ssid = ssid.trim(),
                password = password,
                nodeId = normalizedNode
            )
            esp.connectBLEDevice(found.device, found.serviceUuid)
        } catch (e: Exception) {
            pendingProvision = null
            espDevice = null
            promise.reject("BLE_CONNECT_FAILED", e.message ?: "Could not connect to GO SMART Find.", e)
        }
    }

    @Subscribe(threadMode = ThreadMode.MAIN)
    fun onDeviceConnectionEvent(event: DeviceConnectionEvent) {
        val pending = pendingProvision ?: return
        when (event.eventType) {
            ESPConstants.EVENT_DEVICE_CONNECTED -> {
                if (!pending.started.compareAndSet(false, true)) return
                val esp = espDevice
                if (esp == null) {
                    failPending("BLE_CONNECT_FAILED", "GO SMART BLE session was not created.", null)
                    return
                }
                esp.provision(pending.ssid, pending.password, object : ProvisionListener {
                    override fun createSessionFailed(e: Exception) = failPending("SESSION_FAILED", "Secure GO SMART BLE session failed.", e)
                    override fun wifiConfigSent() {}
                    override fun wifiConfigFailed(e: Exception) = failPending("WIFI_SEND_FAILED", "Could not send Wi-Fi credentials to the switchboard.", e)
                    override fun wifiConfigApplied() {}
                    override fun wifiConfigApplyFailed(e: Exception) = failPending("WIFI_APPLY_FAILED", "The switchboard rejected the Wi-Fi configuration.", e)
                    override fun provisioningFailedFromDevice(reason: ESPConstants.ProvisionFailureReason) = failPending("WIFI_FAILED", "Wi-Fi provisioning failed: ${reason.name}", null)
                    override fun deviceProvisioningSuccess() = completePendingSuccess()
                    override fun onProvisioningFailed(e: Exception) = failPending("PROVISION_FAILED", e.message ?: "GO SMART provisioning failed.", e)
                })
            }
            ESPConstants.EVENT_DEVICE_CONNECTION_FAILED -> failPending("BLE_CONNECT_FAILED", "Could not connect to GO SMART Find.", null)
            ESPConstants.EVENT_DEVICE_DISCONNECTED -> {
                // ESP32 can reboot/disconnect after applying Wi-Fi; ProvisionListener decides success.
            }
        }
    }

    private fun completePendingSuccess() {
        val pending = pendingProvision ?: return
        if (!pending.finished.compareAndSet(false, true)) return
        val result = Arguments.createMap()
        result.putBoolean("ok", true)
        result.putString("nodeId", pending.nodeId)
        pending.promise.resolve(result)
        pendingProvision = null
        espDevice = null
    }

    private fun failPending(code: String, message: String, error: Throwable?) {
        val pending = pendingProvision ?: return
        if (!pending.finished.compareAndSet(false, true)) return
        if (error != null) pending.promise.reject(code, message, error) else pending.promise.reject(code, message)
        pendingProvision = null
        espDevice = null
    }

    private fun deriveNodeId(rawName: String, bluetoothAddress: String): String {
        val suffix = Regex("(?i)GO\\s*SMART\\s*Find[-_ ]?([0-9A-F]{6})$")
            .find(rawName.trim())?.groupValues?.getOrNull(1)?.uppercase(Locale.US)
        if (!suffix.isNullOrBlank()) return "E-$suffix"

        val compact = bluetoothAddress.replace(":", "").replace("-", "")
        return "E-${compact.takeLast(6).uppercase(Locale.US).padStart(6, '0')}"
    }

    // Matches GO SMART ESP-IDF V2.2 automatic Security-1 PoP derivation.
    private fun autoPop(nodeId: String): String {
        val material = "GO_SMART_AUTO_POP_V1|$nodeId".toByteArray(Charsets.UTF_8)
        val digest = MessageDigest.getInstance("SHA-256").digest(material)
        return digest.take(8).joinToString("") { byte -> "%02x".format(byte.toInt() and 0xFF) }
    }
}
