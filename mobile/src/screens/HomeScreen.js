import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, RefreshControl } from 'react-native';
import { Text, FAB, useTheme, ActivityIndicator, IconButton, Portal, Dialog, Button } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import DeviceCard from '../components/DeviceCard';

export default function HomeScreen({ navigation }) {
  const theme = useTheme();
  const { signOut } = useAuth();
  
  const [devices, setDevices] = useState([]);
  const [username, setUsername] = useState('User');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dialog state for device deletion
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState(null);

  // Fetch authenticated user profile
  const fetchUserProfile = async () => {
    try {
      const response = await apiClient.get('/api/users/me');
      if (response.data && response.data.username) {
        // Capitalize username
        const name = response.data.username;
        setUsername(name.charAt(0).toUpperCase() + name.slice(1));
      }
    } catch (error) {
      console.error('[Home] Error fetching user profile:', error);
    }
  };

  // Fetch device list from backend
  const fetchDevices = async (showLoadingIndicator = false) => {
    if (showLoadingIndicator) setLoading(true);
    try {
      const response = await apiClient.get('/api/devices');
      setDevices(response.data);
    } catch (error) {
      console.error('[Home] Error fetching devices:', error);
    } finally {
      if (showLoadingIndicator) setLoading(false);
      setRefreshing(false);
    }
  };

  // Setup polling and initial fetch when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
      fetchDevices(devices.length === 0);
      
      const intervalId = setInterval(() => {
        fetchDevices(false);
      }, 5000);

      return () => {
        clearInterval(intervalId);
      };
    }, [])
  );

  // Pull-to-refresh handler
  const handleRefresh = () => {
    setRefreshing(true);
    fetchDevices(false);
  };

  // Toggle device state
  const handleToggleDevice = async (id, currentVal) => {
    const targetDev = devices.find((d) => d.id === id);
    if (targetDev && targetDev.is_online === false) {
      alert(`"${targetDev.name || 'Switch'}" is offline. Please check hardware power and Wi-Fi.`);
      return;
    }
    const targetState = currentVal ? 'ON' : 'OFF';

    // Optimistic UI state update (handling both old status field and new current_state schema)
    setDevices((prevDevices) =>
      prevDevices.map((d) => {
        if (d.id === id) {
          return { 
            ...d, 
            status: currentVal,
            current_state: {
              ...d.current_state,
              status: targetState
            }
          };
        }
        return d;
      })
    );

    try {
      await apiClient.post(`/api/devices/${id}/control`, {
        state: { status: targetState },
      });
      fetchDevices(false);
    } catch (error) {
      console.error('[Home] Error controlling device:', error);
      // Revert local state on failure
      setDevices((prevDevices) =>
        prevDevices.map((d) => {
          if (d.id === id) {
            return {
              ...d,
              status: !currentVal,
              current_state: {
                ...d.current_state,
                status: !currentVal ? 'ON' : 'OFF'
              }
            };
          }
          return d;
        })
      );
    }
  };

  // Confirm delete dialog handlers
  const showDeleteDialog = (id) => {
    setDeviceToDelete(id);
    setDeleteDialogVisible(true);
  };

  const hideDeleteDialog = () => {
    setDeviceToDelete(null);
    setDeleteDialogVisible(false);
  };

  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return;
    try {
      await apiClient.delete(`/api/devices/${deviceToDelete}`);
      setDevices((prevDevices) => prevDevices.filter((d) => d.id !== deviceToDelete));
      hideDeleteDialog();
    } catch (error) {
      console.error('[Home] Error deleting device:', error);
    }
  };

  // Header options: add logout button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="power"
          iconColor={theme.colors.secondary}
          size={24}
          onPress={signOut}
        />
      ),
    });
  }, [navigation, theme, signOut]);

  // List Header Component to render greeting and control description
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.greetingText}>Hi {username},</Text>
      <Text style={styles.subtitleText}>Control center is online.</Text>
    </View>
  );

  if (loading) {
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
          {renderHeader()}
          <View style={styles.emptyContent}>
            <MaterialCommunityIcons name="radar" size={90} color="rgba(34, 197, 94, 0.2)" />
            <Text style={styles.emptyTitle}>Grid Offline</Text>
            <Text style={styles.emptySubtitle}>
              No devices linked to this smart node. Create one to initialize the grid.
            </Text>
            <Button 
              mode="contained" 
              onPress={() => navigation.navigate('AddDevice')}
              style={styles.addFirstBtn}
              contentStyle={{ paddingVertical: 4 }}
              icon="plus"
            >
              Link Device
            </Button>
          </View>
        </View>
      ) : (
        // 2x2 Device Grid List
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <DeviceCard
              device={item}
              onToggle={handleToggleDevice}
              onDelete={showDeleteDialog}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}

      {/* Floating Action Button (FAB) */}
      <FAB
        icon="plus"
        label="Link Node"
        color="#000000"
        style={[
          styles.fab,
          { 
            backgroundColor: theme.colors.primary,
            elevation: 4,
          }
        ]}
        onPress={() => navigation.navigate('AddDevice')}
      />

      {/* Cyberpunk Dialog for Delete Confirmation */}
      <Portal>
        <Dialog visible={!!deleteDialogVisible} onDismiss={hideDeleteDialog} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Terminate Node Link?</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogBody}>This will disconnect the hardware node from your smart net. Logs and local database entries will be erased.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideDeleteDialog} labelStyle={{ color: '#94A3B8', fontWeight: 'bold' }}>Abort</Button>
            <Button onPress={handleDeleteDevice} labelStyle={{ color: theme.colors.secondary, fontWeight: 'bold' }}>Disconnect</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  greetingText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  listContainer: {
    paddingBottom: 120, // space to float past the bottom pill bar and FAB
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 8,
    bottom: 104, // sits cleanly above the floating tab bar
    borderRadius: 28,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  addFirstBtn: {
    marginTop: 32,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  dialog: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#262626',
  },
  dialogTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dialogBody: {
    color: '#9CA3AF',
    lineHeight: 22,
  },
});
