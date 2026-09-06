import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GO_SMART_BACKEND_URL = 'https://gosmartbackend-production.up.railway.app';

const apiClient = axios.create({ baseURL: GO_SMART_BACKEND_URL, timeout: 15000 });
let onUnauthorized = () => {};
let onBlocked = () => {};

export const registerUnauthorizedHandler = (handler) => { onUnauthorized = typeof handler === 'function' ? handler : () => {}; };
export const registerBlockedHandler = (handler) => { onBlocked = typeof handler === 'function' ? handler : () => {}; };

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('user_token').catch(() => null);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      await AsyncStorage.removeItem('user_token').catch(() => {});
      if (status === 403) onBlocked(error?.response?.data?.detail || 'Access denied');
      else onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export const checkCloudReadiness = async () => {
  const response = await axios.get(`${GO_SMART_BACKEND_URL}/health`, { timeout: 6000 });
  const db = response.data?.database || {};
  return {
    apiOnline: response.status >= 200 && response.status < 500,
    databaseOnline: db.connected === true,
    databaseConfigured: db.configured === true,
    databaseMessage: db.message || null,
    raw: response.data,
  };
};

export const getGoSmartDevices = async () => {
  const response = await apiClient.get('/api/devices');
  return Array.isArray(response.data?.devices) ? response.data.devices : [];
};

export const getGoSmartMqttStatus = async () => {
  const response = await apiClient.get('/api/mqtt/status');
  return response.data?.mqtt || {};
};

export const sendGoSmartDeviceCommand = async (deviceId, command) => {
  const response = await apiClient.post(`/api/devices/${deviceId}/control`, command);
  return response.data;
};

// Production onboarding: cloud securely creates/rotates the per-board credential,
// then the app transfers it to the ESP32 only over the encrypted BLE session.
export const provisionDevice = async (nodeId, boardName = null, roomId = null) => {
  const normalizedNode = String(nodeId || '').trim().toUpperCase();
  if (!normalizedNode) throw new Error('GO SMART Node ID is missing.');

  const readiness = await checkCloudReadiness();
  if (!readiness.apiOnline) throw new Error('GO SMART Cloud is unreachable.');
  if (!readiness.databaseConfigured || !readiness.databaseOnline) {
    const error = new Error('GO SMART Cloud database is unavailable.');
    error.code = 'DATABASE_UNAVAILABLE';
    throw error;
  }

  const payload = {
    node_id: normalizedNode,
    name: boardName?.trim() || 'GO SMART Switchboard',
    model: 'GO-SMART-SW4-FAN4',
    firmware_version: 'gs-idf-3.1.0-phone-wifi-state-sync',
    room_id: roomId || null,
  };
  const response = await apiClient.post('/api/v3/devices/enroll', payload);
  if (!response.data?.device?.id || !response.data?.device_key) {
    throw new Error('GO SMART Cloud did not return a complete device credential.');
  }
  return response.data;
};

export default apiClient;