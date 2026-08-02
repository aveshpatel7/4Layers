import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
  StatusBar
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/client';

const TOKENS = {
  bg: '#0E0E0E',
  surface: '#1C1B1B',
  accent: '#22C55E',
  border: 'rgba(255, 255, 255, 0.05)',
  textPrimary: '#E5E2E1',
  textSecondary: '#9CA3AF',
  error: '#EF4444'
};

const ROOM_TYPES = [
  { id: 'living_room', label: 'Living Room', icon: 'sofa' },
  { id: 'kitchen', label: 'Kitchen', icon: 'chef-hat' },
  { id: 'bedroom', label: 'Bedroom', icon: 'bed' },
  { id: 'office', label: 'Office/Study', icon: 'laptop' },
  { id: 'bathroom', label: 'Bathroom', icon: 'shower' }
];

export default function RoomsScreen({ navigation: navProp }) {
  const nav = useNavigation();
  const navigation = navProp || nav;

  const [rooms, setRooms] = useState([]);
  const [homeId, setHomeId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Add Room Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedType, setSelectedType] = useState('living_room');
  const [isSaving, setIsSaving] = useState(false);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const showLoading = !hasLoadedRef.current;
    initializeData(showLoading);
    hasLoadedRef.current = true;

    const unsubscribe = navigation?.addListener ? navigation.addListener('focus', () => {
      initializeData(false);
    }) : () => {};

    return unsubscribe;
  }, [navigation]);

  const initializeData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      // 1. Fetch homes to set homeId for creating new rooms
      const homesRes = await apiClient.get('/api/homes');
      if (homesRes.data && homesRes.data.length > 0) {
        setHomeId(homesRes.data[0].id);
      }
      // 2. Fetch all accessible rooms (owned + shared)
      await fetchRooms();
    } catch (error) {
      console.error('Failed to initialize rooms manager:', error);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await apiClient.get('/api/rooms');
      setRooms(response.data || []);
    } catch (error) {
      console.error('Failed to fetch rooms list:', error);
    }
  };

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) {
      Alert.alert('Validation Error', 'Room name cannot be empty');
      return;
    }

    try {
      setIsSaving(true);
      await apiClient.post('/api/rooms', {
        name: newRoomName.trim(),
        room_type: selectedType,
        home_id: homeId
      });
      
      setNewRoomName('');
      setSelectedType('living_room');
      setModalVisible(false);
      
      // Refresh list
      await fetchRooms(homeId);
      Alert.alert('Success', 'Room successfully created');
    } catch (error) {
      console.error('Failed to create room:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create room');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoom = (roomId, roomName) => {
    Alert.alert(
      'Remove Room',
      `Are you sure you want to delete "${roomName}"? All assigned devices will lose room grouping.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await apiClient.delete(`/api/rooms/${roomId}`);
              await fetchRooms(homeId);
              Alert.alert('Deleted', 'Room has been removed.');
            } catch (error) {
              console.error('Failed to delete room:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete room');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const getRoomIcon = (type) => {
    const found = ROOM_TYPES.find(r => r.id === type);
    return found ? found.icon : 'home-outline';
  };

  const getRoomLabel = (type) => {
    const found = ROOM_TYPES.find(r => r.id === type);
    return found ? found.label : 'Standard Room';
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
        <Text style={styles.title}>Manage Rooms</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <MaterialCommunityIcons name="plus" size={20} color={TOKENS.bg} />
          <Text style={styles.addButtonText}>Add Room</Text>
        </TouchableOpacity>
      </View>

      {rooms.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="home-group" size={64} color={TOKENS.textSecondary} />
          <Text style={styles.emptyText}>No custom rooms registered.</Text>
          <Text style={styles.emptySubtext}>Add rooms to organize your switchboards and smart nodes.</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={styles.roomCard}>
              <View style={styles.roomInfo}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons 
                    name={getRoomIcon(item.room_type)} 
                    size={22} 
                    color={TOKENS.accent} 
                  />
                </View>
                <View style={styles.textGroup}>
                  <Text style={styles.roomName}>{item.name}</Text>
                  <Text style={styles.roomType}>{getRoomLabel(item.room_type)}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => handleDeleteRoom(item.id, item.name)}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={TOKENS.error} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Add Room Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Room</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={TOKENS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.label}>Room Name</Text>
              <TextInput
                style={styles.input}
                value={newRoomName}
                onChangeText={setNewRoomName}
                placeholder="e.g. Master Bedroom, Hallway"
                placeholderTextColor={TOKENS.textSecondary}
              />



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
                  onPress={handleAddRoom}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={TOKENS.bg} />
                  ) : (
                    <Text style={styles.saveButtonText}>Create</Text>
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
    padding: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 16
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
    fontSize: 22,
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
  roomCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TOKENS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  roomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TOKENS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  textGroup: {
    justifyContent: 'center'
  },
  roomName: {
    fontSize: 16,
    fontWeight: '700',
    color: TOKENS.textPrimary
  },
  roomType: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    marginTop: 2
  },
  deleteButton: {
    padding: 8
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
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
    maxHeight: '80%',
    borderTopWidth: 1,
    borderTopColor: TOKENS.border
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
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
    marginTop: 12,
    fontWeight: '600'
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
    marginBottom: 20
  },
  typeCard: {
    width: '47%',
    backgroundColor: TOKENS.bg,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: TOKENS.border,
    gap: 6
  },
  typeCardSelected: {
    backgroundColor: TOKENS.accent,
    borderColor: TOKENS.accent
  },
  typeLabel: {
    fontSize: 12,
    color: TOKENS.textPrimary,
    fontWeight: '600'
  },
  typeLabelSelected: {
    color: TOKENS.bg,
    fontWeight: '700'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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
  }
});
