import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCAL_IP_STORAGE_KEY = "@4layers_device_local_ips";
const REQUEST_TIMEOUT_MS = 1000; // 1.0 second ultra-fast timeout for Local-First fallback

// In-memory cache for instant zero-latency lookups
const localIpCache = {};

/**
 * Initialize local IP cache from persistent storage.
 */
export async function initLocalIpCache() {
  try {
    const data = await AsyncStorage.getItem(LOCAL_IP_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      Object.assign(localIpCache, parsed);
    }
  } catch (err) {
    console.warn("[LocalControl] Error loading local IP cache:", err);
  }
}

/**
 * Save or update local IP address for a device node.
 */
export async function saveDeviceLocalIp(nodeId, ip) {
  if (!nodeId || !ip) return;
  const baseNodeId = nodeId.includes("_") ? nodeId.split("_")[0] : nodeId;

  localIpCache[baseNodeId] = ip;
  localIpCache[nodeId] = ip;

  try {
    await AsyncStorage.setItem(LOCAL_IP_STORAGE_KEY, JSON.stringify(localIpCache));
  } catch (err) {
    console.warn("[LocalControl] Error persisting local IP cache:", err);
  }
}

/**
 * Retrieve cached local IP address for a node.
 */
export function getDeviceLocalIp(nodeId) {
  if (!nodeId) return null;
  const baseNodeId = nodeId.includes("_") ? nodeId.split("_")[0] : nodeId;
  return localIpCache[nodeId] || localIpCache[baseNodeId] || null;
}

/**
 * Helper to sanitize node_id for standard mDNS hostnames
 * e.g. "4L_ABC123" -> "4l-abc123"
 */
function sanitizeMdnsHost(nodeId) {
  if (!nodeId) return "esp32";
  const baseNodeId = nodeId.includes("_") ? nodeId.split("_")[0] : nodeId;
  return baseNodeId.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

/**
 * Internal fetch with timeout via AbortController
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Send local HTTP control command with Smart Fallback:
 * 1. Try http://<local_ip>/control?channel=... first
 * 2. If fails, try http://4layers-<node_id>.local/control?channel=...
 */
export async function sendLocalControlCommand(nodeId, channel, state, providedLocalIp = null, speed = null) {
  const baseNodeId = nodeId.includes("_") ? nodeId.split("_")[0] : nodeId;
  const targetIp = providedLocalIp || getDeviceLocalIp(nodeId);
  const stateParam = (typeof state === "boolean") ? (state ? "on" : "off") : String(state).toLowerCase();

  let query = `channel=${encodeURIComponent(channel)}&state=${encodeURIComponent(stateParam)}`;
  if (speed !== null && speed !== undefined) {
    query += `&speed=${encodeURIComponent(speed)}`;
  }

  const urlsToTry = [];

  // 1. Direct Local IP (Fastest path when connected to same Wi-Fi)
  if (targetIp && targetIp !== "127.0.0.1" && targetIp !== "0.0.0.0") {
    urlsToTry.push(`http://${targetIp}/control?${query}`);
  }

  // 2. mDNS hostnames (NODE_ID.local & 4layers-{node_id}.local)
  urlsToTry.push(`http://${baseNodeId}.local/control?${query}`);
  const sanitized = sanitizeMdnsHost(baseNodeId);
  urlsToTry.push(`http://4layers-${sanitized}.local/control?${query}`);
  if (sanitized !== baseNodeId.toLowerCase()) {
    urlsToTry.push(`http://4layers-${baseNodeId.toLowerCase()}.local/control?${query}`);
  }

  let lastError = null;

  for (const url of urlsToTry) {
    try {
      console.log(`[LocalControl] Attempting local LAN command via: ${url}`);
      const response = await fetchWithTimeout(url, { method: "GET" }, REQUEST_TIMEOUT_MS);

      if (response.ok) {
        let jsonRes = null;
        try {
          jsonRes = await response.json();
        } catch (_) {}

        console.log(`[LocalControl] Success via ${url}`);
        return {
          success: true,
          url,
          data: jsonRes
        };
      }
    } catch (err) {
      lastError = err;
      console.log(`[LocalControl] URL ${url} failed or timed out (${err.message}). Trying next fallback...`);
    }
  }

  throw lastError || new Error("All local LAN endpoints were unreachable.");
}

/**
 * Query local ESP32 /state endpoint to verify LAN presence
 */
export async function fetchLocalDeviceState(nodeId, providedLocalIp = null) {
  const baseNodeId = nodeId.includes("_") ? nodeId.split("_")[0] : nodeId;
  const targetIp = providedLocalIp || getDeviceLocalIp(nodeId);

  const urlsToTry = [];
  if (targetIp) {
    urlsToTry.push(`http://${targetIp}/state`);
  }
  const sanitized = sanitizeMdnsHost(baseNodeId);
  urlsToTry.push(`http://4layers-${sanitized}.local/state`);

  for (const url of urlsToTry) {
    try {
      const response = await fetchWithTimeout(url, { method: "GET" }, 1200);
      if (response.ok) {
        const jsonRes = await response.json();
        return jsonRes;
      }
    } catch (e) {}
  }

  return null;
}
