import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  PanResponder,
  TextInput,
  ActivityIndicator,
  Alert
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import apiClient from "../api/client";
import DeviceCard, { LuminaRockerSwitch } from "../components/DeviceCard";
import HardwareReconnectingCard from "../components/HardwareReconnectingCard";
import EnergyChart from "../components/EnergyChart";
import BrandLogo from "../components/BrandLogo";
import SideDrawer from "../components/SideDrawer";
import { connectMqtt, disconnectMqtt, registerMqttListener } from "../services/mqttClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBaseNodeId } from "../services/localControl";
const TOKENS = {
  bg: "#0E0E0E",
  cardBg: "#1C1B1B",
  accent: "#1fa971",
  border: "rgba(255, 255, 255, 0.05)",
  textPrimary: "#E5E2E1",
  textSecondary: "#9CA3AF",
  error: "#EF4444"
};
function CapsuleSwitch({ isEnabled, onToggle }) {
  return (
    <View style={styles.capsuleContainer}>
      <TouchableOpacity
        style={[styles.capsuleButton, isEnabled && styles.capsuleBtnOnActive]}
        onPress={() => !isEnabled && onToggle()}
        activeOpacity={0.8}
      >
        <Text style={[styles.capsuleText, isEnabled ? styles.capsuleTextOnActive : styles.capsuleTextInactive]}>On</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.capsuleButton, !isEnabled && styles.capsuleBtnOffActive]}
        onPress={() => isEnabled && onToggle()}
        activeOpacity={0.8}
      >
        <Text style={[styles.capsuleText, !isEnabled ? styles.capsuleTextOffActive : styles.capsuleTextInactive]}>Off</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const [selectedRoom, setSelectedRoom] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);
  const [isArmed, setIsArmed] = useState(true);
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [roomMapping, setRoomMapping] = useState({});
  const [dbRooms, setDbRooms] = useState([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [username, setUsername] = useState("User");

  // Visual Connectivity Feedback Toast State (Subtle Cloud / Offline Notifications)
  const [feedbackToast, setFeedbackToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const [isRefreshingOffline, setIsRefreshingOffline] = useState(false);

  const handleManualStatusCheck = async () => {
    try {
      setIsRefreshingOffline(true);
      await Promise.all([
        fetchDevices(false),
        initMqttConnection(),
      ]);
      showFeedbackToast("Checked live switchboard status", "cloud");
    } catch (_) {
    } finally {
      setIsRefreshingOffline(false);
    }
  };

  const showFeedbackToast = (text, type = "cloud") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setFeedbackToast({ text, type });
    toastTimeoutRef.current = setTimeout(() => {
      setFeedbackToast(null);
    }, 2500);
  };

  // Voice Control Modal State
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceResponse, setVoiceResponse] = useState(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  const handleSendVoiceCommand = async (cmdText) => {
    const textToSend = cmdText || voiceText;
    if (!textToSend || !textToSend.trim()) return;

    try {
      setIsProcessingVoice(true);
      setVoiceResponse(null);
      const res = await apiClient.post('/api/voice/command', { command: textToSend.trim() });
      setVoiceResponse(res.data);
      fetchDevices(false);
    } catch (err) {
      console.warn("Voice command failed:", err);
      setVoiceResponse({ success: false, message: err.response?.data?.detail || "Failed to process voice command" });
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Swipe Right Gesture Responder to open SideDrawer (Hyper-responsive)
  const swipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        return evt.nativeEvent.pageX < 70;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 15 || gestureState.vx > 0.12) {
          setIsDrawerOpen(true);
        }
      }
    })
  ).current;

  const fetchRoomsMapping = async () => {
    try {
      // 2.5s fast timeout to prevent long stalls on offline Wi-Fi (no WAN internet)
      const roomsRes = await apiClient.get('/api/rooms', { timeout: 2500 });
      if (roomsRes.data && roomsRes.data.length > 0) {
        const mapping = {};
        roomsRes.data.forEach(r => {
          mapping[r.id] = r.name;
        });
        setRoomMapping(mapping);
        setDbRooms(roomsRes.data);
        try {
          await AsyncStorage.setItem('@4layers_cached_rooms', JSON.stringify(roomsRes.data));
        } catch (_) {}
        
        // Auto-select first room if none is selected, or if selected room was deleted
        const roomIds = roomsRes.data.map(r => r.id);
        const lastSelected = await AsyncStorage.getItem('@4layers_last_selected_room');
        setSelectedRoom(prev => {
          if (prev && roomIds.includes(prev)) return prev;
          if (lastSelected && roomIds.includes(lastSelected)) return lastSelected;
          return roomsRes.data[0].id;
        });
      } else {
        setDbRooms([]);
        setSelectedRoom("");
      }
    } catch (e) {
      console.warn("Failed to fetch room mapping (offline, using cache):", e?.message || e);
      try {
        const cached = await AsyncStorage.getItem('@4layers_cached_rooms');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const mapping = {};
            parsed.forEach(r => { mapping[r.id] = r.name; });
            setRoomMapping(mapping);
            setDbRooms(parsed);
            const roomIds = parsed.map(r => r.id);
            const lastSelected = await AsyncStorage.getItem('@4layers_last_selected_room');
            setSelectedRoom(prev => {
              if (prev && roomIds.includes(prev)) return prev;
              if (lastSelected && roomIds.includes(lastSelected)) return lastSelected;
              return parsed[0].id;
            });
          }
        }
      } catch (_) {}
    }
  };

  const fetchUnreadAlertsCount = async () => {
    try {
      const res = await apiClient.get('/api/alerts?unread_only=true', { timeout: 2500 });
      setUnreadAlertsCount(res.data.length);
    } catch (e) {
      // Offline silent
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get('/api/users/me', { timeout: 2500 });
      if (res.data && res.data.username) {
        setUsername(res.data.username);
      }
    } catch (e) {
      // Offline silent
    }
  };

  // Track recently toggled devices with a lock timestamp to prevent stale state updates / polling flicker
  const toggleLockRef = useRef({});

  // Helper to recalculate Master Switch state dynamically for all rooms
  const recalculateMasterStatus = (devList) => {
    const now = Date.now();
    const roomStatusMap = {};
    devList.forEach(d => {
      if (d.type !== 'master' && !d.node_id?.endsWith('_6') && !d.node_id?.endsWith('_7')) {
        const lock = toggleLockRef.current[d.id] || toggleLockRef.current[String(d.id)] || (d.node_id && toggleLockRef.current[d.node_id]);
        const effectiveStatus = (lock && (now - lock.time < 3500)) ? lock.status : d.status;
        if (effectiveStatus && d.is_online !== false) {
          roomStatusMap[d.room_id] = true;
        }
      }
    });

    return devList.map(d => {
      if (d.type === 'master' || d.node_id?.endsWith('_6') || d.node_id?.endsWith('_7')) {
        const masterLock = toggleLockRef.current[d.id] || toggleLockRef.current[String(d.id)] || (d.node_id && toggleLockRef.current[d.node_id]);
        if (masterLock && (now - masterLock.time < 3500)) {
          return { ...d, status: masterLock.status };
        }
        return { ...d, status: !!roomStatusMap[d.room_id] };
      }
      return d;
    });
  };

  const fetchDevices = async (showLoading = false) => {
    if (showLoading && devices.length === 0) {
      setIsLoading(true);
    }

    try {
      const response = await apiClient.get("/api/devices", { timeout: 4000 });
      const data = response.data;
      if (Array.isArray(data)) {
        // Board-level sibling online propagation
        const onlineBaseNodes = new Set();
        data.forEach(d => {
          if (d.is_online === true) {
            const base = getBaseNodeId(d.node_id);
            if (base) onlineBaseNodes.add(base);
          }
        });

        let formattedList = data.map(d => {
          let mobileType = 'outlet';
          const nodeSuffix = d.node_id?.split('_').pop();
          if (nodeSuffix === '5' || d.device_type === 'fan') mobileType = 'fan';
          else if (nodeSuffix === '6' || nodeSuffix === '7' || d.device_type === 'master') mobileType = 'master';
          else if (d.device_type === 'light') mobileType = 'light';
          else if (d.device_type === 'ac') mobileType = 'thermostat';
          else if (d.device_type === 'tv' || d.device_type === 'plug') mobileType = 'outlet';

          let val = d.current_state?.value !== undefined 
            ? d.current_state.value 
            : (d.current_state?.speed !== undefined ? d.current_state.speed : (mobileType === 'fan' ? 4 : 1));
          
          if (mobileType === 'fan' && (val === 0 || val === null || val === undefined) && (d.current_state?.status === 'ON')) {
            val = 4;
          }

          const base = getBaseNodeId(d.node_id);
          const isOnline = d.is_online === true || (base && onlineBaseNodes.has(base));

          return {
            id: d.id,
            name: d.name,
            room_id: d.room_id,
            node_id: d.node_id,
            type: mobileType,
            is_online: isOnline,
            status: isOnline && (d.current_state?.status === 'ON'),
            value: val
          };
        });

        // Compute Master Switch status dynamically for each room
        formattedList = recalculateMasterStatus(formattedList);
        
        // Deduplicate array by device id
        const uniqueDevicesList = Array.from(new Map(formattedList.map(d => [d.id, d])).values());

        // Sort devices by node_id
        uniqueDevicesList.sort((a, b) => {
          if (!a.node_id || !b.node_id) return 0;
          return a.node_id.localeCompare(b.node_id, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        try {
          await AsyncStorage.setItem('@4layers_cached_devices', JSON.stringify(uniqueDevicesList));
        } catch (_) {}

        const now = Date.now();
        setDevices((prev) => {
          return uniqueDevicesList.map(newDev => {
            const lock = toggleLockRef.current[newDev.id] || toggleLockRef.current[String(newDev.id)] || (newDev.node_id && toggleLockRef.current[newDev.node_id]);
            if (lock && (now - lock.time < 3500) && newDev.is_online) {
              return {
                ...newDev,
                is_online: true,
                status: lock.status,
                value: lock.value !== undefined ? lock.value : newDev.value
              };
            }
            return newDev;
          });
        });
        setHasError(false);
      } else {
        throw new Error("Returned data is not a valid list of devices");
      }
    } catch (error) {
      console.warn("[Dashboard] Cloud API fetch error:", error?.message || error);
      try {
        const cachedDevStr = await AsyncStorage.getItem('@4layers_cached_devices');
        if (cachedDevStr) {
          const cachedDevs = JSON.parse(cachedDevStr);
          if (Array.isArray(cachedDevs) && cachedDevs.length > 0) {
            setDevices(cachedDevs);
          }
        }
      } catch (_) {}
      setHasError(false);
    } finally {
      setIsLoading(false);
    }
  };

  const initMqttConnection = async () => {
    try {
      const response = await apiClient.get('/api/users/mqtt-config');
      if (response.data) {
        console.log('[Dashboard] Fetched dynamic MQTT credentials from server.');
        await connectMqtt(response.data);
      } else {
        await connectMqtt();
      }
    } catch (e) {
      console.warn('[Dashboard] Failed to fetch dynamic MQTT credentials, using fallbacks:', e);
      await connectMqtt();
    }
  };

  useEffect(() => {
    fetchRoomsMapping();
    fetchUnreadAlertsCount();
    fetchProfile();
    
    initMqttConnection();

    const unregister = registerMqttListener((topic, payloadStr) => {
      try {
        const payload = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
        const parts = topic.split('/');
        if (parts.length >= 3) {
          const baseNodeId = parts[2];
          const channel = payload.channel;
          const isOfflinePayload = payload.status === 'OFFLINE' || payload.is_online === false;

          if (isOfflinePayload) {
            setDevices((prev) => {
              const updated = prev.map((d) => {
                if (d.node_id === baseNodeId || d.node_id?.startsWith(`${baseNodeId}_`)) {
                  return { ...d, is_online: false, status: false };
                }
                return d;
              });
              return recalculateMasterStatus(updated);
            });
            return;
          }

          // If message is a pure HEARTBEAT or connectivity ping, only mark is_online: true
          const isHeartbeatPayload = payload.status === 'HEARTBEAT' || payload.heartbeat === true || payload.type === 'heartbeat';
          if (isHeartbeatPayload) {
            setDevices((prev) => {
              const updated = prev.map((d) => {
                if (getBaseNodeId(d.node_id) === baseNodeId) {
                  return { ...d, is_online: true };
                }
                return d;
              });
              return recalculateMasterStatus(updated);
            });
            return;
          }

          // Online / telemetry / status message handling
          const nextStatus = payload.status === 'ON' || payload.status === true || payload.status === 1;
          const nextValue = payload.value ?? payload.speed ?? (channel === 5 ? (nextStatus ? 4 : 0) : 1);

          const now = Date.now();
          setDevices((prev) => {
            const updated = prev.map((d) => {
              const dBase = getBaseNodeId(d.node_id);
              const isSibling = dBase === baseNodeId;

              let isMatch = false;
              if (channel) {
                const expectedSuffix = `_${channel}`;
                isMatch = d.node_id === `${baseNodeId}${expectedSuffix}` || 
                          (d.node_id?.startsWith(baseNodeId) && d.node_id?.endsWith(expectedSuffix)) ||
                          (channel === 1 && d.node_id === baseNodeId);
              } else {
                isMatch = isSibling;
              }

              if (isMatch) {
                const lock = toggleLockRef.current[d.id] || toggleLockRef.current[String(d.id)] || (d.node_id && toggleLockRef.current[d.node_id]);
                // Enforce optimistic state lock within 3.5 seconds
                if (lock && (now - lock.time < 3500)) {
                  return {
                    ...d,
                    is_online: true,
                    status: lock.status,
                    value: lock.value !== undefined ? lock.value : d.value
                  };
                }

                const isFanDevice = d.type === 'fan' || d.node_id?.endsWith('_5');
                const resolvedVal = isFanDevice
                  ? (payload.speed ?? payload.value ?? (nextStatus ? (d.value > 0 ? d.value : 4) : 0))
                  : nextValue;

                return { ...d, is_online: true, status: nextStatus, value: resolvedVal };
              }

              // Sibling channels on the same board are proven online
              if (isSibling && !d.is_online) {
                return { ...d, is_online: true };
              }

              return d;
            });

            return recalculateMasterStatus(updated);
          });
        }
      } catch (e) {
        console.warn('[Dashboard] Live MQTT event parse error:', e);
      }
    });
    
    return () => {
      unregister();
    };
  }, []);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // 1. Immediately hydrate from cache to eliminate white screen/loading lag on offline Wi-Fi
    const hydrateAllCaches = async () => {
      try {
        const [cachedRoomsStr, cachedLastRoom, cachedDevsStr] = await Promise.all([
          AsyncStorage.getItem('@4layers_cached_rooms'),
          AsyncStorage.getItem('@4layers_last_selected_room'),
          AsyncStorage.getItem('@4layers_cached_devices')
        ]);

        let loadedRooms = [];
        let chosenRoomId = cachedLastRoom || "";

        if (cachedRoomsStr) {
          try {
            const parsedRooms = JSON.parse(cachedRoomsStr);
            if (Array.isArray(parsedRooms) && parsedRooms.length > 0) {
              loadedRooms = parsedRooms;
              const mapping = {};
              parsedRooms.forEach(r => { mapping[r.id] = r.name; });
              setRoomMapping(mapping);
              setDbRooms(parsedRooms);
              const roomIds = parsedRooms.map(r => r.id);
              if (!chosenRoomId || !roomIds.includes(chosenRoomId)) {
                chosenRoomId = parsedRooms[0].id;
              }
              setSelectedRoom(chosenRoomId);
            }
          } catch (_) {}
        }

        if (cachedDevsStr) {
          try {
            const parsedDevs = JSON.parse(cachedDevsStr);
            if (Array.isArray(parsedDevs) && parsedDevs.length > 0) {
              setDevices(parsedDevs);
              setIsLoading(false);

              // If rooms were not yet cached, construct fallback room from devices
              if (loadedRooms.length === 0) {
                const uniqueRoomIds = Array.from(new Set(parsedDevs.map(d => d.room_id).filter(Boolean)));
                if (uniqueRoomIds.length > 0) {
                  const fallbackRooms = uniqueRoomIds.map((rid, idx) => ({
                    id: rid,
                    name: idx === 0 ? 'Home' : `Room ${idx + 1}`
                  }));
                  const mapping = {};
                  fallbackRooms.forEach(r => { mapping[r.id] = r.name; });
                  setRoomMapping(mapping);
                  setDbRooms(fallbackRooms);
                  setSelectedRoom(fallbackRooms[0].id);
                }
              }
            }
          } catch (_) {}
        }
      } catch (err) {
        console.warn("[Dashboard] Initial cache load error:", err);
      }
    };

    hydrateAllCaches();

    const showLoading = !hasLoadedRef.current;
    fetchDevices(showLoading);
    hasLoadedRef.current = true;
    const intervalId = setInterval(() => {
      fetchDevices(false);
      fetchUnreadAlertsCount();
    }, 3000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation?.addListener ? navigation.addListener('focus', () => {
      initMqttConnection();
      fetchRoomsMapping();
      fetchDevices(false);
      fetchUnreadAlertsCount();
      fetchProfile();
    }) : () => {};

    return unsubscribe;
  }, [navigation]);

  const handleToggleDevice = async (id) => {
    const target = devices.find((d) => d.id === id);
    if (!target) return;

    // IF DEVICE IS OFFLINE, DO NOT TOGGLE OR SEND NETWORK CALLS
    if (target.is_online === false) {
      showFeedbackToast("Device Unreachable. Check hardware power.", "offline");
      return;
    }

    const isMaster = target.type === 'master' || target.node_id?.endsWith('_6') || target.node_id?.endsWith('_7') || target.name?.toLowerCase().includes('master');
    const nextStatus = !target.status;
    const nextStatusStr = nextStatus ? 'ON' : 'OFF';

    let baseNodeId = getBaseNodeId(target.node_id);
    let channel = 1;
    if (target.node_id && target.node_id.includes('_')) {
      const lastPart = target.node_id.split('_').pop();
      if (lastPart.match(/^\d+$/)) {
        channel = parseInt(lastPart, 10);
      }
    }

    if (isMaster) {
      // MASTER SWITCH TOGGLE: Controls ALL devices in this room via Cloud!
      const roomDevs = filteredDevices;
      const roomDevIds = roomDevs.map(d => d.id);

      // 1. Optimistic State Lock on ALL room devices
      const lockNow = Date.now();
      roomDevs.forEach(dev => {
        const lockObj = { time: lockNow, status: nextStatus, value: 1 };
        toggleLockRef.current[dev.id] = lockObj;
        toggleLockRef.current[String(dev.id)] = lockObj;
        if (dev.node_id) toggleLockRef.current[dev.node_id] = lockObj;
      });
      const masterLockObj = { time: lockNow, status: nextStatus, value: 1 };
      toggleLockRef.current[id] = masterLockObj;
      toggleLockRef.current[String(id)] = masterLockObj;
      if (target.node_id) toggleLockRef.current[target.node_id] = masterLockObj;

      // 2. Instant Optimistic UI update: Turn ALL room devices ON or OFF
      setDevices((prev) => {
        const updated = prev.map((d) => {
          if (roomDevIds.includes(d.id) || d.id === id) {
            return { ...d, status: nextStatus };
          }
          return d;
        });
        return recalculateMasterStatus(updated);
      });

      // 3. Direct AWS Cloud Route
      try {
        console.log("[DEBUG MASTER] Toggling MASTER:", target.name, "| ID:", id, "| node_id:", target.node_id, "| nextStatus:", nextStatusStr, "| room device IDs:", JSON.stringify(roomDevIds));
        await apiClient.post('/api/devices/bulk-control', {
          device_ids: roomDevIds,
          state: { status: nextStatusStr }
        });
        console.log("[DEBUG MASTER] SUCCESS: Master bulk-control completed");
      } catch (cloudErr) {
        console.log("[DEBUG MASTER] FAILED:", cloudErr?.response?.status, cloudErr?.response?.data);
        console.warn("[Dashboard] Cloud master control failed:", cloudErr);
      }
      return;
    }

    let speedVal = null;
    if (channel === 5 || target.type === 'fan') {
      if (nextStatus) { // Turning ON
        // If it was previously set to a valid > 0 speed, keep it, otherwise default to 3 or 4
        speedVal = (typeof target.value === 'number' && !isNaN(target.value) && target.value > 0) ? target.value : 3;
      } else { // Turning OFF
        speedVal = 0;
      }
    }

    // 1. Optimistic State Lock
    const lockNow = Date.now();
    const lockObj = { time: lockNow, status: nextStatus, value: speedVal !== null ? speedVal : target.value };
    toggleLockRef.current[id] = lockObj;
    toggleLockRef.current[String(id)] = lockObj;
    if (target.node_id) toggleLockRef.current[target.node_id] = lockObj;

    // 2. Instant Optimistic UI update for individual device + Master Switch
    setDevices((prev) => {
      const updated = prev.map((d) => d.id === id ? { ...d, status: nextStatus, ...(speedVal !== null && { value: speedVal }) } : d);
      return recalculateMasterStatus(updated);
    });

    // 3. Direct AWS Cloud Route
    const togglePayload = {
      channel,
      status: nextStatusStr
    };
    if (speedVal !== null) {
      togglePayload.speed = speedVal;
    }

    console.log("[DEBUG TOGGLE] Switch:", target.name, "| ID:", id, "| node_id:", target.node_id, "| channel:", channel, "| payload:", JSON.stringify(togglePayload));

    try {
      const resp = await apiClient.post(`/api/devices/${id}/control`, {
        state: togglePayload
      });
      console.log("[DEBUG TOGGLE] SUCCESS:", target.name, "| HTTP status:", resp.status, "| response:", JSON.stringify(resp.data));
    } catch (cloudErr) {
      console.log("[DEBUG TOGGLE] FAILED:", target.name, "| HTTP status:", cloudErr?.response?.status, "| error:", JSON.stringify(cloudErr?.response?.data));
      console.warn(`[Dashboard] Cloud API call failed for ${target.name}:`, cloudErr);
    }
  };

  const handleAdjustValue = async (id, step) => {
    const target = devices.find((d) => d.id === id);
    if (!target) return;

    // IF DEVICE IS OFFLINE, DO NOT ADJUST
    if (target.is_online === false) {
      showFeedbackToast("Device Unreachable. Check hardware power.", "offline");
      return;
    }

    const isFan = target.type === 'fan' || target.node_id?.endsWith('_5') || target.name?.toLowerCase().includes('fan');
    if (!isFan) return;

    const defaultVal = 1;
    const currentVal = (typeof target.value === 'number' && !isNaN(target.value)) ? target.value : defaultVal;

    const minVal = 0;
    const maxVal = 4;

    const nextVal = Math.max(minVal, Math.min(maxVal, currentVal + step));
    if (nextVal === currentVal) return;

    const nextStatus = nextVal > 0;
    const nextStatusStr = nextStatus ? 'ON' : 'OFF';

    let channel = 5;
    if (target.node_id && target.node_id.includes('_')) {
      const lastPart = target.node_id.split('_').pop();
      if (lastPart.match(/^\d+$/)) {
        channel = parseInt(lastPart, 10);
      }
    }

    // 1. Optimistic State Lock for Fan
    const lockNow = Date.now();
    const lockObj = { time: lockNow, status: nextStatus, value: nextVal };
    toggleLockRef.current[id] = lockObj;
    toggleLockRef.current[String(id)] = lockObj;
    if (target.node_id) toggleLockRef.current[target.node_id] = lockObj;

    // 2. Instant Optimistic UI update + Master Switch state update
    setDevices((prev) => {
      const updated = prev.map((d) => d.id === id ? { ...d, value: nextVal, status: nextStatus } : d);
      return recalculateMasterStatus(updated);
    });

    // 3. Direct AWS Cloud Route
    const adjustPayload = {
      channel,
      status: nextStatusStr,
      speed: nextVal
    };

    try {
      await apiClient.post(`/api/devices/${id}/control`, {
        state: adjustPayload
      });
    } catch (cloudErr) {
      console.warn(`[Dashboard] Cloud API fan speed failed:`, cloudErr);
    }
  };

  const handleBulkControl = async (turnOn) => {
    const targetState = turnOn ? 'ON' : 'OFF';
    const roomDevs = filteredDevices;
    const roomDevIds = roomDevs.map(d => d.id);

    // 1. Optimistic State Lock on ALL room devices
    const lockNow = Date.now();
    roomDevs.forEach(dev => {
      const lockObj = { time: lockNow, status: turnOn, value: 1 };
      toggleLockRef.current[dev.id] = lockObj;
      toggleLockRef.current[String(dev.id)] = lockObj;
      if (dev.node_id) toggleLockRef.current[dev.node_id] = lockObj;
    });

    // 2. Instant Optimistic UI update for all devices
    setDevices((prev) => {
      const updated = prev.map((d) => {
        if (roomDevIds.includes(d.id)) {
          return { ...d, status: turnOn };
        }
        return d;
      });
      return recalculateMasterStatus(updated);
    });

    // 3. Direct AWS Cloud Route
    try {
      await apiClient.post('/api/devices/bulk-control', {
        device_ids: roomDevIds,
        state: { status: targetState }
      });
    } catch (err) {
      console.warn("Failed bulk control operation:", err);
      fetchDevices(true);
    }
  };

  const filteredDevices = useMemo(() => {
    if (!devices || devices.length === 0) return [];
    if (selectedRoom) {
      const matched = devices.filter((device) => device.room_id === selectedRoom);
      if (matched.length > 0) return matched;
    }
    // Fallback: If selectedRoom is empty or has no matches, match first room in dbRooms
    if (dbRooms.length > 0) {
      const firstRoomId = dbRooms[0].id;
      const matchedFirst = devices.filter((device) => device.room_id === firstRoomId);
      if (matchedFirst.length > 0) return matchedFirst;
    }
    // Fallback: show all devices
    return devices;
  }, [devices, selectedRoom, dbRooms]);

  const isSecurityArmed = !!isArmed;
  const ROOM_TABS = dbRooms.map((r) => ({ id: r.id, label: r.name }));

  const currentRoomName = dbRooms.find(r => r.id === selectedRoom)?.name 
    || (dbRooms.length > 0 ? dbRooms[0].name : (devices.length > 0 ? 'Home' : 'No Rooms Found'));

  return <SafeAreaView style={styles.safeContainer} {...swipePanResponder.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor={TOKENS.bg} />
      
      {/* Side Navigation Drawer */}
      <SideDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        navigation={navigation}
        activeRouteName="Home"
        userProfile={{ name: username }}
      />

      {/* Compact Room Selector Modal */}
      <Modal
        visible={isRoomPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRoomPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.roomModalOverlay}
          activeOpacity={1}
          onPress={() => setIsRoomPickerOpen(false)}
        >
          <View style={styles.roomModalContainer}>
            <Text style={styles.roomModalTitle}>Select Room View</Text>
            {dbRooms.map((room) => {
              const isSelected = selectedRoom === room.id;
              return (
                <TouchableOpacity
                  key={room.id}
                  style={[styles.roomModalItem, isSelected && styles.roomModalItemActive]}
                  onPress={() => {
                    setSelectedRoom(room.id);
                    AsyncStorage.setItem('@4layers_last_selected_room', String(room.id)).catch(() => {});
                    setIsRoomPickerOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <MaterialCommunityIcons
                      name="door-open"
                      size={18}
                      color={isSelected ? TOKENS.accent : TOKENS.textSecondary}
                    />
                    <Text style={[styles.roomModalText, isSelected && styles.roomModalTextActive]}>
                      {room.name}
                    </Text>
                  </View>
                  {isSelected && (
                    <MaterialCommunityIcons name="check" size={18} color={TOKENS.accent} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Header Bar */}
      <View style={styles.customHeader}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity
            style={styles.drawerMenuBtn}
            onPress={() => setIsDrawerOpen(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="menu" size={24} color={TOKENS.textPrimary} />
          </TouchableOpacity>
          <BrandLogo size="small" color={TOKENS.accent} bg={TOKENS.bg} />
        </View>

        <View style={styles.headerRightGroup}>
          {/* Ultra-Compact Room Dropdown Pill */}
          <TouchableOpacity
            style={styles.compactRoomDropdownBtn}
            onPress={() => setIsRoomPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.compactRoomDropdownText} numberOfLines={1}>
              {currentRoomName}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={14} color={TOKENS.accent} />
          </TouchableOpacity>

          {/* Ultra-Clean Status Dot:
              🔵 Blue Dot = Connected via AWS Cloud (Online)
              🔴 Red Dot = Hardware switchboard unreachable (Offline)
          */}
          {(filteredDevices.length > 0 && filteredDevices.some(d => d.is_online === true)) ? (
            <TouchableOpacity
              style={styles.statusDotButton}
              onPress={() => showFeedbackToast("Cloud Connected: Online via AWS Cloud.", "cloud")}
              activeOpacity={0.7}
            >
              <View style={[styles.statusDot, styles.statusDotCloud]} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.statusDotButton}
              onPress={() => showFeedbackToast("Switchboard Offline. Check hardware power.", "offline")}
              activeOpacity={0.7}
            >
              <View style={[styles.statusDot, styles.statusDotOffline]} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>


        
        {isLoading && devices.length === 0 ? (
          <View style={styles.statusBox}>
            <View style={styles.activeDot} />
            <Text style={styles.statusText}>Connecting to hardware relays...</Text>
          </View>
        ) : filteredDevices.length === 0 ? (
            <View style={styles.emptyWelcomeContainer}>
              <MaterialCommunityIcons name="router-wireless" size={44} color={TOKENS.accent} />
              <Text style={styles.emptyWelcomeTitle}>Welcome to 4Layers</Text>
              <Text style={styles.emptyWelcomeSubtitle}>
                No smart switchboard devices linked to your account yet. Add your first hardware to start controlling your home.
              </Text>
              <TouchableOpacity 
                style={styles.addFirstDeviceBtn}
                onPress={() => navigation.navigate('RoomSelection')}
              >
                <MaterialCommunityIcons name="plus" size={18} color="#002112" />
                <Text style={styles.addFirstDeviceBtnText}>Add Your First Device</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {/* Interactive Hardware Reconnecting & Boot Status HUD */}
              {filteredDevices.length > 0 && filteredDevices.every(d => d.is_online === false) && (
                <HardwareReconnectingCard
                  onRefresh={handleManualStatusCheck}
                  isRefreshing={isRefreshingOffline}
                />
              )}

              <View style={styles.gridContainer}>
                {[...filteredDevices]
                .filter((d) => {
                  const suffix = d.node_id?.split('_').pop();
                  if (suffix === '6') {
                    const hasChannel7 = filteredDevices.some(x => x.node_id?.endsWith('_7'));
                    if (hasChannel7) return false;
                  }
                  return true;
                })
                .sort((a, b) => {
                  const aSuffix = parseInt(a.node_id?.split('_').pop() || '0', 10);
                  const bSuffix = parseInt(b.node_id?.split('_').pop() || '0', 10);
                  return aSuffix - bSuffix;
                })
                .map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onToggle={() => handleToggleDevice(device.id)}
                    onIncrease={() => handleAdjustValue(device.id, device.type === 'fan' ? 1 : 10)}
                    onDecrease={() => handleAdjustValue(device.id, device.type === 'fan' ? -1 : -10)}
                  />
                ))}
              </View>
            </View>
          )}

      </ScrollView>

      {/* Standardized Subtle Network Mode Toast Notification */}
      {feedbackToast && (
        <View style={styles.floatingToast}>
          <View
            style={[
              styles.toastDot,
              feedbackToast.type === 'offline' ? styles.toastDotOffline : styles.toastDotCloud,
            ]}
          />
          <Text style={styles.toastText}>{feedbackToast.text}</Text>
        </View>
      )}

    </SafeAreaView>;
}
const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 20,
    justifyContent: "center"
  },
  switchboardPanel: {
    backgroundColor: "#131313",
    borderRadius: 28,
    paddingTop: 14,
    paddingBottom: 2,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: "rgba(34, 197, 94, 0.25)",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8
  },
  panelHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)"
  },
  panelHeaderText: {
    fontSize: 11,
    fontFamily: "GoogleSansFlex-Bold",
    fontWeight: "900",
    color: "#22C55E",
    letterSpacing: 1.4
  },
  panelActiveBadge: {
    fontSize: 10,
    fontFamily: "GoogleSansFlex-Bold",
    fontWeight: "700",
    color: "rgba(229, 226, 225, 0.6)",
    letterSpacing: 0.8
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6
  },
  customHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.bg
  },
  headerLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  drawerMenuBtn: {
    padding: 4
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  compactRoomDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1B1B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4
  },
  compactRoomDropdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.textPrimary,
    maxWidth: 110
  },
  statusDotWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2
  },
  statusDotOnly: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusDotConnected: {
    backgroundColor: '#3B82F6', // Blue dot when connected
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4
  },
  statusDotDisconnected: {
    backgroundColor: '#EF4444', // Red dot when disconnected
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4
  },
  roomModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  roomModalContainer: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1C1B1B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  roomModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    marginBottom: 14
  },
  roomModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4
  },
  roomModalItemActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)'
  },
  roomModalText: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.textSecondary
  },
  roomModalTextActive: {
    color: TOKENS.accent,
    fontWeight: '700'
  },
  greetingSection: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: TOKENS.textPrimary
  },
  greetingSubtitle: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    marginTop: 4
  },
  sectionHeader: {
    fontSize: 10,
    fontFamily: "GoogleSansFlex-Bold",
    fontWeight: "800",
    color: TOKENS.textSecondary,
    letterSpacing: 1.5,
    marginTop: 24,
    marginBottom: 12
  },
  card: {
    backgroundColor: TOKENS.cardBg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 16,
    padding: 18,
    marginTop: 16
  },
  cardActiveBorder: {
    borderColor: TOKENS.accent
  },
  efficiencyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "GoogleSansFlex-Bold",
    fontWeight: "700",
    color: TOKENS.textPrimary
  },
  cardSubtitle: {
    fontSize: 9,
    fontFamily: "GoogleSansFlex-Bold",
    fontWeight: "700",
    color: TOKENS.textSecondary,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  trendText: {
    color: TOKENS.accent,
    fontSize: 12,
    fontWeight: "600"
  },
  efficiencyIndicatorRing: {
    alignItems: "center",
    justifyContent: "center"
  },
  circularIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3.5,
    borderColor: TOKENS.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 197, 94, 0.05)"
  },
  circularText: {
    fontSize: 11,
    fontFamily: "GoogleSansFlex-Bold",
    fontWeight: "bold",
    color: TOKENS.textPrimary
  },
  progressContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    paddingTop: 12,
    gap: 12
  },
  progressRow: {
    gap: 6
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressLabel: {
    fontSize: 11,
    color: TOKENS.textSecondary
  },
  progressValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: TOKENS.textPrimary
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: TOKENS.bg,
    borderRadius: 3,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: TOKENS.border
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: TOKENS.accent,
    borderRadius: 3
  },
  securityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  securityTextGroup: {
    flex: 1,
    gap: 3
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: TOKENS.bg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 2,
    justifyContent: "center"
  },
  switchTrackActive: {
    backgroundColor: "rgba(34, 197, 94, 0.25)",
    borderColor: TOKENS.accent
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: TOKENS.textSecondary
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
    backgroundColor: TOKENS.accent
  },
  tabsScrollView: {
    marginVertical: 12
  },
  tabsScrollContainer: {
    paddingRight: 16,
    gap: 8,
    alignItems: "center",
    height: 40
  },
  tabChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row"
  },
  tabChipActive: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent
  },
  tabChipInactive: {
    backgroundColor: TOKENS.cardBg,
    borderColor: TOKENS.border
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: "700"
  },
  tabChipTextActive: {
    color: "#002112"
  },
  tabChipTextInactive: {
    color: TOKENS.textSecondary
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12
  },
  gridItem: {
    width: "48%",
    backgroundColor: TOKENS.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
    gap: 12
  },
  gridItemActive: {
    borderColor: "rgba(34, 197, 94, 0.4)"
  },
  deviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  deviceMeta: {
    flex: 1,
    marginRight: 4
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  deviceName: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.textPrimary
  },
  deviceTypeLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: TOKENS.textSecondary,
    letterSpacing: 0.5,
    marginTop: 2
  },
  deviceSwitchTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: TOKENS.bg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 1.5,
    justifyContent: "center"
  },
  deviceSwitchTrackActive: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: TOKENS.accent
  },
  deviceSwitchThumb: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: TOKENS.textSecondary
  },
  deviceSwitchThumbActive: {
    transform: [{ translateX: 16 }],
    backgroundColor: TOKENS.accent
  },
  stepperContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: TOKENS.bg,
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  stepButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: TOKENS.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: TOKENS.border
  },
  stepButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.textPrimary
  },
  stepValueText: {
    fontSize: 11,
    fontWeight: "bold",
    color: TOKENS.textPrimary
  },
  disabledText: {
    color: TOKENS.textSecondary,
    opacity: 0.5
  },
  powerInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: TOKENS.bg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  powerInfoLabel: {
    fontSize: 9,
    color: TOKENS.textSecondary
  },
  powerInfoValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: TOKENS.textSecondary
  },
  powerInfoValueActive: {
    color: TOKENS.accent
  },
  statusBox: {
    backgroundColor: TOKENS.cardBg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginVertical: 8,
    flexDirection: "row",
    gap: 8
  },
  statusBoxWarning: {
    borderColor: "rgba(34, 197, 94, 0.3)",
    backgroundColor: "rgba(34, 197, 94, 0.05)",
    flexDirection: "column",
    gap: 4
  },
  statusTitle: {
    color: TOKENS.accent,
    fontSize: 10,
    fontFamily: "GoogleSansFlex-Bold",
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4
  },
  statusSubtitle: {
    color: TOKENS.textSecondary,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16
  },
  statusText: {
    color: TOKENS.textSecondary,
    fontSize: 11,
    fontStyle: "italic"
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 8
  },
  manageLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  manageLinkText: {
    color: TOKENS.accent,
    fontSize: 12,
    fontWeight: "700"
  },
  masterCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginTop: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 12
      },
      android: {
        elevation: 10
      }
    })
  },
  masterCardActive: {
    backgroundColor: "#242428",
    borderColor: "rgba(168, 85, 247, 0.4)",
    ...Platform.select({
      ios: {
        shadowColor: "#A855F7",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 16
      },
      android: {
        elevation: 12
      }
    })
  },
  masterInfoGroup: {
    flex: 1,
    marginRight: 12
  },
  masterStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  masterShortLabel: {
    fontSize: 20,
    fontWeight: "900",
    color: "#F3F4F6",
    letterSpacing: 0.5
  },
  masterTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: TOKENS.textPrimary,
    marginTop: 4,
    letterSpacing: 0.5
  },
  masterSubtitle: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    marginTop: 2
  },
  capsuleContainer: {
    flexDirection: "row",
    width: 108,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0D0D0D",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden"
  },
  capsuleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  capsuleBtnOnActive: {
    backgroundColor: "#22C55E",
  },
  capsuleBtnOffActive: {
    backgroundColor: "#1E1E1E",
  },
  capsuleText: {
    fontSize: 11,
    fontWeight: "bold"
  },
  capsuleTextOnActive: {
    color: "#002112",
  },
  capsuleTextOffActive: {
    color: "#dfe2f1",
  },
  capsuleTextInactive: {
    color: "#4B5563"
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8
  },
  listContainer: {
    flexDirection: "column",
    gap: 12,
    width: "100%"
  },
  listItem: {
    width: "100%",
    backgroundColor: TOKENS.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
    flexDirection: "column",
    gap: 12
  },
  listItemActive: {
    borderColor: "rgba(34, 197, 94, 0.25)"
  },
  deviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%"
  },
  deviceLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 8
  },
  deviceIcon: {
    marginRight: 2
  },
  sliderContainer: {
    width: "100%",
    marginTop: 4,
    backgroundColor: "#0D0D0D",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.03)"
  },
  sliderTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    marginBottom: 8
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 2,
    overflow: "hidden"
  },
  sliderProgress: {
    height: "100%",
    backgroundColor: TOKENS.accent,
    borderRadius: 2
  },
  sliderAdjuster: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sliderBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center"
  },
  sliderBtnText: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.textPrimary
  },
  sliderValueText: {
    fontSize: 12,
    fontWeight: "bold",
    color: TOKENS.textPrimary
  },
  powerConsumptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0D0D0D",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.03)"
  },
  powerLabel: {
    fontSize: 10,
    color: TOKENS.textSecondary
  },
  powerValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: TOKENS.textSecondary
  },
  powerValueActive: {
    color: TOKENS.accent
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TOKENS.accent,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.5
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  bellButton: {
    position: "relative",
    padding: 4
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  bellBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900"
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: TOKENS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 16,
    justifyContent: "space-between",
    alignItems: "center"
  },
  statColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start"
  },
  statNumber: {
    fontSize: 22,
    lineHeight: 26,
    height: 28,
    fontWeight: "bold",
    color: TOKENS.accent,
    textAlign: "center",
    marginBottom: 4
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: TOKENS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center"
  },
  masterGlassCard: {
    width: "100%",
    backgroundColor: "rgba(28, 27, 27, 0.7)",
    borderRadius: 28,
    padding: 24,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)"
  },
  masterCardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  controlCenterTag: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(34, 197, 94, 0.7)",
    letterSpacing: 2,
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
  },
  masterCardTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: TOKENS.textPrimary
  },
  activeBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(42, 42, 42, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)"
  },
  activeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: TOKENS.textPrimary,
    letterSpacing: 1
  },
  floatingMicBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 999
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  voiceModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1C1B1B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  voiceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  voiceModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    flex: 1,
    marginLeft: 8
  },
  voiceHelpSubtitle: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    marginBottom: 14,
    lineHeight: 16
  },
  voiceTextInput: {
    backgroundColor: '#161515',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 12
  },
  quickVoiceChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14
  },
  quickVoiceChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  quickVoiceChipText: {
    color: TOKENS.textSecondary,
    fontSize: 11,
    fontWeight: '600'
  },
  voiceResponseBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14
  },
  voiceRespSuccess: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)'
  },
  voiceRespError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)'
  },
  voiceSendButton: {
    backgroundColor: TOKENS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center'
  },
  voiceSendButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14
  },
  emptyWelcomeContainer: {
    backgroundColor: TOKENS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  emptyWelcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.textPrimary,
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyWelcomeSubtitle: {
    fontSize: 13,
    color: TOKENS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  addFirstDeviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.accent,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 6,
  },
  addFirstDeviceBtnText: {
    color: '#002112',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusDotButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  statusDotCloud: {
    backgroundColor: '#38BDF8', // 🔵 Blue light dot = Cloud
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
  statusDotLocal: {
    backgroundColor: '#FACC15', // 🟡 Yellow light dot = Local Wi-Fi (LAN)
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
  statusDotOffline: {
    backgroundColor: '#EF4444', // 🔴 Red light dot = Offline
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
  floatingToast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 24,
    alignSelf: 'center',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  toastDotLocal: {
    backgroundColor: '#FACC15',
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  toastDotCloud: {
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  toastDotSlow: {
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  toastDotOffline: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  toastText: {
    color: '#E5E2E1',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  topOfflineWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161515',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  topOfflineWarningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.3,
  },
  topOfflineWarningSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    lineHeight: 15,
  }
});
