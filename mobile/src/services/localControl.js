const localIpCache = {};

/**
 * Extract base node ID from device node ID (e.g. '4L_ABCD12_1' -> '4L_ABCD12').
 */
export function getBaseNodeId(nodeId) {
  if (!nodeId) return "";
  const lastIndex = nodeId.lastIndexOf("_");
  return lastIndex > 0 ? nodeId.substring(0, lastIndex) : nodeId;
}

export async function initLocalIpCache() {
  return Promise.resolve();
}

export async function saveDeviceLocalIp(nodeId, ip) {
  if (!nodeId || !ip) return;
  const baseNodeId = getBaseNodeId(nodeId);
  localIpCache[baseNodeId] = ip;
  localIpCache[nodeId] = ip;
  return Promise.resolve();
}

export function getDeviceLocalIp(nodeId) {
  if (!nodeId) return null;
  const baseNodeId = getBaseNodeId(nodeId);
  return localIpCache[nodeId] || localIpCache[baseNodeId] || null;
}

/**
 * Parse channel status and value/speed from a state payload.
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

export async function sendLocalControlCommand(nodeId, channel, state, providedLocalIp = null, speed = null) {
  throw new Error("Local control unreachable: Local HTTP control is disabled. Use Pure Cloud API / MQTT.");
}

export async function pingLocalDevice(nodeId, providedLocalIp = null, timeoutMs = 1000) {
  return null;
}

export async function fetchLocalDeviceState(nodeId, providedLocalIp = null, timeoutMs = 1000) {
  return null;
}

