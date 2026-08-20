import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  Modal,
  Image
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../api/client';
import { AuthContext } from '../context/AuthContext';

const TOKENS = {
  bg: '#0E0E0E',           // Pure Dark Theme
  surface: '#1C1B1B',      // surface-container
  surfaceLow: '#141414',   // surface-container-low
  accent: '#1fa971',       // Tech Emerald Green
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#E5E2E1',
  textSecondary: '#9CA3AF',
  error: '#EF4444'
};

const GoogleHomeLogo = ({ size = 28 }) => (
  <Image
    source={require('../assets/google_home.png')}
    style={{ width: size, height: size }}
    resizeMode="contain"
  />
);

const AlexaLogo = ({ size = 28 }) => (
  <Image
    source={require('../assets/amazon_alexa.png')}
    style={{ width: size, height: size }}
    resizeMode="contain"
  />
);

export default function SettingsScreen({ navigation }) {
  const { signOut } = useContext(AuthContext);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);



  const [stats, setStats] = useState({ totalDevices: 0, activeDevices: 0, totalRooms: 0 });
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const showLoading = !hasLoadedRef.current;
    fetchUserProfile(showLoading);
    hasLoadedRef.current = true;

    const intervalId = setInterval(() => {
      fetchUserProfile(false);
    }, 5000);

    const unsubscribe = navigation?.addListener ? navigation.addListener('focus', () => {
      fetchUserProfile(false);
    }) : () => {};

    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [navigation]);

  const fetchUserProfile = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      const response = await apiClient.get('/api/users/me');
      setUser(response.data);
      setEditUsername(response.data.username);
      setEditEmail(response.data.email);

      // Auto cleanup empty test homes
      await apiClient.post('/api/homes/cleanup-test-data').catch(() => {});

      // Fetch stats
      const [devsRes, homesRes] = await Promise.all([
        apiClient.get('/api/devices').catch(() => ({ data: [] })),
        apiClient.get('/api/homes').catch(() => ({ data: [] }))
      ]);

      let activeHome = null;
      let activeRooms = [];

      if (homesRes.data && Array.isArray(homesRes.data)) {
        for (const home of homesRes.data) {
          try {
            const roomRes = await apiClient.get(`/api/rooms/home/${home.id}`);
            const rooms = roomRes.data || [];
            if (rooms.length > 0) {
              activeHome = home;
              activeRooms = rooms;
              break;
            }
          } catch (err) {}
        }
        if (!activeHome && homesRes.data.length > 0) {
          activeHome = homesRes.data[0];
          try {
            const roomRes = await apiClient.get(`/api/rooms/home/${activeHome.id}`);
            activeRooms = roomRes.data || [];
          } catch (err) {}
        }
      }

      const roomsCount = activeRooms.length;
      const activeRoomIds = new Set(activeRooms.map(r => r.id));

      const allDevs = devsRes.data || [];
      const roomDevs = allDevs.filter(d => d.room_id && activeRoomIds.has(d.room_id));
      const devsToCount = roomDevs.length > 0 ? roomDevs : allDevs;

      const extractBoardKey = (d) => {
        if (!d || !d.node_id) return d?.mac_address?.toLowerCase().replace(/[:-]/g, '') || null;
        let raw = d.node_id;
        if (raw.includes('_')) {
          const parts = raw.split('_');
          const last = parts[parts.length - 1];
          if (/^\d+$/.test(last)) {
            parts.pop();
            raw = parts.join('_');
          }
        }
        return raw.toLowerCase().replace(/[:-]/g, '');
      };

      const macSet = new Set();
      devsToCount.forEach(d => {
        const key = extractBoardKey(d);
        if (key) {
          macSet.add(key);
        }
      });

      const uniqueBoardsCount = macSet.size > 0 ? macSet.size : (devsToCount.length > 0 ? 1 : 0);
      
      const isDeviceOn = (d) => {
        if (d.node_id?.endsWith('_6') || d.node_id?.endsWith('_7') || d.device_type === 'master' || d.type === 'master' || d.name?.toLowerCase().includes('master')) {
          return false;
        }
        let stateObj = d.current_state;
        if (typeof stateObj === 'string') {
          try { stateObj = JSON.parse(stateObj); } catch (e) {}
        }
        const st = stateObj?.status ?? d.status;
        return st === true || st === 'ON' || st === 1 || st === '1';
      };

      const activeCount = devsToCount.filter(isDeviceOn).length;

      setStats({
        totalBoards: uniqueBoardsCount,
        totalDevices: devsToCount.length,
        activeDevices: activeCount,
        totalRooms: roomsCount
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const handlePickProfilePicture = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied ❌', 'Permission to access gallery is required to choose a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let picUri = null;
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          picUri = `data:${mime};base64,${asset.base64}`;
        } else {
          picUri = asset.uri;
        }

        setIsSavingProfile(true);

        try {
          // Method A: Direct Base64 JSON payload
          const response = await apiClient.post('/api/users/me/profile-picture', {
            profile_pic_url: picUri
          });
          setUser(response.data);
          Alert.alert('Success 🎉', 'Profile picture updated successfully!');
        } catch (jsonErr) {
          // Method B: Multipart FormData fallback with exact 'file' param matching FastAPI UploadFile
          const formData = new FormData();
          const filename = asset.uri.split('/').pop() || 'profile.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const mimeType = match ? `image/${match[1]}` : 'image/jpeg';

          formData.append('file', {
            uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
            name: filename,
            type: mimeType
          });

          const response = await apiClient.post('/api/users/me/profile-picture', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          setUser(response.data);
          Alert.alert('Success 🎉', 'Profile picture updated successfully!');
        }
      }
    } catch (error) {
      console.error('Failed to upload profile picture:', error);
      Alert.alert('Upload Error ❌', error.response?.data?.detail || 'Could not upload profile picture');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editUsername.trim() || !editEmail.trim()) {
      Alert.alert('Validation Error', 'Username and email cannot be empty');
      return;
    }

    try {
      setIsSavingProfile(true);
      await apiClient.put('/api/users/me', {
        username: editUsername,
        email: editEmail
      });
      Alert.alert('Success', 'Profile updated successfully');
      setIsEditingProfile(false);
      fetchUserProfile();
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Could not update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Validation Error', 'All password fields are required');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match');
      return;
    }

    try {
      setIsSavingPassword(true);
      await apiClient.post('/api/users/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      Alert.alert('Success', 'Password updated successfully');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Failed to change password:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Could not change password');
    } finally {
      setIsSavingPassword(false);
    }
  };



  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out of 4Layers?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: () => signOut() }
      ]
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.titleSection}>
        <Text style={styles.mainTitle}>Configuration</Text>
        <Text style={styles.mainSubtitle}>Manage connection profiles and application settings.</Text>
      </View>

      {/* Real Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statColumn}>
          <Text style={styles.statNumber}>{stats.totalBoards || 1}</Text>
          <Text style={styles.statLabel}>BOARDS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statColumn}>
          <Text style={styles.statNumber}>{stats.activeDevices}</Text>
          <Text style={styles.statLabel}>DEVICES ON</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statColumn}>
          <Text style={styles.statNumber}>{stats.totalRooms}</Text>
          <Text style={styles.statLabel}>ROOMS</Text>
        </View>
      </View>

      {/* Device Management Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="chip" size={20} color={TOKENS.accent} />
          <Text style={styles.sectionTitle}>Device Management</Text>
        </View>
        <TouchableOpacity
          style={styles.addDeviceCard}
          onPress={() => navigation && navigation.navigate("RoomSelection")}
          activeOpacity={0.8}
        >
          <View style={styles.addDeviceLeftGroup}>
            <View style={styles.addDeviceIconCircle}>
              <MaterialCommunityIcons name="plus" size={22} color={TOKENS.accent} />
            </View>
            <View>
              <Text style={styles.addDeviceTitle}>Add New Switchboard / Device</Text>
              <Text style={styles.addDeviceSubtitle}>Configure hardware relays and channels</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={TOKENS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Account Settings Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="account" size={20} color={TOKENS.accent} />
          <Text style={styles.sectionTitle}>Account Profile</Text>
        </View>

        {isEditingProfile ? (
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholder="Enter username"
                placeholderTextColor={TOKENS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="Enter email"
                placeholderTextColor={TOKENS.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => {
                  setIsEditingProfile(false);
                  setEditUsername(user.username);
                  setEditEmail(user.email);
                }}
                disabled={isSavingProfile}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonTextSecondary}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
                activeOpacity={0.7}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color={TOKENS.bg} />
                ) : (
                  <Text style={styles.buttonTextPrimary}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            {/* Avatar Header Row */}
            <View style={styles.avatarHeaderRow}>
              <TouchableOpacity
                style={styles.avatarTouchBox}
                onPress={handlePickProfilePicture}
                activeOpacity={0.8}
              >
                {user?.profile_pic_url ? (
                  <Image
                    source={{ uri: user.profile_pic_url }}
                    style={styles.avatarLargeImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.avatarLargeFallback}>
                    <MaterialCommunityIcons name="account" size={36} color={TOKENS.accent} />
                  </View>
                )}
                <View style={styles.avatarCameraBadge}>
                  <MaterialCommunityIcons name="camera" size={12} color="#000000" />
                </View>
              </TouchableOpacity>

              <View style={styles.avatarHeaderTextGroup}>
                <Text style={styles.avatarHeaderName}>{user?.username || 'User'}</Text>
                <Text style={styles.avatarHeaderEmail}>{user?.email}</Text>
                <Text style={styles.avatarHeaderHint}>Tap avatar to upload photo</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{user?.username}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>

            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, { marginTop: 8 }]}
              onPress={() => setIsEditingProfile(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="pencil" size={16} color={TOKENS.bg} style={{ marginRight: 4 }} />
              <Text style={styles.buttonTextPrimary}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>



      {/* Security Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="lock" size={20} color={TOKENS.accent} />
          <Text style={styles.sectionTitle}>Security Settings</Text>
        </View>

        {isChangingPassword ? (
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={TOKENS.textSecondary}
                  secureTextEntry={!showCurrentPassword}
                />
                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={{ padding: 4 }} activeOpacity={0.7}>
                  <MaterialCommunityIcons name={showCurrentPassword ? "eye-off" : "eye"} size={20} color={TOKENS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password (min 6 chars)"
                  placeholderTextColor={TOKENS.textSecondary}
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 4 }} activeOpacity={0.7}>
                  <MaterialCommunityIcons name={showNewPassword ? "eye-off" : "eye"} size={20} color={TOKENS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  placeholderTextColor={TOKENS.textSecondary}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 4 }} activeOpacity={0.7}>
                  <MaterialCommunityIcons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={TOKENS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => {
                  setIsChangingPassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={isSavingPassword}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonTextSecondary}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleChangePassword}
                disabled={isSavingPassword}
                activeOpacity={0.7}
              >
                {isSavingPassword ? (
                  <ActivityIndicator size="small" color={TOKENS.bg} />
                ) : (
                  <Text style={styles.buttonTextPrimary}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => setIsChangingPassword(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="key-variant" size={16} color={TOKENS.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.buttonTextSecondary, { color: TOKENS.accent }]}>Change Password</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Logout Section */}
      <View style={[styles.section, { marginTop: 12 }]}>
        <TouchableOpacity
          style={[styles.button, styles.buttonDanger]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="logout" size={18} color={TOKENS.error} style={{ marginRight: 4 }} />
          <Text style={styles.buttonTextDanger}>Logout Profile</Text>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>4Layers Home Automation Panel</Text>
        <Text style={styles.appInfoText}>v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.bg
  },
  contentContainer: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 36) : 20,
    paddingBottom: 60
  },
  titleSection: {
    alignItems: 'center',
    marginVertical: 18,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TOKENS.accent,
    marginBottom: 4,
    letterSpacing: -0.5
  },
  mainSubtitle: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    textAlign: 'center',
    lineHeight: 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: TOKENS.bg
  },
  section: {
    marginBottom: 20
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.textPrimary,
    marginLeft: 6
  },
  card: {
    backgroundColor: TOKENS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  inputGroup: {
    width: '100%',
    marginBottom: 12
  },
  gridRow: {
    flexDirection: 'row',
    width: '100%',
  },
  infoRow: {
    marginBottom: 12
  },
  infoLabel: {
    fontSize: 10,
    color: TOKENS.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  infoValue: {
    fontSize: 15,
    color: TOKENS.textPrimary,
    fontWeight: '600'
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: TOKENS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  input: {
    backgroundColor: TOKENS.surfaceLow,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TOKENS.textPrimary,
    fontSize: 14,
    height: 44
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.surfaceLow,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44
  },
  passwordInput: {
    flex: 1,
    color: TOKENS.textPrimary,
    fontSize: 14,
    height: 44
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    flex: 1
  },
  buttonPrimary: {
    backgroundColor: TOKENS.accent
  },
  buttonTextPrimary: {
    color: '#002112',
    fontSize: 13,
    fontWeight: '800'
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  buttonTextSecondary: {
    color: TOKENS.textSecondary,
    fontSize: 13,
    fontWeight: '700'
  },
  buttonDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: TOKENS.error
  },
  buttonTextDanger: {
    color: TOKENS.error,
    fontSize: 13,
    fontWeight: '700'
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 20
  },
  appInfoText: {
    fontSize: 11,
    color: TOKENS.textSecondary
  },
  addDeviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TOKENS.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  addDeviceLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  addDeviceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  addDeviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.textPrimary
  },
  addDeviceSubtitle: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    marginTop: 2
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: TOKENS.surface,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: TOKENS.border,
    marginBottom: 20
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  statNumber: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    color: TOKENS.accent,
    textAlign: 'center'
  },
  statLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: TOKENS.textSecondary,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  statDivider: {
    width: 1,
    height: '70%',
    backgroundColor: TOKENS.border,
    alignSelf: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  guideModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1C1B1B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    flex: 1,
    marginLeft: 10
  },
  guideSectionBox: {
    backgroundColor: '#131313',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  guideSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.textPrimary
  },
  guideStepText: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    marginBottom: 6,
    lineHeight: 18
  },
  closeGuideBtn: {
    backgroundColor: TOKENS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10
  },
  closeGuideBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14
  },
  avatarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 16,
  },
  avatarTouchBox: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarLargeImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: TOKENS.accent,
  },
  avatarLargeFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#262626',
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: TOKENS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: TOKENS.surface,
  },
  avatarHeaderTextGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  avatarHeaderName: {
    fontSize: 16,
    fontWeight: '800',
    color: TOKENS.textPrimary,
  },
  avatarHeaderEmail: {
    fontSize: 12,
    color: TOKENS.textSecondary,
    marginTop: 2,
  },
  avatarHeaderHint: {
    fontSize: 11,
    color: TOKENS.accent,
    fontWeight: '700',
    marginTop: 4,
  }
});
