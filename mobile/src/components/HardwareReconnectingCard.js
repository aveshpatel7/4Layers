import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// Enable LayoutAnimation for Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TOKENS = {
  bg: "#141414",
  cardBg: "#18181B",
  border: "rgba(255, 255, 255, 0.08)",
  accentCyan: "#06B6D4",
  accentAmber: "#F59E0B",
  accentGreen: "#10B981",
  textPrimary: "#F4F4F5",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",
};

// Session-level memory for collapse preference
let sessionIsCollapsed = false;

export default function HardwareReconnectingCard({ onRefresh, isRefreshing = false }) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [collapsed, setCollapsed] = useState(sessionIsCollapsed);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const chevronAnim = useRef(new Animated.Value(sessionIsCollapsed ? 0 : 1)).current;
  const contentOpacityAnim = useRef(new Animated.Value(sessionIsCollapsed ? 0 : 1)).current;

  // Track elapsed boot time when offline
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => (prev < 60 ? prev + 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Smooth animated progress bar & pulsing status dot
  useEffect(() => {
    progressAnim.setValue(0);
    Animated.loop(
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const toggleCollapse = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        280,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );

    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    sessionIsCollapsed = nextCollapsed;

    Animated.parallel([
      Animated.timing(chevronAnim, {
        toValue: nextCollapsed ? 0 : 1,
        duration: 280,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacityAnim, {
        toValue: nextCollapsed ? 0 : 1,
        duration: 280,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const progressPercent = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["5%", "95%"],
  });

  // Rotate chevron 180 degrees: 0 (collapsed) -> 0deg (pointing down), 1 (expanded) -> 180deg (pointing up)
  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  // Calculate current active stage based on seconds elapsed
  const getStageStatus = (stageIdx) => {
    const currentStage = secondsElapsed < 5 ? 0 : secondsElapsed < 15 ? 1 : secondsElapsed < 25 ? 2 : 3;
    if (stageIdx < currentStage) return "DONE";
    if (stageIdx === currentStage) return "ACTIVE";
    return "PENDING";
  };

  const stages = [
    { title: "Power & ESP32 Boot", subtitle: "Hardware initialization (~3s)", icon: "power" },
    { title: "Wi-Fi Association & IP", subtitle: "Connecting to local router (~10s)", icon: "wifi" },
    { title: "NTP & Cloud TLS Sync", subtitle: "Connecting to EMQX Serverless (~8s)", icon: "shield-check-outline" },
    { title: "Switches Online", subtitle: "Restoring real-time controls", icon: "toggle-switch-outline" },
  ];

  return (
    <View style={styles.cardContainer}>
      {/* Header Banner - Tappable with min 40x40 area */}
      <TouchableOpacity
        style={styles.headerRow}
        activeOpacity={0.75}
        onPress={toggleCollapse}
      >
        <View style={styles.headerLeft}>
          <Animated.View style={[styles.glowingDot, { opacity: pulseAnim }]} />
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle}>Switchboard Reconnecting...</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Establishing secure cloud connection (~15-25s)
            </Text>
          </View>
        </View>

        <View style={styles.chevronButton}>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <MaterialCommunityIcons
              name="chevron-down"
              size={22}
              color={TOKENS.textSecondary}
            />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Progress Line */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressBar, { width: progressPercent }]} />
      </View>

      {/* Expandable Step-by-Step Stages & Bottom Action */}
      {!collapsed && (
        <Animated.View style={[styles.stagesContainer, { opacity: contentOpacityAnim }]}>
          {stages.map((stage, idx) => {
            const status = getStageStatus(idx);
            const isDone = status === "DONE";
            const isActive = status === "ACTIVE";

            return (
              <View key={idx} style={styles.stageRow}>
                <View style={styles.stageIconCol}>
                  <View
                    style={[
                      styles.stageIconWrapper,
                      isDone && styles.stageIconDone,
                      isActive && styles.stageIconActive,
                    ]}
                  >
                    {isDone ? (
                      <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" />
                    ) : isActive ? (
                      <ActivityIndicator size="small" color={TOKENS.accentCyan} />
                    ) : (
                      <MaterialCommunityIcons name={stage.icon} size={13} color={TOKENS.textMuted} />
                    )}
                  </View>
                  {idx < stages.length - 1 && (
                    <View
                      style={[
                        styles.stageConnectorLine,
                        isDone && styles.stageConnectorLineDone,
                      ]}
                    />
                  )}
                </View>

                <View style={styles.stageTextCol}>
                  <Text
                    style={[
                      styles.stageTitle,
                      isActive && styles.stageTitleActive,
                      isDone && styles.stageTitleDone,
                    ]}
                  >
                    {stage.title}
                  </Text>
                  <Text style={styles.stageSubtitle}>{stage.subtitle}</Text>
                </View>
              </View>
            );
          })}

          {/* Hairline Divider & Bottom Tip / Action */}
          <View style={styles.actionRow}>
            <View style={styles.tipGroup}>
              <MaterialCommunityIcons name="lightbulb-outline" size={13} color={TOKENS.accentAmber} />
              <Text style={styles.hintText}>
                Just plugged in the board? Switches activate automatically once connected.
              </Text>
            </View>
            {onRefresh && (
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={onRefresh}
                disabled={isRefreshing}
                activeOpacity={0.7}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#002112" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="refresh" size={13} color="#002112" />
                    <Text style={styles.refreshBtnText}>Check Live Status</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: TOKENS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.3)",
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: TOKENS.accentCyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    minHeight: 48,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerTextGroup: {
    flex: 1,
  },
  glowingDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: TOKENS.accentCyan,
    shadowColor: TOKENS.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: TOKENS.textPrimary,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    marginTop: 1,
  },
  chevronButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  progressTrack: {
    height: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    width: "100%",
  },
  progressBar: {
    height: "100%",
    backgroundColor: TOKENS.accentCyan,
    borderRadius: 1.5,
  },
  stagesContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  stageIconCol: {
    alignItems: "center",
    width: 22,
    marginRight: 10,
  },
  stageIconWrapper: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  stageIconDone: {
    backgroundColor: TOKENS.accentGreen,
    borderColor: TOKENS.accentGreen,
  },
  stageIconActive: {
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    borderColor: TOKENS.accentCyan,
  },
  stageConnectorLine: {
    width: 2,
    height: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 1,
  },
  stageConnectorLineDone: {
    backgroundColor: TOKENS.accentGreen,
  },
  stageTextCol: {
    flex: 1,
    paddingTop: 0.5,
  },
  stageTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: TOKENS.textMuted,
  },
  stageTitleActive: {
    color: TOKENS.accentCyan,
    fontWeight: "700",
  },
  stageTitleDone: {
    color: TOKENS.textPrimary,
  },
  stageSubtitle: {
    fontSize: 10,
    color: TOKENS.textMuted,
    marginTop: 0.5,
  },
  actionRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  tipGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 180,
  },
  hintText: {
    fontSize: 10,
    color: TOKENS.textMuted,
    flex: 1,
    lineHeight: 13,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1fa971",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    gap: 4,
  },
  refreshBtnText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#002112",
  },
});
