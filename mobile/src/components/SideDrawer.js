import React, { useState, useRef } from 'react';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 300);

const TOKENS = {
  bg: '#0E0E0E',
  drawerBg: '#141414',
  cardBg: '#1C1B1B',
  accent: '#22C55E',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#E5E2E1',
  textSecondary: '#9CA3AF',
  activeItemBg: 'rgba(34,197,94,0.12)'
};

export default function SideDrawer({
  visible,
  onClose,
  navigation,
  activeRouteName = 'Home',
  userProfile = null
}) {
  const [activeVoiceModal, setActiveVoiceModal] = useState(null);

  const menuItems = [
    { key: 'HomeTab', label: 'Dashboard', image: require('../assets/dashboard_home.png'), type: 'route' },
    { key: 'SchedulesTab', label: 'Schedules', image: require('../assets/schedules.png'), type: 'route' },
    { key: 'RoomsTab', label: 'Room Management', image: require('../assets/room_management.png'), type: 'route' },
    { key: 'GoogleHome', label: 'Google Home', image: require('../assets/google_home.png'), type: 'modal' },
    { key: 'AmazonAlexa', label: 'Amazon Alexa', image: require('../assets/amazon_alexa.png'), type: 'modal' }
  ];

  // Hyper-responsive Swipe Left Gesture Responder inside Drawer to close
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
    if (itemKey === 'SettingsTab') {
      return activeRouteName === 'SettingsTab' || activeRouteName === 'Settings';
    }
    return activeRouteName === itemKey;
  };

  const handleItemPress = (item) => {
    if (item.type === 'modal') {
      if (item.key === 'GoogleHome') {
        setActiveVoiceModal('google');
      } else if (item.key === 'AmazonAlexa') {
        setActiveVoiceModal('alexa');
      }
    } else {
      onClose();
      if (navigation && item.key) {
        if (item.key === 'RoomsTab' || item.key === 'Rooms') {
          navigation.navigate('HomeTab', { screen: 'Rooms' });
        } else if (item.key === 'HomeTab') {
          navigation.navigate('HomeTab', { screen: 'DevicesHome' });
        } else {
          navigation.navigate(item.key);
        }
      }
    }
  };

  const handleOpenSettings = () => {
    onClose();
    if (navigation) {
      navigation.navigate('SettingsTab');
    }
  };

  const isSettingsActive = isItemActive('SettingsTab');

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        statusBarTranslucent={true}
      >
        <View style={styles.overlay}>
          {/* Drawer Slider Container on Left */}
          <View style={styles.drawerContainer} {...drawerPanResponder.panHandlers}>
            <View style={styles.safeArea}>

              {/* Header: Brand & Close Button */}
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

              {/* User Profile Card */}
              <View style={styles.profileCard}>
                <View style={styles.avatarCircle}>
                  <MaterialCommunityIcons name="account" size={24} color={TOKENS.accent} />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {userProfile?.name || 'Naved'}
                  </Text>
                  <Text style={styles.userRole}>Smart Home Owner</Text>
                </View>
              </View>

              {/* Navigation Menu List */}
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
                      {item.image ? (
                        <Image
                          source={item.image}
                          style={{ width: 22, height: 22 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name={isActive ? item.activeIcon : item.icon}
                          size={22}
                          color={isActive ? TOKENS.accent : TOKENS.textSecondary}
                        />
                      )}
                      <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Bottom Footer: Settings Gear Icon */}
              <View style={styles.drawerFooter}>
                <TouchableOpacity
                  style={[styles.settingsFooterBtn, isSettingsActive && styles.menuItemActive]}
                  onPress={handleOpenSettings}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingsLeftGroup}>
                    <MaterialCommunityIcons name="cog" size={24} color={TOKENS.accent} />
                    <Text style={styles.settingsBtnText}>Settings</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={TOKENS.textSecondary} />
                </TouchableOpacity>
              </View>

            </View>
          </View>

          {/* Semi-transparent backdrop tap to close on right */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={onClose}
          />
        </View>
      </Modal>

      {/* Voice Setup Guide Modal (Google Home / Amazon Alexa) */}
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
                <View style={styles.modalHeaderRow}>
                  <Image
                    source={require('../assets/google_home.png')}
                    style={{ width: 28, height: 28, marginRight: 10 }}
                    resizeMode="contain"
                  />
                  <Text style={styles.modalHeaderTitle}>Google Home Setup</Text>
                  <TouchableOpacity onPress={() => setActiveVoiceModal(null)}>
                    <MaterialCommunityIcons name="close" size={22} color={TOKENS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.statusBadgeRow}>
                  <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>LINKED & READY</Text>
                  <Text style={{ color: TOKENS.textSecondary, fontSize: 11 }}>Action.Devices API</Text>
                </View>

                <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.guideSectionBox}>
                    <Text style={styles.guideStepText}>1. Open the <Text style={{ fontWeight: '700', color: '#fff' }}>Google Home App</Text>.</Text>
                    <Text style={styles.guideStepText}>2. Tap <Text style={{ fontWeight: '700', color: '#fff' }}>"+" -> Works with Google</Text>.</Text>
                    <Text style={styles.guideStepText}>3. Search for <Text style={{ fontWeight: '700', color: TOKENS.accent }}>"4Layers Smart Home"</Text>.</Text>
                    <Text style={styles.guideStepText}>4. Enter your email & password to link your account.</Text>
                    <Text style={styles.guideStepText}>5. Say: <Text style={{ fontWeight: '700', color: '#4285F4' }}>"Hey Google, turn on Bedroom Light"</Text>.</Text>
                  </View>
                </ScrollView>
              </>
            )}

            {activeVoiceModal === 'alexa' && (
              <>
                <View style={styles.modalHeaderRow}>
                  <Image
                    source={require('../assets/amazon_alexa.png')}
                    style={{ width: 28, height: 28, marginRight: 10 }}
                    resizeMode="contain"
                  />
                  <Text style={styles.modalHeaderTitle}>Amazon Alexa Setup</Text>
                  <TouchableOpacity onPress={() => setActiveVoiceModal(null)}>
                    <MaterialCommunityIcons name="close" size={22} color={TOKENS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.statusBadgeRow}>
                  <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>READY & ACTIVE</Text>
                  <Text style={{ color: TOKENS.textSecondary, fontSize: 11 }}>Smart Home V3 Skill</Text>
                </View>

                <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.guideSectionBox}>
                    <Text style={styles.guideStepText}>1. Open the <Text style={{ fontWeight: '700', color: '#fff' }}>Amazon Alexa App</Text>.</Text>
                    <Text style={styles.guideStepText}>2. Go to <Text style={{ fontWeight: '700', color: '#fff' }}>More -> Skills & Games</Text>.</Text>
                    <Text style={styles.guideStepText}>3. Search for <Text style={{ fontWeight: '700', color: TOKENS.accent }}>"4Layers Smart Home"</Text>.</Text>
                    <Text style={styles.guideStepText}>4. Tap Enable to Use and log in with your credentials.</Text>
                    <Text style={styles.guideStepText}>5. Say: <Text style={{ fontWeight: '700', color: '#00CAFF' }}>"Alexa, set Fan speed to 3"</Text>.</Text>
                  </View>
                </ScrollView>
              </>
            )}

            <TouchableOpacity
              style={styles.closeGuideBtn}
              onPress={() => setActiveVoiceModal(null)}
            >
              <Text style={styles.closeGuideBtnText}>Got it, Close</Text>
            </TouchableOpacity>
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
    maxWidth: 400,
    backgroundColor: TOKENS.cardBg,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  modalHeaderTitle: {
    flex: 1,
    color: TOKENS.textPrimary,
    fontSize: 17,
    fontWeight: '700'
  },
  statusBadgeRow: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  guideSectionBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  guideStepText: {
    color: TOKENS.textSecondary,
    fontSize: 13,
    lineHeight: 22,
    marginBottom: 8
  },
  closeGuideBtn: {
    backgroundColor: TOKENS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16
  },
  closeGuideBtnText: {
    color: '#000',
    fontSize: 14,
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
    justify: 'space-between'
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 36) : 48,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12
  },
  menuItemActive: {
    backgroundColor: TOKENS.activeItemBg
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.textSecondary
  },
  menuLabelActive: {
    color: TOKENS.accent,
    fontWeight: '700'
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  settingsFooterBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TOKENS.cardBg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  settingsLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  settingsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.textPrimary
  }
});
