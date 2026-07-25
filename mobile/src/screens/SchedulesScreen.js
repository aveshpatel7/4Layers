import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  Switch,
  Platform,
  StatusBar
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';
import BrandLogo from '../components/BrandLogo';

const TOKENS = {
  bg: '#0E0E0E',
  surface: '#1C1B1B',
  accent: '#22C55E',
  border: 'rgba(255,255,255,0.05)',
  textPrimary: '#E5E2E1',
  textSecondary: '#9CA3AF',
  error: '#EF4444'
};

const WEEKDAYS = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'S' }
];

const getUniqueDevices = (devList, roomList = []) => {
  const channelMap = new Map();

  for (const dev of devList) {
    // Determine channel key (ch_1..ch_7 or node_id)
    let channelKey = dev.node_id || dev.id;
    let cleanName = dev.name;

    if (dev.node_id && dev.node_id.includes('_')) {
      const suffix = dev.node_id.split('_').pop();
      const s = parseInt(suffix, 10);
      channelKey = `ch_${suffix}`;
      if (s === 5) cleanName = 'Fan';
      else if (s === 6) cleanName = 'Dimmer';
      else if (s === 7) cleanName = 'Master Switch';
      else if (s >= 1 && s <= 4) cleanName = `Switch ${s}`;
    } else if (dev.name?.toLowerCase().includes('fan')) {
      cleanName = 'Fan';
      channelKey = 'ch_5';
    } else if (dev.name?.toLowerCase().includes('dim') || dev.name?.toLowerCase().includes('strip')) {
      cleanName = 'Dimmer';
      channelKey = 'ch_6';
    } else if (dev.name?.toLowerCase().includes('master')) {
      cleanName = 'Master Switch';
      channelKey = 'ch_7';
    }

    if (!channelMap.has(channelKey)) {
      channelMap.set(channelKey, { ...dev, name: cleanName, channelKey });
    }
  }

  const unique = Array.from(channelMap.values());

  return unique.sort((a, b) => {
    const sA = a.node_id?.includes('_') ? parseInt(a.node_id.split('_').pop(), 10) || 0 : 0;
    const sB = b.node_id?.includes('_') ? parseInt(b.node_id.split('_').pop(), 10) || 0 : 0;
    return sA - sB;
  });
};

export default function SchedulesScreen() {
  const [schedules, setSchedules] = useState([]);
  const [devices, setDevices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Schedule Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('ALL');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedAction, setSelectedAction] = useState('ON');
  const [scheduleTime, setScheduleTime] = useState('08:00'); // HH:MM
  const [selectedDays, setSelectedDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [isSaving, setIsSaving] = useState(false);

  const filteredDevices = useMemo(() => {
    if (selectedRoomId === 'ALL') return devices;
    return devices.filter(d => d.room_id === selectedRoomId);
  }, [devices, selectedRoomId]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [schedsRes, devsRes, roomsRes] = await Promise.all([
        apiClient.get('/api/schedules'),
        apiClient.get('/api/devices'),
        apiClient.get('/api/rooms').catch(() => ({ data: [] }))
      ]);
      setSchedules(schedsRes.data);
      const roomList = roomsRes.data || [];
      setRooms(roomList);
      
      const sorted = getUniqueDevices(devsRes.data || [], roomList);
      setDevices(sorted);
      if (sorted.length > 0) {
        setSelectedDeviceId(sorted[0].id);
      }
    } catch (error) {
      console.error('Failed to load schedules dataset:', error);
      Alert.alert('Error', 'Could not sync schedules and devices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEnabled = async (scheduleId, currentVal) => {
    // Optimistic toggle
    setSchedules(prev =>
      prev.map(s => s.id === scheduleId ? { ...s, enabled: !currentVal } : s)
    );

    try {
      await apiClient.patch(`/api/schedules/${scheduleId}`, {
        enabled: !currentVal
      });
    } catch (error) {
      console.error('Failed to toggle schedule state:', error);
      // Rollback
      setSchedules(prev =>
        prev.map(s => s.id === scheduleId ? { ...s, enabled: currentVal } : s)
      );
    }
  };

const normalizeTimeInput = (raw) => {
  if (!raw) return '08:00';
  const clean = raw.trim().replace(/[^0-9:]/g, '');
  if (!clean) return '08:00';

  let hours = 8;
  let minutes = 0;

  if (clean.includes(':')) {
    const parts = clean.split(':');
    let hStr = parts[0] || '0';
    let mStr = parts[1] || '0';

    hours = parseInt(hStr, 10);
    if (isNaN(hours)) hours = 8;

    if (mStr.length === 1) {
      minutes = parseInt(mStr, 10) * 10;
    } else {
      minutes = parseInt(mStr, 10);
      if (isNaN(minutes)) minutes = 0;
    }
  } else {
    // Pure numbers (e.g. 8, 14, 830, 2200)
    if (clean.length === 1 || clean.length === 2) {
      hours = parseInt(clean, 10);
      minutes = 0;
    } else if (clean.length === 3) {
      hours = parseInt(clean.substring(0, 1), 10);
      minutes = parseInt(clean.substring(1, 3), 10);
    } else if (clean.length >= 4) {
      hours = parseInt(clean.substring(0, 2), 10);
      minutes = parseInt(clean.substring(2, 4), 10);
    }
  }

  // Bounds check (00-23 for hours, 00-59 for minutes)
  if (isNaN(hours) || hours < 0) hours = 0;
  if (hours > 23) hours = 23;
  if (isNaN(minutes) || minutes < 0) minutes = 0;
  if (minutes > 59) minutes = 59;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  return `${hStr}:${mStr}`;
};

  const handleCreateSchedule = async () => {
    if (!selectedDeviceId) {
      Alert.alert('Validation Error', 'Please select a device');
      return;
    }

    // Auto-normalize user input (e.g. 830 -> 08:30, 8 -> 08:00, 2200 -> 22:00)
    const formattedTime = normalizeTimeInput(scheduleTime);
    setScheduleTime(formattedTime);

    if (selectedDays.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one day');
      return;
    }

    try {
      setIsSaving(true);
      const daysCSV = selectedDays.join(',');
      await apiClient.post('/api/schedules', {
        device_id: selectedDeviceId,
        action: selectedAction,
        time: formattedTime,
        days: daysCSV,
        enabled: true
      });

      setModalVisible(false);
      setScheduleTime('08:00');
      setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri']);
      
      // Refresh list
      const schedsRes = await apiClient.get('/api/schedules');
      setSchedules(schedsRes.data);
      Alert.alert('Success', 'Automation schedule successfully created');
    } catch (error) {
      console.error('Failed to create schedule:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = (scheduleId) => {
    Alert.alert(
      'Remove Schedule',
      'Are you sure you want to delete this schedule rule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistically remove from UI state immediately for instant feedback
            setSchedules(prev => prev.filter(s => s.id !== scheduleId));

            try {
              await apiClient.delete(`/api/schedules/${scheduleId}`);
            } catch (error) {
              console.error('Failed to delete schedule:', error);
              // Re-sync on failure
              const schedsRes = await apiClient.get('/api/schedules');
              setSchedules(schedsRes.data);
              Alert.alert('Error', 'Failed to delete schedule from server.');
            }
          }
        }
      ]
    );
  };

  const handleRunScheduleManually = async (scheduleId) => {
    try {
      await apiClient.post(`/api/schedules/${scheduleId}/run`);
      Alert.alert('Success', 'Schedule rule executed immediately!');
    } catch (error) {
      console.error('Failed to trigger schedule:', error);
      Alert.alert('Error', 'Failed to execute schedule rule.');
    }
  };

  const getDeviceName = (deviceId) => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) return 'Unknown Device';
    const room = rooms.find(r => r.id === dev.room_id);
    return room && rooms.length > 1 ? `${dev.name} (${room.name})` : dev.name;
  };

  const toggleDaySelection = (dayKey) => {
    if (selectedDays.includes(dayKey)) {
      setSelectedDays(prev => prev.filter(k => k !== dayKey));
    } else {
      setSelectedDays(prev => [...prev, dayKey]);
    }
  };

  const formatDaysLabel = (csvDays) => {
    if (!csvDays) return '';
    const list = csvDays.split(',');
    if (list.length === 7) return 'Daily';
    if (list.length === 5 && !list.includes('sat') && !list.includes('sun')) return 'Weekdays';
    return list.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
  };

  const renderDaysList = (csvDays) => {
    const list = csvDays ? csvDays.split(',') : [];
    const DAYS_CONFIG = [
      { key: 'mon', label: 'M' },
      { key: 'tue', label: 'T' },
      { key: 'wed', label: 'W' },
      { key: 'thu', label: 'T' },
      { key: 'fri', label: 'F' },
      { key: 'sat', label: 'S' },
      { key: 'sun', label: 'S' }
    ];
    return (
      <View style={styles.daysBadgeRow}>
        {DAYS_CONFIG.map((day, idx) => {
          const isActive = list.includes(day.key);
          return (
            <View 
              key={idx} 
              style={[
                styles.dayBadge, 
                isActive && styles.dayBadgeActive
              ]}
            >
              <Text style={[styles.dayBadgeText, isActive && styles.dayBadgeTextActive]}>
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={TOKENS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BrandLogo size="small" />
          <Text style={styles.title}>Schedules</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <MaterialCommunityIcons name="plus" size={18} color={TOKENS.bg} />
          <Text style={styles.addButtonText}>Create</Text>
        </TouchableOpacity>
      </View>

      {schedules.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="clock-outline" size={64} color={TOKENS.textSecondary} />
          <Text style={styles.emptyText}>No schedules configured.</Text>
          <Text style={styles.emptySubtext}>Create automated rules to toggle smart devices at specific times.</Text>
        </View>
      ) : (
        <FlatList
          data={schedules}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={[styles.scheduleCard, !item.enabled && styles.scheduleCardDisabled]}>
              <View style={styles.scheduleCardHeader}>
                <View style={styles.scheduleTimeGroup}>
                  <Text style={styles.scheduleTimeText}>{item.time}</Text>
                  <Text style={styles.scheduleTimeSub}>IST</Text>
                </View>
                <Switch
                  value={item.enabled}
                  onValueChange={() => handleToggleEnabled(item.id, item.enabled)}
                  trackColor={{ false: '#313540', true: 'rgba(34, 197, 94, 0.4)' }}
                  thumbColor={item.enabled ? TOKENS.accent : TOKENS.textSecondary}
                />
              </View>

              <View style={styles.scheduleDetails}>
                <MaterialCommunityIcons 
                  name={item.action === 'ON' ? "power" : "power-off"} 
                  size={16} 
                  color={item.action === 'ON' ? TOKENS.accent : TOKENS.error} 
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.scheduleDeviceName} numberOfLines={1}>
                  Turn <Text style={{ color: item.action === 'ON' ? TOKENS.accent : TOKENS.error, fontWeight: 'bold' }}>{item.action}</Text> {getDeviceName(item.device_id)}
                </Text>
              </View>

              {/* Days Week list row */}
              <View style={styles.cardBottomRow}>
                {renderDaysList(item.days)}
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => handleRunScheduleManually(item.id)} style={[styles.cardActionBtn, { marginRight: 10 }]} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="play-circle-outline" size={20} color={TOKENS.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteSchedule(item.id)} style={styles.cardActionBtn} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={TOKENS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Add Schedule Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Schedule Rule</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={TOKENS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {rooms.length > 0 && (
                <>
                  <Text style={styles.label}>Select Room</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.deviceChipsRow, { marginBottom: 12 }]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.deviceChip,
                        selectedRoomId === 'ALL' && styles.deviceChipSelected
                      ]}
                      onPress={() => {
                        setSelectedRoomId('ALL');
                        if (devices.length > 0) setSelectedDeviceId(devices[0].id);
                      }}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons
                        name="home-outline"
                        size={16}
                        color={selectedRoomId === 'ALL' ? TOKENS.bg : TOKENS.textSecondary}
                      />
                      <Text style={[
                        styles.deviceChipText,
                        selectedRoomId === 'ALL' && styles.deviceChipTextSelected
                      ]}>
                        All Rooms
                      </Text>
                    </TouchableOpacity>

                    {rooms.map((room) => {
                      const isSelected = selectedRoomId === room.id;
                      return (
                        <TouchableOpacity
                          key={room.id}
                          style={[
                            styles.deviceChip,
                            isSelected && styles.deviceChipSelected
                          ]}
                          onPress={() => {
                            setSelectedRoomId(room.id);
                            const roomDevs = devices.filter(d => d.room_id === room.id);
                            if (roomDevs.length > 0) setSelectedDeviceId(roomDevs[0].id);
                          }}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons
                            name="door"
                            size={16}
                            color={isSelected ? TOKENS.bg : TOKENS.textSecondary}
                          />
                          <Text style={[
                            styles.deviceChipText,
                            isSelected && styles.deviceChipTextSelected
                          ]}>
                            {room.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              <Text style={styles.label}>Select Appliance / Switch</Text>
              {filteredDevices.length === 0 ? (
                <Text style={styles.warningText}>No devices available in this room.</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.deviceChipsRow}
                >
                  {filteredDevices.map((dev) => {
                    const isSelected = selectedDeviceId === dev.id;
                    const devIcon = dev.type === 'fan' ? 'fan' : dev.type === 'light' ? 'lightbulb-outline' : 'power';
                    const room = rooms.find(r => r.id === dev.room_id);
                    const labelText = room && selectedRoomId === 'ALL' && rooms.length > 1 ? `${dev.name} (${room.name})` : dev.name;

                    return (
                      <TouchableOpacity
                        key={dev.id}
                        style={[
                          styles.deviceChip,
                          isSelected && styles.deviceChipSelected
                        ]}
                        onPress={() => setSelectedDeviceId(dev.id)}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name={devIcon}
                          size={16}
                          color={isSelected ? TOKENS.bg : TOKENS.textSecondary}
                        />
                        <Text style={[
                          styles.deviceChipText,
                          isSelected && styles.deviceChipTextSelected
                        ]}>
                          {labelText}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <Text style={styles.label}>Action</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionOption, selectedAction === 'ON' && styles.actionOptionOn]}
                  onPress={() => setSelectedAction('ON')}
                >
                  <Text style={[styles.actionOptionText, selectedAction === 'ON' && styles.actionOptionTextOn]}>TURN ON</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionOption, selectedAction === 'OFF' && styles.actionOptionOff]}
                  onPress={() => setSelectedAction('OFF')}
                >
                  <Text style={[styles.actionOptionText, selectedAction === 'OFF' && styles.actionOptionTextOff]}>TURN OFF</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Time</Text>
              <TextInput
                style={styles.input}
                value={scheduleTime}
                onChangeText={(txt) => {
                  setScheduleTime(txt);
                  if (txt.length === 4 && !txt.includes(':')) {
                    const h = txt.substring(0, 2);
                    const m = txt.substring(2, 4);
                    if (parseInt(h, 10) <= 23 && parseInt(m, 10) <= 59) {
                      setScheduleTime(`${h}:${m}`);
                    }
                  }
                }}
                onBlur={() => setScheduleTime(normalizeTimeInput(scheduleTime))}
                placeholder="e.g. 830, 8, 2200, 08:30"
                placeholderTextColor={TOKENS.textSecondary}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />

              <Text style={styles.label}>Weekly Schedule</Text>
              <View style={styles.weekdaysContainer}>
                {WEEKDAYS.map((day) => {
                  const isSelected = selectedDays.includes(day.key);
                  return (
                    <TouchableOpacity
                      key={day.key}
                      style={[
                        styles.dayChip,
                        isSelected && styles.dayChipSelected
                      ]}
                      onPress={() => toggleDaySelection(day.key)}
                    >
                      <Text style={[
                        styles.dayChipText,
                        isSelected && styles.dayChipTextSelected
                      ]}>
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleCreateSchedule}
                  disabled={isSaving || devices.length === 0}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={TOKENS.bg} />
                  ) : (
                    <Text style={styles.saveButtonText}>Create Rule</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 36) : 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: TOKENS.bg
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: TOKENS.textPrimary
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4
  },
  addButtonText: {
    color: TOKENS.bg,
    fontWeight: '700',
    fontSize: 14
  },
  listContainer: {
    paddingBottom: 20
  },
  scheduleCard: {
    backgroundColor: TOKENS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    flexDirection: 'column',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2
  },
  scheduleCardDisabled: {
    opacity: 0.6
  },
  scheduleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%'
  },
  scheduleTimeGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4
  },
  scheduleTimeText: {
    fontSize: 22,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    letterSpacing: -0.5
  },
  scheduleTimeSub: {
    fontSize: 10,
    fontWeight: '700',
    color: TOKENS.textSecondary
  },
  scheduleDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#131313',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)'
  },
  scheduleDeviceName: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.textSecondary,
    flex: 1
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 4
  },
  daysBadgeRow: {
    flexDirection: 'row',
    gap: 4
  },
  dayBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },
  dayBadgeActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)'
  },
  dayBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: TOKENS.textSecondary
  },
  dayBadgeTextActive: {
    color: TOKENS.accent,
    fontWeight: 'bold'
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12
  },
  cardActionBtn: {
    padding: 4,
    backgroundColor: '#131313',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80
  },
  emptyText: {
    fontSize: 16,
    color: TOKENS.textPrimary,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    textAlign: 'center',
    lineHeight: 18
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: TOKENS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderTopColor: TOKENS.border
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TOKENS.textPrimary
  },
  label: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    marginBottom: 8,
    marginTop: 14,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  deviceChipsRow: {
    paddingVertical: 4,
    gap: 8
  },
  deviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#171616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6
  },
  deviceChipSelected: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent
  },
  deviceChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.textSecondary
  },
  deviceChipTextSelected: {
    color: TOKENS.bg,
    fontWeight: '800'
  },
  deviceOptionTextSelected: {
    color: TOKENS.accent
  },
  warningText: {
    color: TOKENS.error,
    fontSize: 12
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12
  },
  actionOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.bg
  },
  actionOptionOn: {
    borderColor: TOKENS.accent,
    backgroundColor: 'rgba(34, 197, 94, 0.15)'
  },
  actionOptionOff: {
    borderColor: TOKENS.error,
    backgroundColor: 'rgba(239, 68, 68, 0.15)'
  },
  actionOptionText: {
    color: TOKENS.textPrimary,
    fontWeight: '700',
    fontSize: 12
  },
  actionOptionTextOn: {
    color: TOKENS.accent
  },
  actionOptionTextOff: {
    color: TOKENS.error
  },
  input: {
    backgroundColor: TOKENS.bg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    padding: 12,
    color: TOKENS.textPrimary,
    fontSize: 14
  },
  weekdaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKENS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  dayChipSelected: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent
  },
  dayChipText: {
    color: TOKENS.textSecondary,
    fontSize: 12,
    fontWeight: '700'
  },
  dayChipTextSelected: {
    color: TOKENS.bg,
    fontWeight: '800'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 10
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  cancelButtonText: {
    color: TOKENS.textPrimary,
    fontWeight: '700'
  },
  saveButton: {
    backgroundColor: TOKENS.accent
  },
  saveButtonText: {
    color: TOKENS.bg,
    fontWeight: '700'
  },
  cardActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  testBtn: {
    padding: 2
  }
});
