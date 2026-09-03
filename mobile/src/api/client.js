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

// Customer onboarding never creates or exposes MQTT/device secrets on the phone.
// After BLE Wi-Fi provisioning, confirm that the automatic Node ID belongs to this account.
export const provisionDevice = async (nodeId) => {
  const normalizedNode = String(nodeId || '').trim().toUpperCase();
  const devices = await getGoSmartDevices();
  const found = devices.find((d) => String(d.node_id || '').trim().toUpperCase() === normalizedNode);
  if (!found) {
    const error = new Error('This GO SMART board is not registered to your account yet.');
    error.code = 'DEVICE_NOT_REGISTERED';
    throw error;
  }
  return { device: found, already_registered: true };
};

export default apiClient;