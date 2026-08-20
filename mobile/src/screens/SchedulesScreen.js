import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/client';
import BrandLogo from '../components/BrandLogo';
import WheelColumn from '../components/WheelColumn';

const TOKENS = {
  bg: '#0E0E0E',
  surface: '#1C1B1B',
  accent: '#1fa971',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#E5E2E1',
  textSecondary: '#9CA3AF',
  error: '#EF4444'
};

const DAY_BUTTONS = [
  { key: 'sun', label: 'S' },
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' }
];

const WEEKDAYS = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'S' }
];

const HOURS_LIST = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES_LIST = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const DAY_OPTIONS = [
  { label: 'Everyday', days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
  { label: 'Weekdays', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  { label: 'Weekends', days: ['sat', 'sun'] }
];

const getUniqueDevices = (devList, roomList = []) => {
  if (!devList || !Array.isArray(devList)) return [];
  return [...devList].sort((a, b) => {
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

  // Add Schedule Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [showTimeWheel, setShowTimeWheel] = useState(false);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('ALL');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
  const [selectedAction, setSelectedAction] = useState('ON');
  const [scheduleTime, setScheduleTime] = useState('08:00'); // HH:MM
  const [wheelHour, setWheelHour] = useState('08');
  const [wheelMinute, setWheelMinute] = useState('00');
  const [wheelPeriod, setWheelPeriod] = useState('AM');
  const [selectedDays, setSelectedDays] = useState(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  const [selectedDayOptionLabel, setSelectedDayOptionLabel] = useState('Everyday');
  const [isSaving, setIsSaving] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);

  const toggleDeviceSelection = (id) => {
    if (selectedDeviceIds.includes(id)) {
      setSelectedDeviceIds(prev => prev.filter(dId => dId !== id));
    } else {
      setSelectedDeviceIds(prev => [...prev, id]);
    }
  };

  const toggleDaySelection = (dayKey) => {
    if (selectedDays.includes(dayKey)) {
      setSelectedDays(prev => prev.filter(d => d !== dayKey));
    } else {
      setSelectedDays(prev => [...prev, dayKey]);
    }
  };

  const handleSelectDayOption = (opt) => {
    setSelectedDayOptionLabel(opt.label);
    setSelectedDays(opt.days);
  };

  const updateTimeFromWheel = (h, m, p) => {
    setWheelHour(h);
    setWheelMinute(m);
    setWheelPeriod(p);
    let hourNum = parseInt(h, 10);
    if (p === 'PM' && hourNum < 12) hourNum += 12;
    if (p === 'AM' && hourNum === 12) hourNum = 0;
    const hhStr = hourNum.toString().padStart(2, '0');
    const mmStr = m.toString().padStart(2, '0');
    setScheduleTime(`${hhStr}:${mmStr}`);
  };

  const handleDayScrollEnd = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(DAY_OPTIONS.length - 1, Math.round(y / 44)));
    if (DAY_OPTIONS[idx]) {
      handleSelectDayOption(DAY_OPTIONS[idx]);
    }
  }, []);

  const handleHourScrollEnd = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(HOURS_LIST.length - 1, Math.round(y / 44)));
    if (HOURS_LIST[idx]) {
      updateTimeFromWheel(HOURS_LIST[idx], wheelMinute, wheelPeriod);
    }
  }, [wheelMinute, wheelPeriod]);

  const handleMinuteScrollEnd = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(MINUTES_LIST.length - 1, Math.round(y / 44)));
    if (MINUTES_LIST[idx]) {
      updateTimeFromWheel(wheelHour, MINUTES_LIST[idx], wheelPeriod);
    }
  }, [wheelHour, wheelPeriod]);

  const handlePeriodScrollEnd = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(1, Math.round(y / 44)));
    const p = ['AM', 'PM'][idx];
    if (p) {
      updateTimeFromWheel(wheelHour, wheelMinute, p);
    }
  }, [wheelHour, wheelMinute]);

  const handleOpenCreateModal = () => {
    setEditingScheduleId(null);
    const now = new Date();
    let rawHours = now.getHours();
    const rawMinutes = now.getMinutes();

    const period = rawHours >= 12 ? 'PM' : 'AM';
    let displayHour = rawHours % 12;
    if (displayHour === 0) displayHour = 12;

    const hStr = displayHour.toString().padStart(2, '0');
    const mStr = rawMinutes.toString().padStart(2, '0');

    setWheelHour(hStr);
    setWheelMinute(mStr);
    setWheelPeriod(period);
    setSelectedDayOptionLabel('Everyday');
    setSelectedDays(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);

    const hh24 = rawHours.toString().padStart(2, '0');
    setScheduleTime(`${hh24}:${mStr}`);

    setSelectedRoomId('ALL');
    if (devices.length > 0) {
      setSelectedDeviceId(devices[0].id);
      setSelectedDeviceIds([devices[0].id]);
    } else {
      setSelectedDeviceIds([]);
    }

    setScheduleName('');
    setShowTimeWheel(false);
    setShowRoomPicker(false);
    setSelectedAction('ON');

    setModalVisible(true);
  };

  const handleOpenEditModal = (schedule) => {
    if (!schedule) return;
    setEditingScheduleId(schedule.id);

    // 1. Parse time
    const timeStr = schedule.time || '08:00';
    const parts = timeStr.split(':');
    let rawH = parseInt(parts[0], 10);
    if (isNaN(rawH)) rawH = 8;
    const rawM = parseInt(parts[1], 10);
    const mStr = (isNaN(rawM) ? 0 : rawM).toString().padStart(2, '0');
    const period = rawH >= 12 ? 'PM' : 'AM';
    let displayH = rawH % 12;
    if (displayH === 0) displayH = 12;
    const hStr = displayH.toString().padStart(2, '0');

    setWheelHour(hStr);
    setWheelMinute(mStr);
    setWheelPeriod(period);
    setScheduleTime(timeStr);

    // 2. Parse repeat days
    const rawDays = schedule.days ? schedule.days.toLowerCase().split(',').map(d => d.trim()).filter(Boolean) : ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    setSelectedDays(rawDays);
    if (rawDays.length === 7) {
      setSelectedDayOptionLabel('Everyday');
    } else if (rawDays.length === 5 && !rawDays.includes('sat') && !rawDays.includes('sun')) {
      setSelectedDayOptionLabel('Weekdays');
    } else if (rawDays.length === 2 && rawDays.includes('sat') && rawDays.includes('sun')) {
      setSelectedDayOptionLabel('Weekends');
    } else {
      setSelectedDayOptionLabel('Custom');
    }

    // 3. Parse action
    setSelectedAction(schedule.action || 'ON');

    // 4. Parse devices
    if (schedule.actions_json && Array.isArray(schedule.actions_json) && schedule.actions_json.length > 0) {
      const devIds = schedule.actions_json.map(a => a.device_id).filter(Boolean);
      setSelectedDeviceIds(devIds);
      if (devIds.length > 0) {
        setSelectedDeviceId(devIds[0]);
      }
    } else if (schedule.device_id) {
      setSelectedDeviceIds([schedule.device_id]);
      setSelectedDeviceId(schedule.device_id);
    } else {
      setSelectedDeviceIds([]);
    }

    setScheduleName(schedule.name || '');
    setSelectedRoomId('ALL');
    setShowTimeWheel(false);
    setShowRoomPicker(false);
    setModalVisible(true);
  };

  const filteredDevices = useMemo(() => {
    if (!selectedRoomId || selectedRoomId === 'ALL') return devices;
    const roomFiltered = devices.filter(d => d.room_id === selectedRoomId);
    const result = roomFiltered.length > 0 ? roomFiltered : devices;
    console.log('[Schedules DEBUG] filteredDevices recalculated:', result.length, 'for room:', selectedRoomId);
    return result;
  }, [devices, selectedRoomId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [schedsRes, devsRes, roomsRes] = await Promise.all([
        apiClient.get('/api/schedules'),
        apiClient.get('/api/devices'),
        apiClient.get('/api/rooms').catch(() => ({ data: [] }))
      ]);
      console.log('[Schedules DEBUG] Raw GET /api/devices response count:', devsRes.data?.length);
      setSchedules(schedsRes.data);
      const roomList = roomsRes.data || [];
      setRooms(roomList);
      
      const sorted = getUniqueDevices(devsRes.data || [], roomList);
      console.log('[Schedules DEBUG] Processed devices count:', sorted.length);
      setDevices(sorted);
      if (sorted.length > 0) {
        setSelectedDeviceId(sorted[0].id);
        setSelectedDeviceIds([sorted[0].id]);
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

  const handleSaveSchedule = async () => {
    const targetIds = selectedDeviceIds.length > 0 ? selectedDeviceIds : (selectedDeviceId ? [selectedDeviceId] : []);

    if (targetIds.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one appliance/switch');
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
      const actionsPayload = targetIds.map(dId => ({
        device_id: dId,
        action: selectedAction
      }));

      const payload = {
        device_id: targetIds[0],
        action: selectedAction,
        time: formattedTime,
        days: daysCSV,
        enabled: true,
        actions: actionsPayload
      };

      if (editingScheduleId) {
        await apiClient.put(`/api/schedules/${editingScheduleId}`, payload);
      } else {
        await apiClient.post('/api/schedules', payload);
      }

      setModalVisible(false);
      const wasEditing = !!editingScheduleId;
      setEditingScheduleId(null);
      setScheduleTime('08:00');
      setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri']);
      
      // Refresh list
      const schedsRes = await apiClient.get('/api/schedules');
      setSchedules(schedsRes.data);
      Alert.alert('Success', wasEditing ? 'Schedule updated successfully!' : `Automation rule created for ${targetIds.length} switch(es)!`);
    } catch (error) {
      console.error('Failed to save schedule:', error);
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

  const getScheduleDevicesLabel = (schedule) => {
    if (schedule.actions_json && Array.isArray(schedule.actions_json) && schedule.actions_json.length > 0) {
      const names = schedule.actions_json.map(act => {
        const dId = act.device_id;
        const dev = devices.find(d => d.id === dId);
        if (!dev) return null;
        const room = rooms.find(r => r.id === dev.room_id);
        return room && rooms.length > 1 ? `${dev.name} (${room.name})` : dev.name;
      }).filter(Boolean);

      if (names.length > 0) {
        return names.join(', ');
      }
    }
    return getDeviceName(schedule.device_id);
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
        <TouchableOpacity style={styles.addButton} onPress={handleOpenCreateModal}>
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
                <Text style={styles.scheduleDeviceName} numberOfLines={2}>
                  Turn <Text style={{ color: item.action === 'ON' ? TOKENS.accent : TOKENS.error, fontWeight: 'bold' }}>{item.action}</Text> {getScheduleDevicesLabel(item)}
                </Text>
              </View>

              {/* Days Week list row */}
              <View style={styles.cardBottomRow}>
                {renderDaysList(item.days)}
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => handleOpenEditModal(item)} style={[styles.cardActionBtn, { marginRight: 10 }]} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="pencil-outline" size={19} color={TOKENS.accent} />
                  </TouchableOpacity>
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
            {/* Top Navigation Header Row */}
            <View style={styles.newHeaderRow}>
              {/* Close Button */}
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.iconCircleBtn} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={20} color={TOKENS.textPrimary} />
              </TouchableOpacity>

              {/* Tappable Time Display Badge (Top Left) */}
              <TouchableOpacity
                style={[styles.timeBadgePill, showTimeWheel && styles.timeBadgePillActive]}
                onPress={() => setShowTimeWheel(!showTimeWheel)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="clock-outline" size={16} color={showTimeWheel ? TOKENS.bg : TOKENS.accent} />
                <Text style={[styles.timeBadgeText, showTimeWheel && styles.timeBadgeTextActive]}>
                  {wheelHour}:{wheelMinute} {wheelPeriod}
                </Text>
              </TouchableOpacity>

              {/* Name Input in Center */}
              <View style={styles.nameInputWrapper}>
                <TextInput
                  style={styles.headerNameInput}
                  value={scheduleName}
                  onChangeText={setScheduleName}
                  placeholder="NAME"
                  placeholderTextColor="#6B7280"
                  maxLength={22}
                />
              </View>

              {/* Room Selector Button (Top Right) */}
              <TouchableOpacity
                style={[styles.roomPill, showRoomPicker && styles.roomPillActive]}
                onPress={() => setShowRoomPicker(!showRoomPicker)}
                activeOpacity={0.8}
              >
                <Text style={[styles.roomPillText, showRoomPicker && styles.roomPillTextActive]} numberOfLines={1}>
                  {selectedRoomId === 'ALL' ? 'Room' : (rooms.find(r => r.id === selectedRoomId)?.name || 'Room')}
                </Text>
                <MaterialCommunityIcons
                  name={showRoomPicker ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={showRoomPicker ? TOKENS.bg : TOKENS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Room Dropdown Selection Menu */}
            {showRoomPicker && (
              <View style={styles.roomPickerContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomChipsScroll}>
                  <TouchableOpacity
                    style={[styles.roomChipItem, selectedRoomId === 'ALL' && styles.roomChipItemActive]}
                    onPress={() => { setSelectedRoomId('ALL'); setShowRoomPicker(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.roomChipText, selectedRoomId === 'ALL' && styles.roomChipTextActive]}>All Rooms</Text>
                  </TouchableOpacity>
                  {rooms.map(room => (
                    <TouchableOpacity
                      key={room.id}
                      style={[styles.roomChipItem, selectedRoomId === room.id && styles.roomChipItemActive]}
                      onPress={() => { setSelectedRoomId(room.id); setShowRoomPicker(false); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.roomChipText, selectedRoomId === room.id && styles.roomChipTextActive]}>{room.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Collapsible Time Wheel Picker */}
            {showTimeWheel && (
              <View style={styles.inlineWheelWrapper}>
                <View style={styles.wheelHeaderLabelsRow}>
                  <Text style={[styles.wheelColTitleHeader, { flex: 1 }]}>HOUR</Text>
                  <Text style={[styles.wheelColTitleHeader, { flex: 1 }]}>MIN</Text>
                  <Text style={[styles.wheelColTitleHeader, { flex: 0.9 }]}>AM/PM</Text>
                </View>

                <View style={styles.wheelColumnsContainer}>
                  <View style={styles.wheelSelectionHighlight} pointerEvents="none" />
                  <WheelColumn
                    data={HOURS_LIST.map(h => ({ label: h, value: h }))}
                    selectedValue={wheelHour}
                    onValueChange={(val) => updateTimeFromWheel(val, wheelMinute, wheelPeriod)}
                    flex={1}
                    isLooping={true}
                  />
                  <Text style={styles.wheelColon}>:</Text>
                  <WheelColumn
                    data={MINUTES_LIST.map(m => ({ label: m, value: m }))}
                    selectedValue={wheelMinute}
                    onValueChange={(val) => updateTimeFromWheel(wheelHour, val, wheelPeriod)}
                    flex={1}
                    isLooping={true}
                  />
                  <WheelColumn
                    data={[{ label: 'AM', value: 'AM' }, { label: 'PM', value: 'PM' }]}
                    selectedValue={wheelPeriod}
                    onValueChange={(val) => updateTimeFromWheel(wheelHour, wheelMinute, val)}
                    flex={0.9}
                    isLooping={false}
                  />
                </View>
              </View>
            )}

            {/* Action Segment (Turn ON vs Turn OFF) */}
            <View style={styles.actionSegmentRow}>
              <TouchableOpacity
                style={[styles.actionSegmentBtn, selectedAction === 'ON' && styles.actionSegmentBtnOn]}
                onPress={() => setSelectedAction('ON')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="power" size={16} color={selectedAction === 'ON' ? TOKENS.bg : TOKENS.accent} />
                <Text style={[styles.actionSegmentText, selectedAction === 'ON' && styles.actionSegmentTextOn]}>TURN ON</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionSegmentBtn, selectedAction === 'OFF' && styles.actionSegmentBtnOff]}
                onPress={() => setSelectedAction('OFF')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="power-off" size={16} color={selectedAction === 'OFF' ? '#FFF' : TOKENS.error} />
                <Text style={[styles.actionSegmentText, selectedAction === 'OFF' && styles.actionSegmentTextOff]}>TURN OFF</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Middle Appliances Grid (Visual Selection) */}
              <View style={styles.appliancesGridSection}>
                <View style={styles.gridHeaderRow}>
                  <Text style={styles.gridTitle}>APPLIANCES</Text>
                  <Text style={styles.gridSubtitle}>{selectedDeviceIds.length} Selected</Text>
                </View>

                {filteredDevices.length === 0 ? (
                  <View style={styles.emptyGridState}>
                    <Text style={styles.emptyGridText}>No appliances found in this room.</Text>
                  </View>
                ) : (
                  <View style={styles.gridContainer}>
                    {filteredDevices.map(dev => {
                      const isSelected = selectedDeviceIds.includes(dev.id);
                      const devIcon = dev.type === 'fan' ? 'fan' : dev.type === 'light' ? 'lightbulb-outline' : 'power';

                      return (
                        <TouchableOpacity
                          key={dev.id}
                          style={[styles.applianceCard, isSelected && styles.applianceCardSelected]}
                          onPress={() => toggleDeviceSelection(dev.id)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.circleIconContainer, isSelected && styles.circleIconContainerSelected]}>
                            <MaterialCommunityIcons
                              name={isSelected ? 'check' : devIcon}
                              size={28}
                              color={isSelected ? TOKENS.bg : TOKENS.accent}
                            />
                          </View>
                          <Text style={[styles.applianceCardText, isSelected && styles.applianceCardTextSelected]} numberOfLines={1}>
                            {dev.name}
                          </Text>
                          {selectedRoomId === 'ALL' && dev.room_id && (
                            <Text style={styles.applianceCardSubtext} numberOfLines={1}>
                              {rooms.find(r => r.id === dev.room_id)?.name}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Bottom Days Selector */}
              <View style={styles.daysSelectorSection}>
                <Text style={styles.daysSectionTitle}>REPEAT DAYS</Text>
                <View style={styles.daysRowContainer}>
                  {DAY_BUTTONS.map(dayItem => {
                    const isSelected = selectedDays.includes(dayItem.key);
                    return (
                      <TouchableOpacity
                        key={dayItem.key}
                        style={[styles.dayCircleBtn, isSelected && styles.dayCircleBtnSelected]}
                        onPress={() => toggleDaySelection(dayItem.key)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.dayCircleText, isSelected && styles.dayCircleTextSelected]}>
                          {dayItem.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Full Width Prominent Create/Edit Schedule Button */}
              <TouchableOpacity
                style={[styles.createRuleBtn, (isSaving || selectedDeviceIds.length === 0) && styles.createRuleBtnDisabled]}
                onPress={handleSaveSchedule}
                disabled={isSaving || selectedDeviceIds.length === 0}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={TOKENS.bg} />
                ) : (
                  <Text style={styles.createRuleBtnText}>
                    {editingScheduleId ? 'Save Changes' : 'Create Schedule'}
                  </Text>
                )}
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#1C1B1B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)'
  },
  newHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  timeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  timeBadgePillActive: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent
  },
  timeBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: TOKENS.textPrimary
  },
  timeBadgeTextActive: {
    color: TOKENS.bg
  },
  nameInputWrapper: {
    flex: 1,
    marginHorizontal: 4
  },
  headerNameInput: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.textPrimary,
    textAlign: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  roomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxWidth: 90
  },
  roomPillActive: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent
  },
  roomPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.textPrimary
  },
  roomPillTextActive: {
    color: TOKENS.bg
  },
  roomPickerContainer: {
    marginBottom: 12,
    backgroundColor: '#161618',
    borderRadius: 14,
    padding: 8
  },
  roomChipsScroll: {
    gap: 8,
    paddingHorizontal: 4
  },
  roomChipItem: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#242426',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  roomChipItemActive: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent
  },
  roomChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.textSecondary
  },
  roomChipTextActive: {
    color: TOKENS.bg,
    fontWeight: '800'
  },
  inlineWheelWrapper: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    marginBottom: 16
  },
  actionSegmentRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  actionSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  actionSegmentBtnOn: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent
  },
  actionSegmentBtnOff: {
    backgroundColor: TOKENS.error,
    borderColor: TOKENS.error
  },
  actionSegmentText: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.textPrimary
  },
  actionSegmentTextOn: {
    color: TOKENS.bg
  },
  actionSegmentTextOff: {
    color: '#FFF'
  },
  appliancesGridSection: {
    marginTop: 4,
    marginBottom: 16
  },
  gridHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.textSecondary,
    letterSpacing: 0.8
  },
  gridSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: TOKENS.accent
  },
  emptyGridState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161618',
    borderRadius: 16
  },
  emptyGridText: {
    fontSize: 13,
    color: TOKENS.textSecondary
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12
  },
  applianceCard: {
    width: '48%',
    backgroundColor: '#1c1c1e',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  applianceCardSelected: {
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    borderColor: TOKENS.accent
  },
  circleIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2a2a2c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  circleIconContainerSelected: {
    backgroundColor: TOKENS.accent
  },
  applianceCardText: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.textPrimary,
    textAlign: 'center'
  },
  applianceCardTextSelected: {
    color: TOKENS.accent
  },
  applianceCardSubtext: {
    fontSize: 10,
    color: TOKENS.textSecondary,
    marginTop: 2
  },
  daysSelectorSection: {
    marginBottom: 20
  },
  daysSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10
  },
  daysRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dayCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  dayCircleBtnSelected: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent
  },
  dayCircleText: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.textSecondary
  },
  dayCircleTextSelected: {
    color: TOKENS.bg,
    fontWeight: '900'
  },
  createRuleBtn: {
    backgroundColor: TOKENS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TOKENS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4
  },
  createRuleBtnDisabled: {
    opacity: 0.5
  },
  createRuleBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: TOKENS.bg,
    letterSpacing: 0.5
  },
  wheelHeaderLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    marginBottom: 4
  },
  wheelColTitleHeader: {
    fontSize: 9,
    fontWeight: '800',
    color: TOKENS.textSecondary,
    letterSpacing: 0.8,
    textAlign: 'center'
  },
  wheelColumnsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 150,
    width: '100%',
    paddingHorizontal: 10,
    position: 'relative',
    overflow: 'hidden'
  },
  wheelSelectionHighlight: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 53,
    height: 44,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 230, 118, 0.4)'
  },
  wheelColon: {
    fontSize: 20,
    fontWeight: '900',
    color: TOKENS.accent,
    alignSelf: 'center'
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
