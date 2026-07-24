import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { Text, TextInput, Button, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';

const TOKENS = {
  bg: '#0E0E0E',
  surface: '#1C1B1B',
  surfaceLow: '#141414',
  accent: '#22C55E',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#E5E2E1',
  textSecondary: '#9CA3AF',
  error: '#EF4444'
};

const STATIC_SUFFIXES = ['1', '2', '3', '4', '5', '6', '7'];

const getChannelDefaultLabel = (suffix) => {
  if (suffix === '5') return 'Fan';
  if (suffix === '6') return 'LED Strip';
  if (suffix === '7') return 'Master Switch';
  return `Switch ${suffix}`;
};

const getChannelDefaultType = (suffix) => {
  if (suffix === '5') return 'fan';
  if (suffix === '7') return 'outlet';
  return 'light'; // 1, 2, 3, 4, 6
};

export default function ConfigureBoardScreen({ route, navigation }) {
  const { macAddress, roomId } = route.params || {};
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deviceSlots, setDeviceSlots] = useState([]);
  const [fallbackRoomId, setFallbackRoomId] = useState(roomId || null);

  // Fetch all channels corresponding to this board from the backend on load
  const loadConfiguration = async () => {
    try {
      setIsLoading(true);
      // Retrieve fallback room ID if not passed in navigation params
      let activeRoomId = fallbackRoomId;
      if (!activeRoomId) {
        const homesRes = await apiClient.get('/api/homes');
        if (homesRes.data && homesRes.data.length > 0) {
          const roomsRes = await apiClient.get(`/api/rooms/home/${homesRes.data[0].id}`);
          if (roomsRes.data && roomsRes.data.length > 0) {
            activeRoomId = roomsRes.data[0].id;
            setFallbackRoomId(activeRoomId);
          }
        }
      }

      const response = await apiClient.get('/api/devices');
      const allDevices = response.data;
      if (Array.isArray(allDevices)) {
        const targetMac = macAddress ? macAddress.trim().toUpperCase() : '';
        const matching = allDevices.filter(d => 
          d.mac_address && d.mac_address.toUpperCase() === targetMac
        );

        // Map matching devices to their respective suffixes
        const slots = STATIC_SUFFIXES.map(suffix => {
          const device = matching.find(d => {
            const parts = d.node_id.split('_');
            return parts[parts.length - 1] === suffix;
          });

          if (device) {
            return {
              suffix,
              isActive: true,
              id: device.id,
              node_id: device.node_id,
              name: device.name,
              type: device.device_type,
              status: device.current_state?.status === 'ON'
            };
          } else {
            return {
              suffix,
              isActive: false,
              id: null,
              node_id: `${targetMac}_${suffix}`,
              name: getChannelDefaultLabel(suffix),
              type: getChannelDefaultType(suffix),
              status: false
            };
          }
        });

        setDeviceSlots(slots);
      }
    } catch (err) {
      console.error('[ConfigureBoard] Fetch failed:', err);
      Alert.alert('Error', 'Failed to retrieve channels from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfiguration();
  }, [macAddress]);

  // Activate / Provision a deleted channel on demand
  const handleActivateSwitch = async (index) => {
    const slot = deviceSlots[index];
    const targetRoom = roomId || fallbackRoomId;
    if (!targetRoom) {
      Alert.alert('Error', 'No destination room available to register the switch.');
      return;
    }

    try {
      setIsLoading(true);
      await apiClient.post('/api/devices/provision-single', {
        mac_address: macAddress.trim().toUpperCase(),
        suffix: slot.suffix,
        room_id: targetRoom,
        device_type: slot.type
      });
      await loadConfiguration();
    } catch (err) {
      console.error('[ConfigureBoard] Activation failed:', err);
      Alert.alert('Activation Failed', 'Could not activate this switch. Check connection.');
      setIsLoading(false);
    }
  };

  // Deactivate / Delete an active channel from DB
  const handleDeactivateSwitch = async (index) => {
    const slot = deviceSlots[index];
    Alert.alert(
      'Remove Switch?',
      `Are you sure you want to hide and remove "${slot.name}" from your room dashboard?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await apiClient.delete(`/api/devices/${slot.id}`);
              await loadConfiguration();
            } catch (err) {
              console.error('[ConfigureBoard] Deletion failed:', err);
              Alert.alert('Deletion Failed', 'Could not delete the switch.');
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Test switch toggle in real-time
  const handleTestToggle = async (index) => {
    const updatedSlots = [...deviceSlots];
    const slot = updatedSlots[index];
    const newStatus = !slot.status;

    // Optimistic UI update
    slot.status = newStatus;
    setDeviceSlots(updatedSlots);

    try {
      await apiClient.post(`/api/devices/${slot.id}/control`, {
        state: { status: newStatus ? 'ON' : 'OFF' }
      });
    } catch (err) {
      console.warn('[ConfigureBoard] Test toggle failed:', err);
      // Revert status on failure
      slot.status = !newStatus;
      setDeviceSlots([...updatedSlots]);
      Alert.alert('Testing Failed', 'Check if the board is powered on and connected.');
    }
  };

  // Handle local state edits for active switches
  const handleNameChange = (index, value) => {
    const updated = [...deviceSlots];
    updated[index].name = value;
    setDeviceSlots(updated);
  };

  const handleTypeChange = (index, value) => {
    const updated = [...deviceSlots];
    updated[index].type = value;
    setDeviceSlots(updated);
  };

  // Submit edits for all active channels to backend
  const handleSaveAndComplete = async () => {
    setIsSaving(true);
    try {
      const activeSlots = deviceSlots.filter(s => s.isActive);
      const updatePromises = activeSlots.map(s => 
        apiClient.put(`/api/devices/${s.id}`, {
          name: s.name.trim(),
          device_type: s.type
        })
      );
      await Promise.all(updatePromises);
      
      Alert.alert(
        'Setup Complete',
        'Your switch board configuration has been saved!',
        [
          { 
            text: 'Go to Dashboard', 
            onPress: () => navigation.navigate('DevicesHome') 
          }
        ]
      );
    } catch (err) {
      console.error('[ConfigureBoard] Save edits failed:', err);
      Alert.alert('Saving Failed', 'Some switches could not be updated. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={TOKENS.accent} />
        <Text style={styles.loadingText}>Syncing board configuration...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor={TOKENS.bg} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Switchboard Terminals</Text>
          <Text style={styles.subtitle}>
            Toggle switches to identify appliances, rename active switches, or hide unused channels.
          </Text>
        </View>

        {deviceSlots.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No channels found for this board.</Text>
            <Button mode="contained" onPress={() => navigation.navigate('DevicesHome')} style={styles.completeButton}>
              Go Home
            </Button>
          </View>
        ) : (
          <>
            {deviceSlots.map((device, idx) => (
              <View key={device.suffix} style={[styles.card, !device.isActive && styles.cardInactive]}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons 
                      name={device.type === 'fan' ? 'fan' : (device.type === 'light' ? 'lightbulb' : 'power-plug')} 
                      size={20} 
                      color={device.isActive ? (device.status ? TOKENS.accent : TOKENS.textSecondary) : '#555555'} 
                    />
                    <Text style={[styles.channelLabel, !device.isActive && styles.channelLabelInactive]}>
                      Channel {device.suffix} {!device.isActive ? '(Inactive)' : ''}
                    </Text>
                  </View>
                  
                  {device.isActive ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {/* Test Trigger */}
                      <TouchableOpacity 
                        style={[styles.testButton, device.status && styles.testButtonActive]} 
                        onPress={() => handleTestToggle(idx)}
                      >
                        <MaterialCommunityIcons 
                          name="power" 
                          size={14} 
                          color={device.status ? '#000000' : TOKENS.accent} 
                        />
                        <Text style={[styles.testButtonText, device.status && styles.testButtonTextActive]}>
                          {device.status ? 'ON' : 'Test'}
                        </Text>
                      </TouchableOpacity>

                      {/* Deactivate Trigger */}
                      <TouchableOpacity 
                        style={styles.deleteButton} 
                        onPress={() => handleDeactivateSwitch(idx)}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color={TOKENS.error} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* Activate Trigger */
                    <TouchableOpacity 
                      style={styles.activateButton} 
                      onPress={() => handleActivateSwitch(idx)}
                    >
                      <MaterialCommunityIcons name="plus" size={14} color="#000000" />
                      <Text style={styles.activateButtonText}>Activate</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Edit Form (Only shown if active) */}
                {device.isActive && (
                  <View style={styles.form}>
                    <Text style={styles.label}>Switch Name</Text>
                    <TextInput
                      value={device.name}
                      onChangeText={(val) => handleNameChange(idx, val)}
                      mode="outlined"
                      textColor="#FFFFFF"
                      theme={{ colors: { primary: TOKENS.accent, background: TOKENS.surfaceLow } }}
                      style={styles.input}
                      placeholder={`e.g. Switch ${device.suffix}`}
                      placeholderTextColor={TOKENS.textSecondary}
                    />

                    {/* Device Type Select */}
                    <Text style={[styles.label, { marginTop: 8 }]}>Device Type</Text>
                    <SegmentedButtons
                      value={device.type}
                      onValueChange={(val) => handleTypeChange(idx, val)}
                      theme={{
                        colors: {
                          secondaryContainer: TOKENS.accent,
                          onSecondaryContainer: '#000000',
                          outline: TOKENS.border
                        }
                      }}
                      buttons={[
                        {
                          value: 'light',
                          label: 'Light',
                          showSelectedCheck: true,
                          style: device.type === 'light' ? styles.segmentedActive : styles.segmentedInactive,
                          labelStyle: device.type === 'light' ? styles.labelActive : styles.labelInactive
                        },
                        {
                          value: 'fan',
                          label: 'Fan',
                          showSelectedCheck: true,
                          style: device.type === 'fan' ? styles.segmentedActive : styles.segmentedInactive,
                          labelStyle: device.type === 'fan' ? styles.labelActive : styles.labelInactive
                        },
                        {
                          value: 'outlet',
                          label: 'Outlet',
                          showSelectedCheck: true,
                          style: device.type === 'outlet' ? styles.segmentedActive : styles.segmentedInactive,
                          labelStyle: device.type === 'outlet' ? styles.labelActive : styles.labelInactive
                        }
                      ]}
                    />
                  </View>
                )}
              </View>
            ))}

            {/* Complete Setup */}
            <TouchableOpacity 
              style={[styles.completeButton, isSaving && styles.completeButtonDisabled]}
              onPress={handleSaveAndComplete}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.completeButtonText}>Save Configurations</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 50
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: TOKENS.textSecondary,
    fontSize: 14,
    marginTop: 12
  },
  header: {
    marginBottom: 20
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  subtitle: {
    color: TOKENS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyText: {
    color: TOKENS.textSecondary,
    marginBottom: 16
  },
  card: {
    backgroundColor: TOKENS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    marginBottom: 16
  },
  cardInactive: {
    backgroundColor: '#0F0F0F',
    borderColor: 'rgba(255,255,255,0.03)'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 2
  },
  channelLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  channelLabelInactive: {
    color: '#555555',
    fontWeight: '500'
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: TOKENS.accent,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8
  },
  testButtonActive: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent
  },
  testButtonText: {
    color: TOKENS.accent,
    fontSize: 11,
    fontWeight: 'bold'
  },
  testButtonTextActive: {
    color: '#000000'
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 6,
    padding: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.05)'
  },
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TOKENS.accent,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  activateButtonText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900'
  },
  form: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    paddingTop: 10,
    gap: 6
  },
  label: {
    color: TOKENS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  input: {
    height: 44,
    fontSize: 14,
    backgroundColor: TOKENS.surfaceLow
  },
  segmentedActive: {
    backgroundColor: TOKENS.accent
  },
  segmentedInactive: {
    backgroundColor: TOKENS.surfaceLow
  },
  labelActive: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold'
  },
  labelInactive: {
    color: '#FFFFFF',
    fontSize: 12
  },
  completeButton: {
    backgroundColor: TOKENS.accent,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12
  },
  completeButtonDisabled: {
    opacity: 0.6
  },
  completeButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5
  }
});
