import React, { useState, useEffect, useRef } from "react";
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
  PanResponder
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import apiClient from "../api/client";
import DeviceCard, { LuminaRockerSwitch } from "../components/DeviceCard";
import EnergyChart from "../components/EnergyChart";
import BrandLogo from "../components/BrandLogo";
import SideDrawer from "../components/SideDrawer";
import { connectMqtt, disconnectMqtt, publishMessage } from "../services/mqttClient";
const TOKENS = {
  bg: "#0E0E0E",
  cardBg: "#1C1B1B",
  accent: "#22C55E",
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
      const homesRes = await apiClient.get('/api/homes');
      if (homesRes.data && homesRes.data.length > 0) {
        const homeId = homesRes.data[0].id;
        const roomsRes = await apiClient.get(`/api/rooms/home/${homeId}`);
        if (roomsRes.data && roomsRes.data.length > 0) {
          const mapping = {};
          roomsRes.data.forEach(r => {
            mapping[r.id] = r.name;
          });
          setRoomMapping(mapping);
          setDbRooms(roomsRes.data);
          
          // Auto-select first room if none is selected, or if selected room was deleted
          const roomIds = roomsRes.data.map(r => r.id);
          setSelectedRoom(prev => {
            if (!prev || !roomIds.includes(prev)) {
              return roomsRes.data[0].id;
            }
            return prev;
          });
        } else {
          setDbRooms([]);
          setSelectedRoom("");
        }
      }
    } catch (e) {
      console.warn("Failed to fetch room mapping:", e);
    }
  };

  const fetchUnreadAlertsCount = async () => {
    try {
      const res = await apiClient.get('/api/alerts?unread_only=true');
      setUnreadAlertsCount(res.data.length);
    } catch (e) {
      console.warn("Failed to fetch unread alerts count:", e);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get('/api/users/me');
      if (res.data && res.data.username) {
        setUsername(res.data.username);
      }
    } catch (e) {
      console.warn("Failed to fetch user profile name:", e);
    }
  };

  const fetchDevices = async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const response = await apiClient.get("/api/devices");
      const data = response.data;
      if (Array.isArray(data)) {
        const formattedList = data.map(d => {
          let mobileType = 'outlet';
          if (d.device_type === 'light') mobileType = 'light';
          else if (d.device_type === 'ac') mobileType = 'thermostat';
          else if (d.device_type === 'fan') mobileType = 'fan';
          else if (d.device_type === 'tv') mobileType = 'outlet';
          else if (d.device_type === 'plug') mobileType = 'outlet';

          return {
            id: d.id,
            name: d.name,
            room_id: d.room_id,
            node_id: d.node_id,
            type: mobileType,
            status: d.current_state?.status === 'ON',
            value: d.current_state?.value !== undefined ? d.current_state.value : (d.device_type === 'ac' ? 72 : 50)
          };
        });
        
        // Sort devices by node_id to ensure stable ordering in the dashboard
        formattedList.sort((a, b) => {
          if (!a.node_id || !b.node_id) return 0;
          return a.node_id.localeCompare(b.node_id, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        setDevices(formattedList);
        setHasError(false);
      } else {
        throw new Error("Returned telemetry data is not a valid list of devices");
      }
    } catch (error) {
      console.warn("API fetch failed:", error);
      setHasError(true);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
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
    
    return () => {
      // Disconnect cleanly when leaving dashboard screen
      disconnectMqtt();
    };
  }, []);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const showLoading = !hasLoadedRef.current;
    fetchDevices(showLoading);
    hasLoadedRef.current = true;
    const intervalId = setInterval(() => {
      fetchDevices(false);
      fetchUnreadAlertsCount();
    }, 10000);
    return () => clearInterval(intervalId);
  }, [roomMapping]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchRoomsMapping();
      fetchDevices(true);
      fetchUnreadAlertsCount();
      fetchProfile();
    });
    return unsubscribe;
  }, [navigation, roomMapping]);

  const handleToggleDevice = async (id) => {
    const target = devices.find((d) => d.id === id);
    if (!target) return;
    const nextStatus = !target.status;
    
    // 1. Optimistic UI update
    setDevices((prev) => prev.map((d) => d.id === id ? { ...d, status: nextStatus } : d));
    
    // 2. Direct MQTT publish over WebSockets (sub-30ms execution)
    let baseNodeId = target.node_id;
    let channel = 1;
    if (target.node_id.includes('_')) {
      const parts = target.node_id.split('_');
      baseNodeId = parts[0];
      channel = parseInt(parts[parts.length - 1], 10);
    }
    const topic = `home/device/${baseNodeId}/control`;
    publishMessage(topic, {
      channel,
      status: nextStatus ? 'ON' : 'OFF'
    });

    // 3. HTTP sync backup
    try {
      await apiClient.post(`/api/devices/${id}/control`, {
        state: { status: nextStatus ? 'ON' : 'OFF' }
      });
    } catch (err) {
      console.warn("Failed to sync toggle with server MQTT:", err);
      setDevices((prev) => prev.map((d) => d.id === id ? { ...d, status: !nextStatus } : d));
    }
  };

  const handleAdjustValue = async (id, step) => {
    const target = devices.find((d) => d.id === id);
    if (!target) return;

    const isFan = target.type === 'fan' || target.node_id?.endsWith('_5') || target.name?.toLowerCase().includes('fan');
    const isDimmer = target.type === 'light' || target.node_id?.endsWith('_6') || target.name?.toLowerCase().includes('dim') || target.name?.toLowerCase().includes('strip');

    const defaultVal = isFan ? 3 : 65;
    const currentVal = (typeof target.value === 'number' && !isNaN(target.value)) ? target.value : defaultVal;

    const minVal = isFan ? 1 : 10;
    const maxVal = isFan ? 5 : 100;

    const nextVal = Math.max(minVal, Math.min(maxVal, currentVal + step));
    if (nextVal === currentVal) return;

    // 1. Optimistic UI update
    setDevices((prev) => prev.map((d) => d.id === id ? { ...d, value: nextVal } : d));

    // 2. Direct MQTT publish
    let baseNodeId = target.node_id;
    let channel = 1;
    if (target.node_id && target.node_id.includes('_')) {
      const parts = target.node_id.split('_');
      baseNodeId = parts[0];
      channel = parseInt(parts[parts.length - 1], 10);
    }
    const topic = `home/device/${baseNodeId}/control`;
    const payload = {
      channel,
      status: target.status ? 'ON' : 'OFF',
      value: nextVal
    };
    if (isFan) {
      payload.speed = nextVal;
    }
    publishMessage(topic, payload);

    // 3. HTTP sync backup
    try {
      await apiClient.post(`/api/devices/${id}/control`, {
        state: { 
          status: target.status ? 'ON' : 'OFF',
          value: nextVal,
          ...(isFan ? { speed: nextVal } : {})
        }
      });
    } catch (err) {
      console.warn("Failed to sync adjusted value with server:", err);
      setDevices((prev) => prev.map((d) => d.id === id ? { ...d, value: currentVal } : d));
    }
  };

  const handleBulkControl = async (turnOn) => {
    const targetState = turnOn ? 'ON' : 'OFF';
    const deviceIds = filteredDevices.map(d => d.id);

    if (deviceIds.length === 0) return;

    // 1. Optimistic UI update
    setDevices(prev => prev.map(d => deviceIds.includes(d.id) ? { ...d, status: turnOn } : d));

    // 2. Direct MQTT publish (Master Channel 7 command to all unique boards in the room)
    const uniqueBaseNodeIds = new Set();
    filteredDevices.forEach(d => {
      if (d.node_id.includes('_')) {
        uniqueBaseNodeIds.add(d.node_id.split('_')[0]);
      }
    });

    uniqueBaseNodeIds.forEach(baseNodeId => {
      const topic = `home/device/${baseNodeId}/control`;
      publishMessage(topic, {
        channel: 7,
        status: targetState
      });
    });

    // 3. HTTP sync backup
    try {
      await apiClient.post('/api/devices/bulk-control', {
        device_ids: deviceIds,
        state: { status: targetState }
      });
    } catch (err) {
      console.warn("Failed bulk control operation:", err);
      fetchDevices(true);
    }
  };

  const filteredDevices = devices.filter((device) => device.room_id === selectedRoom);

  const isSecurityArmed = !!isArmed;
  const ROOM_TABS = dbRooms.map((r) => ({ id: r.id, label: r.name }));

  const currentRoomName = dbRooms.find(r => r.id === selectedRoom)?.name || 'Living Room';

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

          {/* Status Indicator Dot Only (Blue = Connected, Red = Disconnected) */}
          <View style={styles.statusDotWrapper}>
            <View style={[
              styles.statusDotOnly,
              !hasError ? styles.statusDotConnected : styles.statusDotDisconnected
            ]} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>SWITCHBOARD CONTROLS</Text>
        </View>
        
        {isLoading ? <View style={styles.statusBox}>
            <View style={styles.activeDot} />
            <Text style={styles.statusText}>Connecting to hardware relays...</Text>
          </View> : hasError ? <View style={[styles.statusBox, styles.statusBoxWarning]}>
            <Text style={styles.statusTitle}>CONNECTION FALLBACK ACTIVE</Text>
            <Text style={styles.statusSubtitle}>FastAPI server is sleeping. Local telemetry simulation running.</Text>
          </View> : filteredDevices.length === 0 ? <View style={styles.statusBox}>
            <Text style={styles.statusText}>No devices in this room yet</Text>
          </View> : <View style={styles.gridContainer}>
            {[...filteredDevices]
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
          </View>}

      </ScrollView>
    </SafeAreaView>;
}
const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32
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
  }
});
