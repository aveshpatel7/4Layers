import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// GO SMART production backend. UI stays classic; only the transport is adapted here.
export const GO_SMART_BACKEND_URL = 'https://gosmartbackend-production.up.railway.app';

const rawClient = axios.create({
  baseURL: GO_SMART_BACKEND_URL,
  timeout: 12000,
});

const apiClient = axios.create({
  baseURL: GO_SMART_BACKEND_URL,
  timeout: 12000,
});

let onUnauthorized = () => {};
let onBlocked = () => {};

export const registerUnauthorizedHandler = (handler) => {
  onUnauthorized = typeof handler === 'function' ? handler : () => {};
};

export const registerBlockedHandler = (handler) => {
  onBlocked = typeof handler === 'function' ? handler : () => {};
};

const attachToken = async (config) => {
  try {
    const token = await AsyncStorage.getItem('user_token');
    config.headers = config.headers || {};
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (e) {
    console.warn('[GO SMART API] Could not read auth token:', e?.message || e);
  }
  return config;
};

const handleAuthError = async (error) => {
  const status = error?.response?.status;
  if (status === 401 || status === 403) {
    try {
      await AsyncStorage.removeItem('user_token');
      await AsyncStorage.removeItem('userData_cache');
    } catch (_) {}
    if (status === 403) {
      const reason = error?.response?.data?.detail || 'Access denied';
      onBlocked(typeof reason === 'string' ? reason : 'Access denied');
    } else {
      onUnauthorized();
    }
  }
  return Promise.reject(error);
};

rawClient.interceptors.request.use(attachToken, (e) => Promise.reject(e));
rawClient.interceptors.response.use((r) => r, handleAuthError);

const boolFromLegacyStatus = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return ['ON', 'TRUE', '1'].includes(String(value || '').trim().toUpperCase());
};

const parseForm = (body) => {
  if (!body || typeof body !== 'string') return {};
  const out = {};
  body.split('&').forEach((part) => {
    const idx = part.indexOf('=');
    const key = idx >= 0 ? part.slice(0, idx) : part;
    const val = idx >= 0 ? part.slice(idx + 1) : '';
    try {
      out[decodeURIComponent(key.replace(/\+/g, ' '))] = decodeURIComponent(val.replace(/\+/g, ' '));
    } catch (_) {
      out[key] = val;
    }
  });
  return out;
};

const syntheticId = (physicalId, channel) => `${physicalId}__ch${channel}`;
const parseSyntheticId = (value) => {
  const m = String(value || '').match(/^([0-9a-f-]{36})__ch([1-6])$/i);
  return m ? { physicalId: m[1], channel: Number(m[2]) } : null;
};

const expandPhysicalDevicesForClassicUi = (physicalDevices) => {
  const result = [];
  (Array.isArray(physicalDevices) ? physicalDevices : []).forEach((d) => {
    if (!d?.id || !d?.node_id) return;
    const state = d.state || {};
    const online = !!d?.presence?.online;
    const baseName = d.name || 'GO SMART Switchboard';
    const common = {
      room_id: d.room_id || null,
      is_online: online,
      model: d.model || 'GO-SMART-4L-FAN',
      firmware_version: d.firmware_version || null,
    };

    [1, 2, 3, 4].forEach((channel) => {
      result.push({
        ...common,
        id: syntheticId(d.id, channel),
        physical_device_id: d.id,
        name: `${baseName} Switch ${channel}`,
        node_id: `${d.node_id}_${channel}`,
        device_type: 'light',
        current_state: { status: state[`switch${channel}`] ? 'ON' : 'OFF' },
      });
    });

    const fanSpeed = Number(state.fan_speed || 0);
    result.push({
      ...common,
      id: syntheticId(d.id, 5),
      physical_device_id: d.id,
      name: `${baseName} Fan`,
      node_id: `${d.node_id}_5`,
      device_type: 'fan',
      current_state: {
        status: state.fan_power ? 'ON' : 'OFF',
        value: fanSpeed,
        speed: fanSpeed,
      },
    });

    const anyOn = !!(state.switch1 || state.switch2 || state.switch3 || state.switch4 || state.fan_power);
    result.push({
      ...common,
      id: syntheticId(d.id, 6),
      physical_device_id: d.id,
      name: `${baseName} Master Switch`,
      node_id: `${d.node_id}_6`,
      device_type: 'master',
      current_state: { status: anyOn ? 'ON' : 'OFF' },
    });
  });
  return result;
};

apiClient.interceptors.request.use(async (config) => {
  config = await attachToken(config);
  const method = String(config.method || 'get').toLowerCase();
  const url = String(config.url || '');

  // Old login screen -> new GO SMART auth API, without changing the screen/layout.
  if (method === 'post' && url === '/api/users/login') {
    const legacy = typeof config.data === 'string' ? parseForm(config.data) : (config.data || {});
    config.url = '/api/auth/login';
    config.data = {
      email: String(legacy.username || legacy.email || '').trim().toLowerCase(),
      password: legacy.password || '',
    };
    config.headers['Content-Type'] = 'application/json';
    config.__goSmartLegacyLogin = true;
  }

  // Old registration screen -> new GO SMART auth API.
  if (method === 'post' && url === '/api/users/register') {
    const legacy = config.data || {};
    config.url = '/api/auth/register';
    config.data = {
      name: String(legacy.username || legacy.name || 'GO SMART User').trim(),
      email: String(legacy.email || '').trim().toLowerCase(),
      password: legacy.password || '',
    };
    config.__goSmartLegacyRegister = true;
  }

  if (method === 'get' && url === '/api/users/me') {
    config.url = '/api/auth/me';
    config.__goSmartLegacyMe = true;
  }

  // Old per-channel control URL uses a synthetic channel ID. Convert it back to
  // the physical GO SMART device UUID and the new command schema.
  const controlMatch = url.match(/^\/api\/devices\/([^/]+)\/control$/);
  if (method === 'post' && controlMatch) {
    const parsed = parseSyntheticId(controlMatch[1]);
    if (parsed) {
      const legacyState = config.data?.state || config.data || {};
      const requestedChannel = Number(legacyState.channel || parsed.channel);
      const on = boolFromLegacyStatus(legacyState.status ?? legacyState.state);
      let command;
      if (requestedChannel >= 1 && requestedChannel <= 4) {
        command = { action: 'set_channel', channel: requestedChannel, state: on };
      } else if (requestedChannel === 5) {
        const speedRaw = legacyState.speed ?? legacyState.value;
        command = { action: 'set_fan', power: on };
        if (speedRaw !== undefined && speedRaw !== null) {
          command.speed = Math.max(0, Math.min(4, Number(speedRaw) || 0));
        }
      } else {
        command = { action: 'master', state: on };
      }
      config.url = `/api/devices/${parsed.physicalId}/control`;
      config.data = command;
    }
  }

  if (method === 'post' && url === '/api/devices/bulk-control') {
    config.url = '/api/legacy/devices/bulk-control';
  }

  return config;
}, (e) => Promise.reject(e));

apiClient.interceptors.response.use((response) => {
  const originalUrl = String(response.config?.url || '');

  // New backend returns {devices:[physical boards]}; classic UI expects one row per channel.
  if (response.config?.method?.toLowerCase() === 'get' && originalUrl === '/api/devices') {
    const physical = response.data?.devices || [];
    response.data = expandPhysicalDevicesForClassicUi(physical);
  }

  if (response.config?.__goSmartLegacyMe) {
    const user = response.data?.user || response.data || {};
    response.data = {
      ...user,
      username: user.name || user.email || 'GO SMART User',
      phone_number: user.phone || 'REGISTERED',
      terms_accepted: true,
    };
  }

  return response;
}, handleAuthError);

// Raw helpers are used by the private-MQTT compatibility transport and must see
// the real physical device objects rather than classic UI virtual channels.
export const getGoSmartDevices = async () => {
  const response = await rawClient.get('/api/devices');
  return response.data?.devices || [];
};

export const getGoSmartMqttStatus = async () => {
  const response = await rawClient.get('/api/mqtt/status');
  return response.data?.mqtt || {};
};

export const sendGoSmartDeviceCommand = async (deviceId, command) => {
  const response = await rawClient.post(`/api/devices/${deviceId}/control`, command);
  return response.data;
};

export const provisionDevice = async (
  nodeId,
  type,
  boardName = null,
  roomId = null,
  _newRoomName = null,
  _newRoomType = 'living_room'
) => {
  const normalizedNode = String(nodeId || '').trim().toUpperCase();
  const payload = {
    node_id: normalizedNode,
    name: (boardName && boardName.trim()) || 'GO SMART Switchboard',
    model: 'GO-SMART-4L-FAN',
    firmware_version: 'V2.3',
    room_id: roomId || null,
  };

  try {
    const response = await rawClient.post('/api/devices', payload);
    return response.data;
  } catch (error) {
    if (error?.response?.status === 409) {
      const devices = await getGoSmartDevices();
      const found = devices.find((d) => String(d.node_id || '').toUpperCase() === normalizedNode);
      if (found) return { id: found.id, device: found, already_registered: true };
    }
    throw error;
  }
};

export default apiClient;
