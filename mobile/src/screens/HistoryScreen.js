import React, { useState, useCallback } from 'react';
import { StyleSheet, View, FlatList, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator, useTheme, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';

export default function HistoryScreen() {
  const theme = useTheme();
  
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [history, setHistory] = useState([]);
  
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch user devices list
  const fetchDevices = async () => {
    try {
      const response = await apiClient.get('/api/devices');
      const data = response.data;
      setDevices(data);
      
      // Auto-select the first device if none is selected
      if (data.length > 0) {
        if (!selectedDevice || !data.some(d => d.id === selectedDevice.id)) {
          setSelectedDevice(data[0]);
          fetchDeviceHistory(data[0].id);
        } else {
          // Refresh history of currently selected device
          fetchDeviceHistory(selectedDevice.id);
        }
      } else {
        setSelectedDevice(null);
        setHistory([]);
      }
    } catch (error) {
      console.error('[History] Error fetching devices:', error);
    } finally {
      setLoadingDevices(false);
      setRefreshing(false);
    }
  };

  // Fetch history for a specific device
  const fetchDeviceHistory = async (deviceId) => {
    setLoadingHistory(true);
    try {
      const response = await apiClient.get(`/api/devices/${deviceId}/history`);
      setHistory(response.data);
    } catch (error) {
      console.error('[History] Error fetching device history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Refresh handler
  const handleRefresh = () => {
    setRefreshing(true);
    fetchDevices();
  };

  // Device selection change handler
  const handleSelectDevice = (device) => {
    setSelectedDevice(device);
    fetchDeviceHistory(device.id);
  };

  // Trigger loading when tab is focused
  useFocusEffect(
    useCallback(() => {
      fetchDevices();
    }, [selectedDevice])
  );

  // Helper to get styled attributes based on log event type
  const getLogStyle = (changeType) => {
    switch (changeType) {
      case 'device_created':
        return {
          label: 'Device added',
          icon: 'plus-circle-outline',
          color: '#22C55E', // green
        };
      case 'command_sent':
        return {
          label: 'Command Sent',
          icon: 'radiobox-marked',
          color: '#9CA3AF', // gray
        };
      case 'status_confirmed':
        return {
          label: 'Sync Confirmed',
          icon: 'checkbox-marked-circle-outline',
          color: '#22C55E', // green
        };
      default:
        return {
          label: 'Telemetry Update',
          icon: 'server-network',
          color: '#9CA3AF',
        };
    }
  };

  // Helper to format timestamps nicely
  const formatTimestamp = (dateStr) => {
    try {
      const d = new Date(dateStr);
      const pad = (num) => String(num).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Helper to extract status from either a string or JSONB state object
  const getStatusString = (state) => {
    if (!state) return 'OFF';
    if (typeof state === 'string') return state;
    if (typeof state === 'object') {
      return state.status || 'OFF';
    }
    return 'OFF';
  };

  if (loadingDevices && devices.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {devices.length === 0 ? (
        // Empty State
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="clipboard-alert-outline" size={80} color="rgba(34, 197, 94, 0.15)" />
          <Text style={styles.emptyTitle}>Telemetry Offline</Text>
          <Text style={styles.emptySubtitle}>
            No devices are currently connected. Logs will generate once node triggers execute.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Header Horizontal Device Filter */}
          <View style={styles.headerSelection}>
            <Text style={styles.selectionLabel}>Select Device</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={devices}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.deviceSlider}
              renderItem={({ item }) => {
                const isSelected = !!(selectedDevice && selectedDevice.id === item.id);
                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleSelectDevice(item)}
                    style={[
                      styles.deviceChip,
                      {
                        backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.08)' : '#1A1A1A',
                        borderColor: isSelected ? '#22C55E' : '#262626',
                      }
                    ]}
                  >
                    <Text style={[styles.chipText, { color: isSelected ? '#22C55E' : '#FFFFFF', fontWeight: isSelected ? '700' : '600' }]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* History Event Timeline */}
          {loadingHistory ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#22C55E" />
              <Text style={{ color: '#9CA3AF', marginTop: 12, fontSize: 13 }}>Retrieving logs...</Text>
            </View>
          ) : history.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="timeline-alert-outline" size={60} color="rgba(156, 163, 175, 0.2)" />
              <Text style={styles.emptyTitle}>No Timeline Events</Text>
              <Text style={styles.emptySubtitle}>
                No commands have been transmitted to {selectedDevice?.name || 'this appliance'} yet.
              </Text>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.timelineList}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={theme.colors.primary}
                />
              }
              renderItem={({ item, index }) => {
                const logStyle = getLogStyle(item.change_type);
                const prevStateStr = getStatusString(item.previous_state);
                const newStateStr = getStatusString(item.new_state);
                return (
                  <View style={styles.timelineItem}>
                    {/* Left Timeline Indicator */}
                    <View style={styles.timelineLeft}>
                      <MaterialCommunityIcons name={logStyle.icon} size={26} color={logStyle.color} />
                      {index < history.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    
                    {/* Right Timeline Card Details */}
                    <Card style={styles.timelineCard}>
                      <Card.Content style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                          <Text style={[styles.eventLabel, { color: logStyle.color }]}>
                            {logStyle.label}
                          </Text>
                          <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
                        </View>
                        
                        {item.change_type === 'device_created' && (
                          <Text style={styles.eventDesc}>Device added. Default state: <Text style={styles.offStateText}>OFF</Text></Text>
                        )}

                        {item.change_type === 'command_sent' && (
                          <Text style={styles.eventDesc}>
                            {selectedDevice?.name || 'Device'} turned <Text style={newStateStr === 'ON' ? styles.onStateText : styles.offStateText}>{newStateStr}</Text>
                          </Text>
                        )}

                        {item.change_type === 'status_confirmed' && (
                          <Text style={styles.eventDesc}>
                            State confirmed: <Text style={newStateStr === 'ON' ? styles.onStateText : styles.offStateText}>{newStateStr}</Text>
                          </Text>
                        )}
                      </Card.Content>
                    </Card>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E0E0E',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0E0E0E',
  },
  headerSelection: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: '#262626',
  },
  selectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    marginLeft: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deviceSlider: {
    paddingHorizontal: 12,
  },
  deviceChip: {
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#262626',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  timelineList: {
    padding: 16,
    paddingBottom: 120,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 14,
    width: 26,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#262626',
    marginTop: 4,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#262626',
    marginBottom: 12,
    elevation: 0,
  },
  cardContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timestamp: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  eventDesc: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
    fontWeight: '500',
  },
  onStateText: {
    color: '#22C55E',
    fontWeight: '700',
  },
  offStateText: {
    color: '#9CA3AF',
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
