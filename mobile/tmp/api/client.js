'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _this = this;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _reactNativeAsyncStorageAsyncStorage = require('@react-native-async-storage/async-storage');

var _reactNativeAsyncStorageAsyncStorage2 = _interopRequireDefault(_reactNativeAsyncStorageAsyncStorage);

var _reactNative = require('react-native');

var _expoConstants = require('expo-constants');

var _expoConstants2 = _interopRequireDefault(_expoConstants);

var USE_LOCAL_BACKEND = false; // Set to false for production cloud Render backend

var baseURL = USE_LOCAL_BACKEND ? _reactNative.Platform.OS === 'web' ? 'http://localhost:8000' : 'http://10.0.2.2:8000' : 'https://smartnest-3jr4.onrender.com';

console.log('[SmartNest API Client] Initialized. Base URL: ' + baseURL);

var apiClient = _axios2['default'].create({
  baseURL: baseURL,
  timeout: 10000
});

var onUnauthorized = function onUnauthorized() {};

var registerUnauthorizedHandler = function registerUnauthorizedHandler(handler) {
  onUnauthorized = handler;
};

exports.registerUnauthorizedHandler = registerUnauthorizedHandler;
// Add an interceptor to inject the JWT token from AsyncStorage into every outgoing request
apiClient.interceptors.request.use(function callee$0$0(config) {
  var token;
  return regeneratorRuntime.async(function callee$0$0$(context$1$0) {
    while (1) switch (context$1$0.prev = context$1$0.next) {
      case 0:
        context$1$0.prev = 0;
        context$1$0.next = 3;
        return regeneratorRuntime.awrap(_reactNativeAsyncStorageAsyncStorage2['default'].getItem('user_token'));

      case 3:
        token = context$1$0.sent;

        if (token) {
          config.headers.Authorization = 'Bearer ' + token;
        }
        context$1$0.next = 10;
        break;

      case 7:
        context$1$0.prev = 7;
        context$1$0.t0 = context$1$0['catch'](0);

        console.error('[API Client] Error reading auth token:', context$1$0.t0);

      case 10:
        return context$1$0.abrupt('return', config);

      case 11:
      case 'end':
        return context$1$0.stop();
    }
  }, null, _this, [[0, 7]]);
}, function (error) {
  return Promise.reject(error);
});

// Response interceptor to handle auto-logout on 401 errors
apiClient.interceptors.response.use(function (response) {
  return response;
}, function callee$0$0(error) {
  return regeneratorRuntime.async(function callee$0$0$(context$1$0) {
    while (1) switch (context$1$0.prev = context$1$0.next) {
      case 0:
        if (!(error.response && error.response.status === 401)) {
          context$1$0.next = 11;
          break;
        }

        console.log('[API Client] 401 Unauthorized detected. Clearing token and forcing logout.');
        context$1$0.prev = 2;
        context$1$0.next = 5;
        return regeneratorRuntime.awrap(_reactNativeAsyncStorageAsyncStorage2['default'].removeItem('user_token'));

      case 5:
        context$1$0.next = 10;
        break;

      case 7:
        context$1$0.prev = 7;
        context$1$0.t0 = context$1$0['catch'](2);

        console.error('[API Client] Error removing token on 401:', context$1$0.t0);

      case 10:
        onUnauthorized();

      case 11:
        return context$1$0.abrupt('return', Promise.reject(error));

      case 12:
      case 'end':
        return context$1$0.stop();
    }
  }, null, _this, [[2, 7]]);
});

var provisionDevice = function provisionDevice(macAddress, type) {
  var boardName = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];
  var roomId = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];
  var newRoomName = arguments.length <= 4 || arguments[4] === undefined ? null : arguments[4];
  var newRoomType = arguments.length <= 5 || arguments[5] === undefined ? 'living_room' : arguments[5];
  var payload, response;
  return regeneratorRuntime.async(function provisionDevice$(context$1$0) {
    while (1) switch (context$1$0.prev = context$1$0.next) {
      case 0:
        context$1$0.prev = 0;
        payload = {
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

        context$1$0.next = 7;
        return regeneratorRuntime.awrap(apiClient.post('/api/devices/provision', payload));

      case 7:
        response = context$1$0.sent;
        return context$1$0.abrupt('return', response.data);

      case 11:
        context$1$0.prev = 11;
        context$1$0.t0 = context$1$0['catch'](0);

        console.error('[API Client] provisionDevice error:', context$1$0.t0);
        throw context$1$0.t0;

      case 15:
      case 'end':
        return context$1$0.stop();
    }
  }, null, _this, [[0, 11]]);
};

exports.provisionDevice = provisionDevice;
exports['default'] = apiClient;
// Returns {"id": device_id}