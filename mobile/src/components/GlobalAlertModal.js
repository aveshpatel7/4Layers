import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Modal, TouchableOpacity, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert } from 'react-native';

const TOKENS = {
  bg: '#0E0E0E',
  surface: '#1C1B1B',
  surfaceLow: '#141414',
  accent: '#1fa971',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  border: 'rgba(255, 255, 255, 0.1)',
  danger: '#EF4444'
};

let alertListenerRef = null;

// Global Interceptor for React Native Alert.alert
const originalAlert = Alert.alert;
Alert.alert = (title, message, buttons, options) => {
  if (alertListenerRef) {
    alertListenerRef({
      visible: true,
      title: title || '',
      message: message || '',
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }]
    });
  } else {
    originalAlert(title, message, buttons, options);
  }
};

export default function GlobalAlertModal() {
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: []
  });

  useEffect(() => {
    alertListenerRef = setAlertConfig;
    return () => {
      alertListenerRef = null;
    };
  }, []);

  if (!alertConfig.visible) return null;

  const handleClose = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  const handleButtonPress = (btn) => {
    handleClose();
    if (btn && typeof btn.onPress === 'function') {
      setTimeout(() => {
        try {
          btn.onPress();
        } catch (e) {
          console.warn('[GlobalAlertModal] Button callback error:', e);
        }
      }, 100);
    }
  };

  const buttons = alertConfig.buttons || [];
  const cancelBtn = buttons.find(b => b.style === 'cancel');
  const primaryBtn = buttons.find(b => b.style !== 'cancel') || buttons[0] || { text: 'OK' };

  const isDestructive = primaryBtn?.style === 'destructive' || cancelBtn?.style === 'destructive';
  const isError = (alertConfig.title && (
                    alertConfig.title.toLowerCase().includes('error') || 
                    alertConfig.title.toLowerCase().includes('fail') || 
                    alertConfig.title.toLowerCase().includes('denied') ||
                    alertConfig.title.toLowerCase().includes('remove') ||
                    alertConfig.title.toLowerCase().includes('delete') ||
                    alertConfig.title.toLowerCase().includes('leave') ||
                    alertConfig.title.toLowerCase().includes('revoke')
                  ));

  const isSuccess = alertConfig.title && (
                    alertConfig.title.toLowerCase().includes('success') || 
                    alertConfig.title.includes('🎉')
                  );

  const iconName = isError || isDestructive ? 'shield-alert-outline' : 
                   isSuccess ? 'check-circle-outline' : 
                   'information-outline';

  const iconColor = isError || isDestructive ? TOKENS.danger : TOKENS.accent;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={alertConfig.visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[
            styles.iconCircle,
            { borderColor: isError || isDestructive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(31, 169, 113, 0.3)' }
          ]}>
            <MaterialCommunityIcons name={iconName} size={32} color={iconColor} />
          </View>

          {!!alertConfig.title && <Text style={styles.title}>{alertConfig.title}</Text>}
          {!!alertConfig.message && <Text style={styles.message}>{alertConfig.message}</Text>}

          <View style={styles.btnRow}>
            {cancelBtn && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleButtonPress(cancelBtn)}
                style={[styles.btn, styles.secondaryBtn]}
              >
                <Text style={styles.secondaryBtnText}>{cancelBtn.text || 'Cancel'}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleButtonPress(primaryBtn)}
              style={[
                styles.btn,
                styles.primaryBtn,
                primaryBtn.style === 'destructive' && { backgroundColor: TOKENS.danger }
              ]}
            >
              <Text style={[
                styles.primaryBtnText,
                primaryBtn.style === 'destructive' && { color: '#FFFFFF' }
              ]}>
                {primaryBtn.text || 'OK'}
              </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
    borderWidth: 1.5,
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
