import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// GO SMART production backend. The mobile app talks ONLY to this API.
// MQTT credentials stay server-side; the app never connects to the broker directly.
export const GO_SMART_BACKEND_URL = 'https://gosmartbackend-production.up.railway.app';

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

apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('user_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      console.warn('[GO SMART API] Could not read auth token:', e?.message || e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
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
  }
);

export const getGoSmartDevices = async () => {
  const response = await apiClient.get('/api/devices');
  return response.data?.devices || [];
};

export const getGoSmartMqttStatus = async () => {
  const response = await apiClient.get('/api/mqtt/status');
  return response.data?.mqtt || {};
};

export const sendGoSmartDeviceCommand = async (deviceId, command) => {
  const response = await apiClient.post(`/api/devices/${deviceId}/control`, command);
  return response.data;
};

// Compatibility helper used by older provisioning screens. New BLE onboarding should
// claim/provision a factory-created board instead of creating broker credentials in-app.
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
    firmware_version: 'V2.0',
    room_id: roomId || null,
  };

  try {
    const response = await apiClient.post('/api/devices', payload);
    return response.data;
  } catch (error) {
    // A factory-registered board may already exist. Return it instead of trying to
    // create a second identity/device key from the phone.
    if (error?.response?.status === 409) {
      const devices = await getGoSmartDevices();
      const found = devices.find((d) => String(d.node_id || '').toUpperCase() === normalizedNode);
      if (found) return { device: found, already_registered: true };
    }
    throw error;
  }
};

export default apiClient;
