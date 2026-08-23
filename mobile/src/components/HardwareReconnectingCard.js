import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Easing,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const TOKENS = {
  cardBg: "rgba(24, 24, 27, 0.96)",
  border: "rgba(6, 182, 212, 0.35)",
  accentCyan: "#06B6D4",
  accentAmber: "#F59E0B",
  accentGreen: "#10B981",
  textPrimary: "#F4F4F5",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",
};

export default function HardwareReconnectingCard({ onRefresh, isRefreshing = false }) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Track elapsed boot time when offline
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => (prev < 120 ? prev + 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Smooth entrance & pulsing status dot
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, []);

  // Determine stage info based on elapsed seconds (Dynamic single status)
  const getStageInfo = () => {
    if (secondsElapsed < 4) {
      return {
        icon: "power",
        text: "Switchboard Reconnecting...",
        sub: "~3s",
        color: TOKENS.accentCyan,
      };
    } else if (secondsElapsed < 14) {
      return {
        icon: "wifi",
        text: "Wi-Fi Re-authenticating...",
        sub: "~10s",
        color: TOKENS.accentAmber,
      };
    } else if (secondsElapsed < 24) {
      return {
        icon: "shield-check-outline",
        text: "Syncing with Cloud Server...",
        sub: "~8s",
        color: TOKENS.accentCyan,
      };
    } else {
      return {
        icon: "cloud-sync-outline",
        text: "Re-verifying Live Controls...",
        sub: "re-checking",
        color: TOKENS.accentCyan,
      };
    }
  };

  const stage = getStageInfo();

  return (
    <Animated.View
      style={[
        styles.floatingContainer,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.contentRow}>
        {/* Left Pulsing Status Dot */}
        <View style={styles.indicatorContainer}>
          <Animated.View
            style={[
              styles.glowingDot,
              {
                backgroundColor: stage.color,
                shadowColor: stage.color,
                opacity: pulseAnim,
              },
            ]}
          />
        </View>

        {/* Dynamic Single-line Status Text */}
        <View style={styles.textGroup}>
          <Text style={styles.mainText} numberOfLines={1}>
            {stage.text}
          </Text>
          <Text style={styles.subText} numberOfLines={1}>
            Restoring live connection ({stage.sub})
          </Text>
        </View>

        {/* Compact Status Check Button */}
        {onRefresh && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onRefresh}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#002112" />
            ) : (
              <View style={styles.actionBtnInner}>
                <MaterialCommunityIcons name="refresh" size={13} color="#002112" />
                <Text style={styles.actionBtnText}>Check</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 34 : 22,
    alignSelf: "center",
    zIndex: 9998,
    width: "92%",
    maxWidth: 420,
    backgroundColor: TOKENS.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  indicatorContainer: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  glowingDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
  textGroup: {
    flex: 1,
    marginRight: 10,
  },
  mainText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: TOKENS.textPrimary,
    letterSpacing: 0.1,
  },
  subText: {
    fontSize: 10.5,
    color: TOKENS.textSecondary,
    marginTop: 1,
  },
  actionBtn: {
    backgroundColor: "#1fa971",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    minHeight: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#002112",
  },
});
