import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const USE_LOCAL_BACKEND = false; // Set to false for production cloud Render backend

let baseURL = USE_LOCAL_BACKEND
  ? (Platform.OS === 'web' ? 'http://localhost:8000' : 'http://10.0.2.2:8000')
  : 'https://edabtynvpy.ap-south-1.awsapprunner.com';

console.log(`[SmartNest API Client] Initialized. Base URL: ${baseURL}`);

const apiClient = axios.create({
  baseURL,
  timeout: 10000,
});

let onUnauthorized = () => {};

export const registerUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

// Add an interceptor to inject the JWT token from AsyncStorage into every outgoing request
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('user_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('[API Client] Error reading auth token:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auto-logout on 401 errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.log('[API Client] 401 Unauthorized detected. Clearing token and forcing logout.');
      try {
        await AsyncStorage.removeItem('user_token');
      } catch (e) {
        console.error('[API Client] Error removing token on 401:', e);
      }
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export const provisionDevice = async (macAddress, type, boardName = null, roomId = null, newRoomName = null, newRoomType = 'living_room') => {
  try {
    const payload = {
      mac_address: macAddress,
      type: type.toUpperCase()
    };
    if (boardName && boardName.trim()) {
      payload.name = boardName.trim();
    }
    if (roomId) {
      payload.room_id = roomId;
    }
    if (newRoomName && newRoomName.trim()) {
      payload.new_room_name = newRoomName.trim();
      payload.new_room_type = newRoomType;
    }
    
    const response = await apiClient.post('/api/devices/provision', payload);
    return response.data; // Returns {"id": device_id}
  } catch (error) {
    console.error('[API Client] provisionDevice error:', error);
    throw error;
  }
};

export default apiClient;
