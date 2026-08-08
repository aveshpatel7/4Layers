import React from 'react';
import { StyleSheet, View, Modal, TouchableOpacity, StatusBar } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const TOKENS = {
  bg: '#0b0f19',
  surface: '#121827',
  surfaceLow: '#1a2234',
  accent: '#00E676',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  border: 'rgba(255, 255, 255, 0.1)',
  danger: '#EF4444'
};

export default function CustomAppModal({
  visible,
  title,
  message,
  iconName = 'shield-alert-outline',
  primaryText = 'Allow',
  secondaryText = 'Exit App',
  onPrimary,
  onSecondary,
  dangerSecondary = false
}) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name={iconName} size={32} color={TOKENS.accent} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.btnRow}>
            {onSecondary && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onSecondary}
                style={[
                  styles.btn,
                  styles.secondaryBtn,
                  dangerSecondary && { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }
                ]}
              >
                <Text
                  style={[
                    styles.secondaryBtnText,
                    dangerSecondary && { color: TOKENS.danger }
                  ]}
                >
                  {secondaryText}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onPrimary}
              style={[styles.btn, styles.primaryBtn]}
            >
              <Text style={styles.primaryBtnText}>{primaryText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: TOKENS.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: TOKENS.surfaceLow,
    borderWidth: 1,
    borderColor: TOKENS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: TOKENS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: TOKENS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: TOKENS.accent,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  secondaryBtnText: {
    color: TOKENS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
});
