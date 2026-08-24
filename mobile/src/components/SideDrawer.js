import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Dimensions,
  PanResponder,
  StatusBar,
  Platform,
  Image
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BrandLogo from './BrandLogo';
import apiClient from '../api/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 300);

const TOKENS = {
  bg: '#0E0E0E',
  drawerBg: '#141414',
  cardBg: '#1C1B1B',
  accent: '#1fa971',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#E5E2E1',
  textSecondary: '#9CA3AF',
  activeItemBg: 'rgba(31,169,113,0.15)'
};

export default function SideDrawer({
  visible,
  onClose,
  navigation,
  activeRouteName = 'Home',
  userProfile = null
}) {
  const [activeVoiceModal, setActiveVoiceModal] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState({ google_linked: false });
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [userProfileData, setUserProfileData] = useState(userProfile);

  useEffect(() => {
    if (userProfile) {
      setUserProfileData(userProfile);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchPendingCount();
    fetchUserProfile();
    const interval = setInterval(fetchPendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (visible) {
      fetchVoiceStatus();
      fetchPendingCount();
      fetchUserProfile();
    }
  }, [visible]);

  const fetchUserProfile = async () => {
    try {
      const res = await apiClient.get('/api/users/me');
      setUserProfileData(res.data);
    } catch (err) {
      console.warn("Failed to fetch user profile in SideDrawer:", err);
    }
  };

  const fetchVoiceStatus = async () => {
    try {
      const res = await apiClient.get('/api/voice/status');
      setVoiceStatus(res.data || { google_linked: false });
    } catch (err) {
      console.warn("Failed to fetch voice status:", err);
    }
  };

  const fetchPendingCount = async () => {
    try {
      const res = await apiClient.get('/api/nodes/pending-invites');
      if (Array.isArray(res.data)) {
        setPendingInvitesCount(res.data.length);
      }
    } catch (err) {
      console.warn("Failed to fetch pending invites count in SideDrawer:", err);
    }
  };

  const handleUnlink = async (provider) => {
    try {
      setIsUnlinking(true);
      await apiClient.post('/api/voice/unlink', { provider });
      fetchVoiceStatus();
    } catch (err) {
      console.warn("Failed to unlink voice integration:", err);
    } finally {
      setIsUnlinking(false);
    }
  };

  const openVoiceModal = (type) => {
    setActiveVoiceModal(type);
    fetchVoiceStatus();
  };

  const menuItems = [
    { key: 'HomeTab', label: 'Dashboard', image: require('../assets/dashboard_home.png'), type: 'route' },
    { key: 'SchedulesTab', label: 'Schedules', image: require('../assets/schedules.png'), type: 'route' },
    { key: 'RoomsTab', label: 'Room Management', image: require('../assets/room_management.png'), type: 'route' },
    { key: 'FamilyMembersTab', label: 'Add Members', image: require('../assets/add-contact.png'), type: 'route' },
    { key: 'GoogleHome', label: 'Google Home', image: require('../assets/google_home.png'), type: 'modal' }
  ];

  const drawerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dx < -10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        return gestureState.dx < -10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx < -15 || gestureState.vx < -0.1) {
          onClose();
        }
      },
      onPanResponderTerminate: (evt, gestureState) => {
        if (gestureState.dx < -15 || gestureState.vx < -0.1) {
          onClose();
        }
      }
    })
  ).current;

  const isItemActive = (itemKey) => {
    if (!activeRouteName) return itemKey === 'HomeTab';
    if (itemKey === 'HomeTab') {
      return activeRouteName === 'HomeTab' || activeRouteName === 'DevicesHome' || activeRouteName === 'Home';
    }
    if (itemKey === 'SchedulesTab') {
      return activeRouteName === 'SchedulesTab' || activeRouteName === 'Schedules';
    }
    if (itemKey === 'RoomsTab') {
      return activeRouteName === 'RoomsTab' || activeRouteName === 'Rooms';
    }
    if (itemKey === 'FamilyMembersTab') {
      return activeRouteName === 'FamilyMembersTab' || activeRouteName === 'FamilyMembers';
    }
    if (itemKey === 'SettingsTab') {
      return activeRouteName === 'SettingsTab' || activeRouteName === 'Settings';
    }
    return activeRouteName === itemKey;
  };

  const handleItemPress = (item) => {
    if (item.type === 'modal') {
      if (item.key === 'GoogleHome') {
        openVoiceModal('google');
      }
    } else {
      onClose();
      if (navigation && item.key) {
        if (item.key === 'RoomsTab' || item.key === 'Rooms') {
          navigation.navigate('HomeTab', { screen: 'Rooms' });
        } else if (item.key === 'FamilyMembersTab' || item.key === 'FamilyMembers') {
          navigation.navigate('HomeTab', { screen: 'FamilyMembers' });
        } else if (item.key === 'HomeTab') {
          navigation.navigate('HomeTab', { screen: 'DevicesHome' });
        } else {
          navigation.navigate(item.key);
        }
      }
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={onClose}
      >
      <View style={styles.overlay}>
        <View style={styles.drawerContainer} {...drawerPanResponder.panHandlers}>
          <View style={styles.safeArea}>
            <View style={styles.drawerHeader}>
              <View style={styles.brandRow}>
                <BrandLogo size="small" />
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={20} color={TOKENS.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.profileCard}
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                if (navigation) navigation.navigate('SettingsTab', { screen: 'Settings' });
              }}
            >
              <View style={styles.avatarCircle}>
                {userProfileData?.profile_pic_url ? (
                  <Image
                    source={{ uri: userProfileData.profile_pic_url }}
                    style={{ width: 42, height: 42, borderRadius: 21 }}
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialCommunityIcons name="account" size={24} color={TOKENS.accent} />
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {userProfileData?.username || userProfileData?.name || userProfile?.name || 'Naved'}
                </Text>
                <Text style={styles.userRole}>Smart Home Owner</Text>
              </View>
              <View style={styles.profileSettingsIconBox}>
                <MaterialCommunityIcons name="cog" size={16} color={TOKENS.accent} />
                <MaterialCommunityIcons name="chevron-right" size={16} color={TOKENS.textSecondary} />
              </View>
            </TouchableOpacity>

            <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
              {menuItems.map((item) => {
                const isActive = item.type === 'route' && isItemActive(item.key);
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuItemLeft}>
                      {item.image ? (
                        <Image
                          source={item.image}
                          style={{ width: 22, height: 22, marginRight: 12 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name={item.iconName || "account-group"}
                          size={22}
                          color={isActive ? TOKENS.accent : TOKENS.textSecondary}
                          style={{ marginRight: 12 }}
                        />
                      )}
                      <Text style={[styles.menuItemText, isActive && styles.menuItemTextActive]}>
                        {item.label}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={18}
                      color={isActive ? TOKENS.accent : TOKENS.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.drawerFooter}>
              <TouchableOpacity
                style={styles.addDeviceFooterBtn}
                onPress={() => {
                  onClose();
                  if (navigation) navigation.navigate('HomeTab', { screen: 'RoomSelection' });
                }}
                activeOpacity={0.8}
              >
                <View style={styles.addDeviceLeftGroup}>
                  <View style={styles.addDeviceIconCircle}>
                    <MaterialCommunityIcons name="plus" size={20} color="#000" />
                  </View>
                  <View style={styles.addDeviceTextGroup}>
                    <Text style={styles.addDeviceBtnTitle}>Add Switchboard</Text>
                    <Text style={styles.addDeviceBtnSub}>Pair relays & channels</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>

    <Modal
      visible={activeVoiceModal !== null}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setActiveVoiceModal(null)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.guideModalCard}>
          {activeVoiceModal === 'google' && (
            <>
              {/* Header */}
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Image
                    source={require('../assets/google_home.png')}
                    style={{ width: 24, height: 24 }}
                    resizeMode="contain"
                  />
                  <Text style={styles.modalHeaderTitle}>Google Assistant</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setActiveVoiceModal(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ padding: 4 }}
                >
                  <MaterialCommunityIcons name="close" size={20} color={TOKENS.textSecondary} />
                </TouchableOpacity>
              </View>

              {voiceStatus.google_linked ? (
                <>
                  {/* Status Badge */}
                  <View style={styles.statusBadgePill}>
                    <MaterialCommunityIcons name="check-decagram" size={13} color="#22C55E" />
                    <Text style={styles.statusBadgeText}>Linked & Synced</Text>
                  </View>

                  {/* Compact Info & Voice Commands */}
                  <View style={styles.guideSectionBox}>
                    <Text style={styles.linkedSubtitle}>
                      Your 4Layers smart devices are live and ready for Google Assistant voice commands.
                    </Text>

                    <View style={styles.voiceCommandsContainer}>
                      <Text style={styles.voiceCommandsTitle}>EXAMPLE COMMANDS:</Text>
                      <View style={styles.commandRow}>
                        <MaterialCommunityIcons name="microphone-outline" size={13} color={TOKENS.accent} />
                        <Text style={styles.commandText}>"Hey Google, turn on Bedroom Light"</Text>
                      </View>
                      <View style={styles.commandRow}>
                        <MaterialCommunityIcons name="microphone-outline" size={13} color={TOKENS.accent} />
                        <Text style={styles.commandText}>"Hey Google, set Fan speed to 3"</Text>
                      </View>
                    </View>
                  </View>

                  {/* Action Buttons Row */}
                  <View style={styles.modalActionsRow}>
                    <TouchableOpacity
                      style={styles.unlinkBtn}
                      onPress={() => handleUnlink('google')}
                      disabled={isUnlinking}
                      activeOpacity={0.7}
                    >
                      {isUnlinking ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Text style={styles.unlinkBtnText}>Unlink</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.closeGuideBtn}
                      onPress={() => setActiveVoiceModal(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.closeGuideBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* Not Linked Status */}
                  <View style={[styles.statusBadgePill, styles.statusBadgePillAmber]}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={13} color="#F59E0B" />
                    <Text style={[styles.statusBadgeText, { color: '#F59E0B' }]}>Not Linked</Text>
                  </View>

                  <View style={styles.guideSectionBox}>
                    <Text style={styles.guideStepText}>1. Open <Text style={{ fontWeight: '700', color: '#fff' }}>Google Home</Text> app.</Text>
                    <Text style={styles.guideStepText}>2. Tap <Text style={{ fontWeight: '700', color: '#fff' }}>"+" ➔ Works with Google</Text>.</Text>
                    <Text style={styles.guideStepText}>3. Search for <Text style={{ fontWeight: '700', color: TOKENS.accent }}>"[test] 4Layers"</Text>.</Text>
                    <Text style={styles.guideStepText}>4. Sign in to link your devices.</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.closeGuideBtn, { marginTop: 14 }]}
                    onPress={() => setActiveVoiceModal(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.closeGuideBtnText}>Got it</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  guideModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: TOKENS.cardBg,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: TOKENS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  modalHeaderTitle: {
    color: TOKENS.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  statusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12
  },
  statusBadgePillAmber: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.25)'
  },
  statusBadgeText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '700'
  },
  linkedSubtitle: {
    color: TOKENS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10
  },
  voiceCommandsContainer: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.15)'
  },
  voiceCommandsTitle: {
    color: TOKENS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  commandText: {
    color: '#E5E2E1',
    fontSize: 11.5,
    fontStyle: 'italic'
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14
  },
  unlinkBtn: {
    flex: 1,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center'
  },
  unlinkBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13
  },
  guideSectionBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  guideStepText: {
    color: TOKENS.textSecondary,
    fontSize: 12.5,
    lineHeight: 20,
    marginBottom: 6
  },
  closeGuideBtn: {
    flex: 1.3,
    backgroundColor: TOKENS.accent,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeGuideBtnText: {
    color: '#000',
    fontSize: 13.5,
    fontWeight: '800'
  },
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.65)'
  },
  backdrop: {
    flex: 1
  },
  drawerContainer: {
    width: DRAWER_WIDTH,
    backgroundColor: TOKENS.drawerBg,
    height: '100%',
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderRightWidth: 1,
    borderColor: TOKENS.border,
    overflow: 'hidden'
  },
  safeArea: {
    flex: 1,
    backgroundColor: TOKENS.drawerBg,
    justifyContent: 'space-between'
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 28) : 44,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TOKENS.accent,
    letterSpacing: -0.5
  },
  closeBtn: {
    padding: 6
  },
  badgeDot: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
  },
  badgeDotText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900'
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.cardBg,
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  profileInfo: {
    flex: 1
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: TOKENS.textPrimary
  },
  userRole: {
    fontSize: 11,
    color: TOKENS.textSecondary
  },
  menuList: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 8
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4
  },
  menuItemActive: {
    backgroundColor: TOKENS.activeItemBg
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.textSecondary
  },
  menuItemTextActive: {
    color: TOKENS.accent,
    fontWeight: '700'
  },
  profileSettingsIconBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.2)'
  },
  addDeviceFooterBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TOKENS.accent,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 16,
    shadowColor: TOKENS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4
  },
  addDeviceLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  addDeviceIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  addDeviceTextGroup: {
    flex: 1
  },
  addDeviceBtnTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.2
  },
  addDeviceBtnSub: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.7)'
  }
});
