// Polyfill global window and localStorage for paho-mqtt in React Native
if (typeof window === 'undefined') {
  global.window = global;
}
if (!global.window.localStorage) {
  global.window.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

import Paho from 'paho-mqtt';

let pahoClient = null;
let isConnected = false;
let connectingPromise = null;
let listeners = new Set();
let dynamicCredentials = null;

export const setMqttCredentials = (credentials) => {
  dynamicCredentials = credentials;
};

export const connectMqtt = (credentials = null) => {
  if (credentials) {
    dynamicCredentials = credentials;
  }

  if (isConnected) return Promise.resolve(pahoClient);
  if (connectingPromise) return connectingPromise;

  const config = dynamicCredentials || {
    broker_host: 'i26a1c71.ala.asia-southeast1.emqxsl.com',
    broker_port: 8084,
    username: 'smartnest_client',
    password: 'D2m9ga8JynJDEM6' // Default fallback for dev/local environment
  };

  let port = Number(config.broker_port);
  if (port === 8883 || port === 1883) {
    port = 8084; // Enforce WebSocket WSS port for browser client
  }

  const clientId = `4Layers-App-${Math.random().toString(16).substr(2, 8)}`;
  pahoClient = new Paho.Client(config.broker_host, port, '/mqtt', clientId);

  pahoClient.onConnectionLost = (responseObject) => {
    isConnected = false;
    connectingPromise = null;
    console.log('[MQTT Client] Connection lost:', responseObject?.errorMessage || 'Unknown');
    // Auto-reconnect in 5 seconds
    setTimeout(() => {
      connectMqtt().catch(err => console.log('[MQTT Client] Reconnect failed:', err));
    }, 5000);
  };

  pahoClient.onMessageArrived = (message) => {
    console.log('[MQTT Client] Message arrived:', message.destinationName, message.payloadString);
    listeners.forEach(cb => {
      try {
        cb(message.destinationName, message.payloadString);
      } catch (e) {
        console.error('[MQTT Client] Callback error:', e);
      }
    });
  };

  connectingPromise = new Promise((resolve, reject) => {
    pahoClient.connect({
      useSSL: true,
      userName: config.username,
      password: config.password,
      keepAliveInterval: 20,
      timeout: 8,
      onSuccess: () => {
        isConnected = true;
        connectingPromise = null;
        console.log('[MQTT Client] Connected successfully over secure WebSockets!');
        try {
          pahoClient.subscribe('home/device/#');
          console.log('[MQTT Client] Subscribed to wildcard topic: home/device/#');
        } catch (subErr) {
          console.warn('[MQTT Client] Auto-subscribe wildcard topic error:', subErr);
        }
        resolve(pahoClient);
      },
      onFailure: (err) => {
        connectingPromise = null;
        isConnected = false;
        console.error('[MQTT Client] Connection failed:', err);
        reject(err);
      }
    });
  });

  return connectingPromise;
};

export const forceReconnectMqtt = async () => {
  try {
    if (pahoClient) {
      try {
        pahoClient.disconnect();
      } catch (_) {}
    }
  } finally {
    isConnected = false;
    connectingPromise = null;
  }
  return connectMqtt();
};

export const disconnectMqtt = () => {
  if (pahoClient && isConnected) {
    try {
      pahoClient.disconnect();
      console.log('[MQTT Client] Disconnected.');
    } catch (e) {
      console.warn('[MQTT Client] Disconnect error:', e);
    }
    isConnected = false;
    connectingPromise = null;
  }
};

export const publishMessage = (topic, payload) => {
  if (!pahoClient || !isConnected) {
    console.warn('[MQTT Client] Cannot publish. Not connected.');
    return false;
  }
  try {
    const message = new Paho.Message(JSON.stringify(payload));
    message.destinationName = topic;
    message.qos = 1;
    pahoClient.send(message);
    console.log('[MQTT Client] Published to', topic, payload);
    return true;
  } catch (e) {
    console.error('[MQTT Client] Publish failed:', e);
    return false;
  }
};

export const registerMqttListener = (callback) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

export const isMqttConnected = () => isConnected;
