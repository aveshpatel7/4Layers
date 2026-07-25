import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Dimensions
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
  const menuItems = [
    { key: 'HomeTab', label: 'Dashboard', icon: 'home-outline', activeIcon: 'home' },
    { key: 'SchedulesTab', label: 'Schedules', icon: 'clock-outline', activeIcon: 'clock' },
    { key: 'EnergyTab', label: 'Energy Monitor', icon: 'lightning-bolt-outline', activeIcon: 'lightning-bolt' },
    { key: 'RoomsTab', label: 'Room Management', icon: 'door-open', activeIcon: 'door-open' },
    { key: 'AlertsTab', label: 'Alerts & History', icon: 'bell-outline', activeIcon: 'bell' }
  ];

  const handleNavigate = (routeKey) => {
    onClose();
    if (navigation && routeKey) {
      navigation.navigate(routeKey);
    }
  };

  const handleOpenSettings = () => {
    onClose();
    if (navigation) {
      navigation.navigate('SettingsTab');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Semi-transparent backdrop tap to close */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Drawer Slider Container */}
        <View style={styles.drawerContainer}>
          <SafeAreaView style={styles.safeArea}>

            {/* Header: Brand & Close Button */}
            <View style={styles.drawerHeader}>
              <View style={styles.brandRow}>
                <BrandLogo size="small" />
                <Text style={styles.brandTitle}>4Layers</Text>
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
                const isActive = activeRouteName === item.key || (activeRouteName === 'Home' && item.key === 'HomeTab');
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                    onPress={() => handleNavigate(item.key)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={isActive ? item.activeIcon : item.icon}
                      size={22}
                      color={isActive ? TOKENS.accent : TOKENS.textSecondary}
                    />
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
                style={styles.settingsFooterBtn}
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

          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    borderRightWidth: 1,
    borderColor: TOKENS.border
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
    paddingTop: 16,
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
