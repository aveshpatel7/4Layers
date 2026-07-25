import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';

const TOKENS = {
  bg: '#0E0E0E',           // Google Stitch background
  surface: '#1C1B1B',      // surface-container
  surfaceLow: '#141414',   // surface-container-low
  accent: '#22C55E',       // Primary green
  border: 'rgba(255,255,255,0.05)',
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

const getRoomIcon = (type) => {
  const found = ROOM_TYPES.find(r => r.id === type);
  return found ? found.icon : 'home-outline';
};

export default function RoomSelectionScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [homes, setHomes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeHomeId, setActiveHomeId] = useState(null);

  // Flow State: 'NEW' (manual create) or 'EXISTING' (choose existing)
  const [flowMode, setFlowMode] = useState('EXISTING'); 

  // New Room Creation Form States
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState('living_room');

  // Existing Room Selection State
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Toast / Feedback State
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const showToast = (msg) => {
    setSnackbarMessage(msg);
    setShowSnackbar(true);
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      setLoading(true);
      const homesRes = await apiClient.get('/api/homes');
      setHomes(homesRes.data);
      
      if (homesRes.data && homesRes.data.length > 0) {
        const homeId = homesRes.data[0].id;
        setActiveHomeId(homeId);
        
        const roomsRes = await apiClient.get(`/api/rooms/home/${homeId}`);
        setRooms(roomsRes.data);
        
        // If there are existing rooms, we can default to 'EXISTING' mode, or keep it to 'NEW'
        if (roomsRes.data && roomsRes.data.length > 0) {
          setFlowMode('EXISTING');
          setSelectedRoom(roomsRes.data[0]);
        } else {
          setFlowMode('NEW');
        }
      } else {
        // No home found, create one first
        const createHomeRes = await apiClient.post('/api/homes', { name: '4Layers SmartNest' });
        setActiveHomeId(createHomeRes.data.id);
        setRooms([]);
        setFlowMode('NEW');
      }
    } catch (err) {
      console.error('[RoomSelection] Error loading metadata:', err);
      showToast('Failed to load rooms. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (flowMode === 'NEW') {
      if (!newRoomName.trim()) {
        showToast('Please enter a valid room name.');
        return;
      }
      // Navigate to Provisioning with new room details
      navigation.navigate('Provisioning', {
        homeId: activeHomeId,
        roomId: null,
        newRoomName: newRoomName.trim(),
        newRoomType: newRoomType
      });
    } else {
      if (!selectedRoom) {
        showToast('Please select an existing room.');
        return;
      }
      // Navigate to Provisioning with selected room details
      navigation.navigate('Provisioning', {
        homeId: activeHomeId,
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        roomType: selectedRoom.room_type,
        newRoomName: null,
        newRoomType: null
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={TOKENS.accent} />
        <Text style={styles.loadingText}>Syncing Room Directory...</Text>
      </View>
    );
  }

  const handleRoomNameChange = (text) => {
    setNewRoomName(text);
    const lower = text.toLowerCase();
    if (lower.includes('office') || lower.includes('study') || lower.includes('work') || lower.includes('desk') || lower.includes('comp')) {
      setNewRoomType('office');
    } else if (lower.includes('bath') || lower.includes('wash') || lower.includes('toilet') || lower.includes('restroom') || lower.includes('shower')) {
      setNewRoomType('bathroom');
    } else if (lower.includes('bed') || lower.includes('sleep') || lower.includes('bedroom')) {
      setNewRoomType('bedroom');
    } else if (lower.includes('kitchen') || lower.includes('cook') || lower.includes('pantry') || lower.includes('food')) {
      setNewRoomType('kitchen');
    } else if (lower.includes('living') || lower.includes('hall') || lower.includes('tv') || lower.includes('drawing') || lower.includes('lounge')) {
      setNewRoomType('living_room');
    }
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.appHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={TOKENS.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Device Setup</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Where is the Device?</Text>
          <Text style={styles.mainSubtitle}>Choose an existing room or create a new room manually before pairing.</Text>
        </View>

        {/* Tab Selection (only shown if there are existing rooms) */}
        {rooms.length > 0 && (
          <View style={styles.tabContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setFlowMode('EXISTING')}
              style={[styles.tabButton, flowMode === 'EXISTING' && styles.tabButtonActive]}
            >
              <MaterialCommunityIcons 
                name="home-outline" 
                size={18} 
                color={flowMode === 'EXISTING' ? '#002112' : TOKENS.textSecondary} 
              />
              <Text style={[styles.tabText, flowMode === 'EXISTING' && styles.tabTextActive]}>Existing Room</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setFlowMode('NEW')}
              style={[styles.tabButton, flowMode === 'NEW' && styles.tabButtonActive]}
            >
              <MaterialCommunityIcons 
                name="plus" 
                size={18} 
                color={flowMode === 'NEW' ? '#002112' : TOKENS.textSecondary} 
              />
              <Text style={[styles.tabText, flowMode === 'NEW' && styles.tabTextActive]}>New Room</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Option A: Existing Room Selection */}
        {flowMode === 'EXISTING' && rooms.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>Select Destination Room</Text>
            <View style={styles.roomsGrid}>
              {rooms.map((room) => {
                const isSelected = selectedRoom?.id === room.id;
                return (
                  <TouchableOpacity
                    key={room.id}
                    activeOpacity={0.9}
                    onPress={() => setSelectedRoom(room)}
                    style={[styles.roomCard, isSelected && styles.roomCardActive]}
                  >
                    <View style={[styles.roomIconContainer, isSelected && styles.roomIconContainerActive]}>
                      <MaterialCommunityIcons 
                        name={getRoomIcon(room.room_type)} 
                        size={24} 
                        color={isSelected ? '#002112' : TOKENS.accent} 
                      />
                    </View>
                    <Text style={[styles.roomNameText, isSelected && styles.roomNameTextActive]} numberOfLines={1}>
                      {room.name}
                    </Text>
                    <Text style={[styles.roomTypeText, isSelected && styles.roomTypeTextActive]}>
                      {room.room_type ? room.room_type.replace('_', ' ') : 'General'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Option B: New Custom Room Form */}
        {(flowMode === 'NEW' || rooms.length === 0) && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>Enter Room Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Custom Room Name</Text>
              <TextInput
                value={newRoomName}
                onChangeText={handleRoomNameChange}
                placeholder="e.g. Master Bedroom, Dining Hall"
                placeholderTextColor="rgba(255,255,255,0.2)"
                mode="outlined"
                activeOutlineColor={TOKENS.accent}
                outlineColor="#262626"
                textColor="#FFFFFF"
                style={styles.outlinedTextInput}
              />
            </View>

          </View>
        )}

        {/* Proceed Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleNext}
          style={styles.primaryBtn}
        >
          <Text style={styles.btnText}>Proceed to Hardware Setup</Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color="#002112" />
        </TouchableOpacity>
      </ScrollView>

      <Snackbar
        visible={showSnackbar}
        onDismiss={() => setShowSnackbar(false)}
        duration={3000}
        style={styles.errorSnackbar}
        action={{
          label: 'OK',
          textColor: '#FCA5A5',
          onPress: () => setShowSnackbar(false),
        }}
      >
        <Text style={styles.snackbarText}>{snackbarMessage}</Text>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 36) : 50,
    paddingBottom: 10,
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: TOKENS.accent,
    letterSpacing: 0.5,
  },
  titleSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    marginBottom: 6,
  },
  mainSubtitle: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 15,
    lineHeight: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: TOKENS.surfaceLow,
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: TOKENS.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: TOKENS.textSecondary,
  },
  tabTextActive: {
    color: '#002112',
    fontWeight: '700',
  },
  sectionContainer: {
    backgroundColor: TOKENS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: TOKENS.border,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  roomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  roomCard: {
    width: '47%',
    backgroundColor: TOKENS.surfaceLow,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  roomCardActive: {
    borderColor: TOKENS.accent,
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
  },
  roomIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomIconContainerActive: {
    backgroundColor: TOKENS.accent,
  },
  roomNameText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.textPrimary,
  },
  roomNameTextActive: {
    color: TOKENS.accent,
  },
  roomTypeText: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    textTransform: 'capitalize',
  },
  roomTypeTextActive: {
    color: TOKENS.textSecondary,
  },
  emptyRoomsWarning: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: '#D97706',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  emptyRoomsText: {
    flex: 1,
    fontSize: 12,
    color: '#FBBF24',
    lineHeight: 16,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  outlinedTextInput: {
    backgroundColor: TOKENS.bg,
    fontSize: 14,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: TOKENS.surfaceLow,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TOKENS.border,
    gap: 8,
  },
  categoryCardActive: {
    borderColor: TOKENS.accent,
    backgroundColor: TOKENS.accent,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.textSecondary,
  },
  categoryLabelActive: {
    color: '#002112',
    fontWeight: '700',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 52,
    backgroundColor: TOKENS.accent,
    borderRadius: 26,
    gap: 8,
    marginTop: 8,
  },
  btnText: {
    color: '#002112',
    fontSize: 15,
    fontWeight: '900',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: TOKENS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorSnackbar: {
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  snackbarText: {
    color: '#FCA5A5',
    fontWeight: 'bold',
  },
});
