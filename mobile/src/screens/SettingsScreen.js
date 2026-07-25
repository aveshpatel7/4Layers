import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';
import { AuthContext } from '../context/AuthContext';

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
  const [isSavingPassword, setIsSavingPassword] = useState(false);



  const [stats, setStats] = useState({ totalDevices: 0, activeDevices: 0, totalRooms: 0 });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/api/users/me');
      setUser(response.data);
      setEditUsername(response.data.username);
      setEditEmail(response.data.email);

      // Fetch stats
      const [devsRes, homesRes] = await Promise.all([
        apiClient.get('/api/devices').catch(() => ({ data: [] })),
        apiClient.get('/api/homes').catch(() => ({ data: [] }))
      ]);

      let roomsCount = 0;
      if (homesRes.data && homesRes.data.length > 0) {
        const roomsRes = await apiClient.get(`/api/rooms/home/${homesRes.data[0].id}`).catch(() => ({ data: [] }));
        roomsCount = roomsRes.data ? roomsRes.data.length : 0;
      }

      const devs = devsRes.data || [];
      const activeCount = devs.filter(d => d.current_state?.status === 'ON' || d.status).length;
      setStats({
        totalDevices: devs.length,
        activeDevices: activeCount,
        totalRooms: roomsCount
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    } finally {
      setIsLoading(false);
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
      'Are you sure you want to log out of SmartNest?',
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
          <Text style={styles.statNumber}>{stats.totalDevices}</Text>
          <Text style={styles.statLabel}>Total Devices</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statColumn}>
          <Text style={styles.statNumber}>{stats.activeDevices}</Text>
          <Text style={styles.statLabel}>Devices ON</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statColumn}>
          <Text style={styles.statNumber}>{stats.totalRooms}</Text>
          <Text style={styles.statLabel}>Rooms</Text>
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
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={TOKENS.textSecondary}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password (min 6 chars)"
                placeholderTextColor={TOKENS.textSecondary}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                placeholderTextColor={TOKENS.textSecondary}
                secureTextEntry
              />
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
    justify: 'center',
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
  }
});
