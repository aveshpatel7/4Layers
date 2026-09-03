// GO SMART mobile transport
// -------------------------
// The phone NEVER receives MQTT broker credentials and NEVER opens a direct MQTT
// connection. All commands go to the GO SMART backend, which talks to the private
// GO SMART broker. The exported function names are intentionally kept compatible
// with older screens so the UI can migrate without breaking.

import {
  getGoSmartDevices,
  getGoSmartMqttStatus,
  sendGoSmartDeviceCommand,
} from '../api/client';

let isConnected = false;
let connectingPromise = null;
let listeners = new Set();
let pollTimer = null;
let devicesByNode = new Map();
let previousStateByNode = new Map();

const normalizeNodeId = (value) => String(value || '').trim().toUpperCase();

const refreshDeviceMap = async () => {
  const devices = await getGoSmartDevices();
  devicesByNode = new Map(
    devices
      .filter((d) => d?.node_id && d?.id)
      .map((d) => [normalizeNodeId(d.node_id), d])
  );
  return devices;
};

const emit = (topic, payload) => {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  listeners.forEach((cb) => {
    try {
      cb(topic, payloadString);
    } catch (e) {
      console.warn('[GO SMART Transport] listener error:', e?.message || e);
    }
  });
};

const snapshotKey = (device) => JSON.stringify({
  online: !!device?.presence?.online,
  switch1: !!device?.state?.switch1,
  switch2: !!device?.state?.switch2,
  switch3: !!device?.state?.switch3,
  switch4: !!device?.state?.switch4,
  fan_power: !!device?.state?.fan_power,
  fan_speed: Number(device?.state?.fan_speed || 0),
  state_version: Number(device?.state?.state_version || 0),
});

const emitDeviceSnapshot = (device) => {
  const nodeId = normalizeNodeId(device?.node_id);
  if (!nodeId) return;

  const current = snapshotKey(device);
  if (previousStateByNode.get(nodeId) === current) return;
  previousStateByNode.set(nodeId, current);

  const state = device?.state || {};
  const base = `gosmart/v1/device/${nodeId}`;
  emit(`${base}/presence`, {
    online: !!device?.presence?.online,
    mqtt_connected: !!device?.presence?.mqtt_connected,
    last_seen: device?.presence?.last_seen || null,
    rssi: device?.presence?.rssi ?? null,
  });
  emit(`${base}/state`, {
    switch1: !!state.switch1,
    switch2: !!state.switch2,
    switch3: !!state.switch3,
    switch4: !!state.switch4,
    fan_power: !!state.fan_power,
    fan_speed: Number(state.fan_speed || 0),
    state_version: Number(state.state_version || 0),
  });

  // Legacy synthetic status events keep old screen listeners working while the app
  // is migrated away from direct MQTT topics.
  [1, 2, 3, 4].forEach((channel) => {
    emit(`home/device/${nodeId}/status`, {
      channel,
      status: state[`switch${channel}`] ? 'ON' : 'OFF',
    });
  });
  emit(`home/device/${nodeId}/status`, {
    channel: 5,
    status: state.fan_power ? 'ON' : 'OFF',
    speed: Number(state.fan_speed || 0),
    value: Number(state.fan_speed || 0),
  });
};

const pollOnce = async () => {
  try {
    const devices = await refreshDeviceMap();
    devices.forEach(emitDeviceSnapshot);
    return devices;
  } catch (e) {
    console.warn('[GO SMART Transport] state refresh failed:', e?.message || e);
    return [];
  }
};

const startPolling = () => {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    pollOnce().catch(() => {});
  }, 2000);
};

const stopPolling = () => {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
};

// Kept for source compatibility. Broker credentials are intentionally ignored.
export const setMqttCredentials = () => {};

export const connectMqtt = () => {
  if (isConnected) return Promise.resolve({ transport: 'GO_SMART_BACKEND' });
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    const mqtt = await getGoSmartMqttStatus();
    if (!mqtt?.configured || !mqtt?.connected) {
      throw new Error('GO SMART MQTT backend bridge is not connected');
    }
    await pollOnce();
    isConnected = true;
    connectingPromise = null;
    startPolling();
    console.log('[GO SMART Transport] Backend + private MQTT connected.');
    return { transport: 'GO_SMART_BACKEND' };
  })().catch((error) => {
    isConnected = false;
    connectingPromise = null;
    throw error;
  });

  return connectingPromise;
};

export const forceReconnectMqtt = async () => {
  disconnectMqtt();
  return connectMqtt();
};

export const disconnectMqtt = () => {
  stopPolling();
  isConnected = false;
  connectingPromise = null;
  previousStateByNode.clear();
};

const nodeFromTopic = (topic) => {
  const parts = String(topic || '').split('/');
  if (parts[0] === 'home' && parts[1] === 'device' && parts[2]) return normalizeNodeId(parts[2]);
  if (parts[0] === 'gosmart' && parts[1] === 'v1' && parts[2] === 'device' && parts[3]) return normalizeNodeId(parts[3]);
  return '';
};

const commandFromPayload = (payload = {}) => {
  const action = String(payload.action || '').toLowerCase();
  if (action) {
    if (action === 'start_rf_pairing' || action === 'rf_pairing') return { action: 'rf_pairing_start' };
    if (action === 'cancel_rf_pairing' || action === 'stop_rf_pairing') return { action: 'rf_pairing_cancel' };
    if (action === 'factory_reset') return { action: 'factory_reset' };
    if (action === 'ota_update') {
      return {
        action: 'ota_update',
        firmware_url: payload.firmware_url,
        version: payload.version,
      };
    }
  }

  const channel = Number(payload.channel || 0);
  const rawState = payload.state ?? payload.status;
  const state = typeof rawState === 'string'
    ? ['ON', 'TRUE', '1'].includes(rawState.toUpperCase())
    : !!rawState;

  if (channel >= 1 && channel <= 4) {
    return { action: 'set_channel', channel, state };
  }
  if (channel === 5) {
    const speed = payload.speed ?? payload.value;
    return {
      action: 'set_fan',
      power: state,
      ...(speed !== undefined ? { speed: Math.max(0, Math.min(4, Number(speed) || 0)) } : {}),
    };
  }
  if (channel === 6 || channel === 7) {
    return { action: 'master', state };
  }
  return null;
};

export const publishMessage = (topic, payload) => {
  const nodeId = nodeFromTopic(topic);
  const command = commandFromPayload(payload);
  if (!nodeId || !command) {
    console.warn('[GO SMART Transport] Unsupported command/topic:', topic, payload);
    return false;
  }

  const queue = async () => {
    if (!devicesByNode.has(nodeId)) await refreshDeviceMap();
    const device = devicesByNode.get(nodeId);
    if (!device?.id) throw new Error(`GO SMART device ${nodeId} not found in backend`);
    await sendGoSmartDeviceCommand(device.id, command);
    setTimeout(() => pollOnce().catch(() => {}), 250);
  };

  queue().catch((e) => console.error('[GO SMART Transport] command failed:', e?.message || e));
  return true;
};

export const publishDeviceCommand = async (nodeId, command) => {
  const normalized = normalizeNodeId(nodeId);
  if (!devicesByNode.has(normalized)) await refreshDeviceMap();
  const device = devicesByNode.get(normalized);
  if (!device?.id) throw new Error(`GO SMART device ${normalized} not found`);
  const result = await sendGoSmartDeviceCommand(device.id, command);
  setTimeout(() => pollOnce().catch(() => {}), 250);
  return result;
};

export const registerMqttListener = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const isMqttConnected = () => isConnected;
