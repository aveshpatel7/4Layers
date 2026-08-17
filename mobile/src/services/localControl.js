import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCAL_IP_STORAGE_KEY = "@4layers_device_local_ips";
const REQUEST_TIMEOUT_MS = 600; // 600ms ultra-fast timeout to prevent UI thread / fallback blocking

// In-memory cache for instant zero-latency lookups
const localIpCache = {};

/**
 * Initialize local IP cache from persistent storage.
 */
export async function initLocalIpCache() {
  try {
    if (AsyncStorage && typeof AsyncStorage.getItem === "function") {
      const data = await AsyncStorage.getItem(LOCAL_IP_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        Object.assign(localIpCache, parsed);
      }
    }
  } catch (err) {
    console.warn("[LocalControl] Error loading local IP cache:", err);
  }
}

/**
 * Extract base node ID from device node ID (e.g. '4L_ABCD12_1' -> '4L_ABCD12').
 */
export function getBaseNodeId(nodeId) {
  if (!nodeId) return "";
  const lastIndex = nodeId.lastIndexOf("_");
  return lastIndex > 0 ? nodeId.substring(0, lastIndex) : nodeId;
}

/**
 * Save or update local IP address for a device node.
 */
export async function saveDeviceLocalIp(nodeId, ip) {
  if (!nodeId || !ip) return;
  const baseNodeId = getBaseNodeId(nodeId);

  localIpCache[baseNodeId] = ip;
  localIpCache[nodeId] = ip;

  try {
    if (AsyncStorage && typeof AsyncStorage.setItem === "function") {
      await AsyncStorage.setItem(LOCAL_IP_STORAGE_KEY, JSON.stringify(localIpCache));
    }
  } catch (err) {
    console.warn("[LocalControl] Error persisting local IP cache:", err);
  }
}

/**
 * Retrieve cached local IP address for a node.
 */
export function getDeviceLocalIp(nodeId) {
  if (!nodeId) return null;
  const baseNodeId = getBaseNodeId(nodeId);
  return localIpCache[nodeId] || localIpCache[baseNodeId] || null;
}

/**
 * Helper to sanitize node_id for standard mDNS hostnames
 * e.g. "4L_ABC123" -> "4l-abc123"
 */
function sanitizeMdnsHost(nodeId) {
  if (!nodeId) return "esp32";
  const baseNodeId = getBaseNodeId(nodeId);
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
 * Parse channel status and value/speed from a local /state response.
 * Supports both modern firmware format (channel_1..5, speed)
 * and legacy format (relays array, fan object).
 *
 * @param {Object} localState - JSON response from /state
 * @param {number|string} channelSuffix - Channel number (1..7)
 * @returns {{ status: boolean|null, value: number|null }}
 */
export function parseLocalChannelState(localState, channelSuffix) {
  if (!localState || typeof localState !== "object") {
    return { status: null, value: null };
  }

  const rawSuffix = typeof channelSuffix === "string" 
    ? (channelSuffix.includes("_") ? channelSuffix.split("_").pop() : channelSuffix)
    : channelSuffix;
  const suffix = parseInt(rawSuffix, 10);
  if (isNaN(suffix)) {
    return { status: null, value: null };
  }

  let status = null;
  let value = null;

  // Modern firmware format: channel_1..5
  const channelKey = `channel_${suffix}`;
  if (localState[channelKey] !== undefined && localState[channelKey] !== null) {
    const rawVal = localState[channelKey];
    if (typeof rawVal === "boolean") {
      status = rawVal;
    } else if (typeof rawVal === "string") {
      const upper = rawVal.trim().toUpperCase();
      status = upper === "ON" || upper === "1" || upper === "TRUE";
    } else if (typeof rawVal === "number") {
      status = rawVal === 1;
    }
  } else if (Array.isArray(localState.relays) && suffix >= 1 && suffix <= 4) {
    // Legacy relays array format
    const rawVal = localState.relays[suffix - 1];
    if (rawVal !== undefined && rawVal !== null) {
      if (typeof rawVal === "boolean") {
        status = rawVal;
      } else if (typeof rawVal === "string") {
        const upper = rawVal.trim().toUpperCase();
        status = upper === "ON" || upper === "1" || upper === "TRUE";
      } else if (typeof rawVal === "number") {
        status = rawVal === 1;
      }
    }
  }

  // Fan channel (channel 5)
  if (suffix === 5) {
    if (localState.speed !== undefined && localState.speed !== null) {
      const parsedSpeed = parseInt(localState.speed, 10);
      if (!isNaN(parsedSpeed)) {
        value = parsedSpeed;
        if (status === null) {
          status = parsedSpeed > 0;
        }
      }
    } else if (localState.fan && typeof localState.fan === "object") {
      // Legacy fan object format
      if (localState.fan.enabled !== undefined) {
        status = !!localState.fan.enabled;
      }
      if (localState.fan.speed !== undefined && localState.fan.speed !== null) {
        const parsedSpeed = parseInt(localState.fan.speed, 10);
        if (!isNaN(parsedSpeed)) {
          value = parsedSpeed;
        }
      }
    }
  }

  // Channel 6 or 7 (Master / All channels)
  if (suffix === 6 || suffix === 7) {
    if (localState.all_state !== undefined && localState.all_state !== null) {
      const allStr = String(localState.all_state).trim().toUpperCase();
      status = allStr === "ON" || allStr === "ALL_ON" || allStr === "MIXED";
    }
  }

  return { status, value };
}

/**
 * Send local HTTP control command with Smart Fallback:
 * 1. Try http://<local_ip>/control?channel=... first
 * 2. If fails, try http://<node_id>.local/control?channel=...
 */
export async function sendLocalControlCommand(nodeId, channel, state, providedLocalIp = null, speed = null) {
  const baseNodeId = getBaseNodeId(nodeId);
  const targetIp = providedLocalIp || getDeviceLocalIp(nodeId);
  const stateParam = (typeof state === "boolean") ? (state ? "on" : "off") : String(state).toLowerCase();

  let query = `channel=${encodeURIComponent(channel)}&state=${encodeURIComponent(stateParam)}`;
  if (speed !== null && speed !== undefined) {
    query += `&speed=${encodeURIComponent(speed)}`;
  }

  console.log(`[LOCAL DEBUG] Attempting local command to: ${targetIp || baseNodeId + '.local'} (Node: ${baseNodeId}, Channel: ${channel} -> ${stateParam})`);

  // 1. Direct Local IP (Fastest path when on local Wi-Fi, 600ms max)
  if (targetIp && targetIp !== "127.0.0.1" && targetIp !== "0.0.0.0") {
    const url = `http://${targetIp}/control?${query}`;
    try {
      console.log(`[LOCAL DEBUG] Firing local HTTP GET: ${url}`);
      const response = await fetchWithTimeout(url, { method: "GET" }, REQUEST_TIMEOUT_MS);
      if (response.ok) {
        let jsonRes = null;
        try { jsonRes = await response.json(); } catch (_) {}
        console.log(`[LOCAL DEBUG] Local command SUCCESS via IP: ${url}`, jsonRes);
        return { success: true, url, data: jsonRes };
      } else {
        console.log(`[LOCAL DEBUG] Local command HTTP ${response.status} from ${url}`);
      }
    } catch (err) {
      console.log(`[LOCAL DEBUG] Local command FAIL via IP (${targetIp}): ${err.message}. Trying mDNS fallback...`);
    }
  }

  // 2. Single fallback attempt via baseNodeId.local
  const mdnsUrl = `http://${baseNodeId}.local/control?${query}`;
  try {
    console.log(`[LOCAL DEBUG] Firing mDNS GET: ${mdnsUrl}`);
    const response = await fetchWithTimeout(mdnsUrl, { method: "GET" }, REQUEST_TIMEOUT_MS);
    if (response.ok) {
      let jsonRes = null;
      try { jsonRes = await response.json(); } catch (_) {}
      console.log(`[LOCAL DEBUG] Local command SUCCESS via mDNS: ${mdnsUrl}`, jsonRes);
      return { success: true, url: mdnsUrl, data: jsonRes };
    } else {
      console.log(`[LOCAL DEBUG] Local command HTTP ${response.status} from mDNS: ${mdnsUrl}`);
    }
  } catch (err) {
    console.log(`[LOCAL DEBUG] Local command FAIL via mDNS (${mdnsUrl}): ${err.message}`);
    throw new Error(`Local control unreachable: ${err.message}`);
  }

  console.log(`[LOCAL DEBUG] Local command FAIL: All local endpoints unreachable.`);
  throw new Error("Local control unreachable.");
}

/**
 * Ultra-Fast 500ms Ping to verify local hardware presence
 */
export async function pingLocalDevice(nodeId, providedLocalIp = null, timeoutMs = 500) {
  const baseNodeId = getBaseNodeId(nodeId);
  const targetIp = providedLocalIp || getDeviceLocalIp(nodeId);

  if (!targetIp || targetIp === "127.0.0.1" || targetIp === "0.0.0.0") {
    console.log(`[LOCAL DEBUG] No valid local IP cached for ${baseNodeId}, skipping local IP ping.`);
    return null;
  }

  console.log(`[LOCAL DEBUG] Attempting local ping to: ${targetIp} (Node: ${baseNodeId}, timeout: ${timeoutMs}ms)`);

  try {
    const url = `http://${targetIp}/state`;
    const response = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);
    if (response.ok) {
      const jsonRes = await response.json();
      console.log(`[LOCAL DEBUG] Local ping SUCCESS via ${url}:`, jsonRes);
      return jsonRes;
    } else {
      console.log(`[LOCAL DEBUG] Local ping HTTP ${response.status} from ${url}`);
    }
  } catch (err) {
    console.log(`[LOCAL DEBUG] Local ping FAIL to ${targetIp}: ${err.message}`);
  }

  return null;
}

/**
 * Query local ESP32 /state endpoint (500ms fast ping with single fallback)
 */
export async function fetchLocalDeviceState(nodeId, providedLocalIp = null, timeoutMs = 500) {
  const baseNodeId = getBaseNodeId(nodeId);
  const targetIp = providedLocalIp || getDeviceLocalIp(nodeId);

  if (targetIp && targetIp !== "127.0.0.1" && targetIp !== "0.0.0.0") {
    try {
      const url = `http://${targetIp}/state`;
      console.log(`[LOCAL DEBUG] Fetching local device state from: ${url}`);
      const response = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);
      if (response.ok) {
        const jsonRes = await response.json();
        console.log(`[LOCAL DEBUG] Local device state SUCCESS via ${url}:`, jsonRes);
        return jsonRes;
      }
    } catch (err) {
      console.log(`[LOCAL DEBUG] Fetch local state FAIL (${targetIp}): ${err.message}`);
    }
  }

  const mdnsUrl = `http://${baseNodeId}.local/state`;
  try {
    console.log(`[LOCAL DEBUG] Fetching local device state from mDNS: ${mdnsUrl}`);
    const response = await fetchWithTimeout(mdnsUrl, { method: "GET" }, timeoutMs);
    if (response.ok) {
      const jsonRes = await response.json();
      console.log(`[LOCAL DEBUG] Local device state via mDNS SUCCESS:`, jsonRes);
      return jsonRes;
    }
  } catch (err) {
    console.log(`[LOCAL DEBUG] Fetch local state via mDNS FAIL (${mdnsUrl}): ${err.message}`);
  }

  return null;
}
