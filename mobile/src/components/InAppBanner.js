import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const TOKENS = {
  bg: '#1E293B',
  accent: '#22C55E',
  border: 'rgba(34, 197, 94, 0.4)',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  error: '#EF4444'
};

export default function InAppBanner({
  visible,
  inviteData,
  onAccept,
  onReject,
  onPressBanner
}) {
  if (!visible || !inviteData) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPressBanner}
      style={styles.bannerContainer}
    >
      <View style={styles.contentRow}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="shield-account" size={22} color={TOKENS.accent} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.titleText}>New Sharing Request</Text>
          <Text style={styles.bodyText} numberOfLines={2}>
            <Text style={{ fontWeight: '800', color: TOKENS.textPrimary }}>@{inviteData.inviter_username || 'Someone'}</Text> wants to share <Text style={{ color: TOKENS.accent, fontWeight: '700' }}>{inviteData.room_name || 'a Room'}</Text>
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => onAccept(inviteData.invite_id)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="check" size={16} color="#000" />
            <Text style={styles.acceptBtnText}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => onReject(inviteData.invite_id)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="close" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 45,
    left: 14,
    right: 14,
    zIndex: 9999,
    backgroundColor: TOKENS.bg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  textContainer: {
    flex: 1,
    marginRight: 8
  },
  titleText: {
    fontSize: 12,
    fontWeight: '800',
    color: TOKENS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  bodyText: {
    fontSize: 13,
    color: TOKENS.textSecondary,
    marginTop: 2,
    lineHeight: 18
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.accent,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4
  },
  acceptBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800'
  },
  rejectBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: TOKENS.error
  }
});
