import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Platform, Animated, Modal } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import VerticalCapsuleSwitch from "./VerticalCapsuleSwitch";

const TOKENS = {
  bg: "#0E0E0E",
  glassBg: "rgba(28, 27, 27, 0.7)",
  accentGreen: "#1fa971",
  accentInactive: "#4B5563",
  border: "rgba(255, 255, 255, 0.08)",
  textPrimary: "#E5E2E1",
  textSecondary: "#9CA3AF"
};

export function LuminaRockerSwitch({ isEnabled, isOnline = true, onToggle, size = "normal" }) {
  const switchSize = size === "master" ? "md" : size === "medium" ? "sm" : "normal";
  return (
    <VerticalCapsuleSwitch
      isEnabled={isOnline && isEnabled}
      isOnline={isOnline}
      onToggle={onToggle}
      size={switchSize}
    />
  );
}

export default function DeviceCard({ device, onToggle, onIncrease, onDecrease }) {
  const isOnline = device?.is_online !== false;
  const isEnabled = isOnline && (device?.status === true || device?.status === "ON");
  const [modalVisible, setModalVisible] = useState(false);

  // Determine Node S-1 to S-6
  let nodeLabel = "DEV";
  let nodeNum = 0;
  if (device?.node_id?.includes("_")) {
    const suffix = parseInt(device.node_id.split("_").pop(), 10);
    nodeNum = suffix;
    if (suffix === 5) nodeLabel = "Fan";
    else if (suffix === 6 || suffix === 7) nodeLabel = "Master Switch";
    else nodeLabel = `Switch ${suffix}`;
  } else if (device?.type === "fan") {
    nodeLabel = "Fan";
    nodeNum = 5;
  } else if (device?.type === "master" || device?.name?.toLowerCase().includes("master")) {
    nodeLabel = "Master Switch";
    nodeNum = 6;
  } else {
    nodeLabel = device?.name || "Switch";
  }

  const isFan = nodeNum === 5 || device?.type === "fan";
  const hasSettings = isFan && isOnline;

  const handleSwitchToggle = () => {
    if (!isOnline) {
      if (onToggle) {
        onToggle(); // Dashboard will show offline alert
      }
      return;
    }
    if (onToggle) {
      onToggle();
    }
  };

  // Clean Static Grid Cards (S-1 to S-6)
  return (
    <View style={[styles.gridGlassCard, !isOnline && styles.gridGlassCardOffline]}>
      {/* Node Tag & Settings Header */}
      <View style={styles.cardHeaderRow}>
        <Text style={[styles.nodeTagText, !isOnline && styles.nodeTagTextOffline]}>
          {nodeLabel}
        </Text>
        
        {isOnline && hasSettings && (
          <View style={styles.cardHeaderRight}>
            <TouchableOpacity
              style={styles.gearButtonInline}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="cog" size={15} color={TOKENS.accentGreen} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 3D Rocker Switch - Centered */}
      <View style={[styles.cardBodyCenter, !isOnline && styles.cardBodyOffline]}>
        <LuminaRockerSwitch
          isEnabled={isEnabled}
          isOnline={isOnline}
          onToggle={handleSwitchToggle}
          size="normal"
        />
      </View>

      {/* Card Footer Area (Balanced height on all cards for 100% exact center alignment) */}
      <View style={styles.cardFooterArea} />

      {/* Settings Modal (Popup) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons
                  name={isFan ? "fan" : "lightbulb-outline"}
                  size={22}
                  color={TOKENS.accentGreen}
                />
                <Text style={styles.modalTitleText}>
                  {isFan ? "Fan Speed Control" : "Light Dimmer"}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setModalVisible(false)} padding={4}>
                <MaterialCommunityIcons name="close" size={22} color={TOKENS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Fan Speed Controls Modal Content (- and + buttons) */}
            {isFan && (() => {
              const rawSpeed = (typeof device?.value === 'number' && !isNaN(device.value)) ? device.value : null;
              const currentSpeed = (rawSpeed !== null && rawSpeed > 0)
                ? rawSpeed 
                : (isEnabled ? (rawSpeed === 0 ? 1 : 4) : 0);
              return (
                <View style={styles.modalControlGroup}>
                  <View style={styles.levelHeaderRow}>
                    <Text style={styles.subLabelCaps}>Speed Level</Text>
                    <Text style={styles.speedValueText}>{currentSpeed} / 4</Text>
                  </View>

                  <View style={styles.dimmerAdjusterRow}>
                    <TouchableOpacity style={styles.adjustBtn} onPress={onDecrease} activeOpacity={0.7}>
                      <MaterialCommunityIcons name="minus" size={20} color={TOKENS.textPrimary} />
                    </TouchableOpacity>

                    <View style={styles.dimmerProgressBar}>
                      <View
                        style={[
                          styles.dimmerProgressFill,
                          { width: `${(currentSpeed / 4) * 100}%` },
                          styles.fillActive
                        ]}
                      />
                    </View>

                    <TouchableOpacity style={styles.adjustBtn} onPress={onIncrease} activeOpacity={0.7}>
                      <MaterialCommunityIcons name="plus" size={20} color={TOKENS.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}



            {/* Done / Close Button */}
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Grid Card Shell (S-1 to S-6) */
  gridGlassCard: {
    width: "48%",
    height: 205,
    backgroundColor: "#161515",
    borderRadius: 24,
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    position: "relative"
  },
  gridGlassCardOffline: {
    borderColor: "rgba(255, 255, 255, 0.05)",
    backgroundColor: "#121212",
    opacity: 0.65
  },
  cardBodyCenter: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center"
  },
  cardBodyOffline: {
    opacity: 0.8
  },
  cardFooterArea: {
    height: 12,
    width: "100%",
    justifyContent: "center",
    alignItems: "center"
  },
  cardHeaderRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  nodeTagText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#E5E2E1",
    letterSpacing: 0.5
  },
  nodeTagTextActive: {
    color: TOKENS.accentGreen
  },
  nodeTagTextOffline: {
    color: "#6B7280"
  },
  statusLedDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusLedOn: {
    backgroundColor: TOKENS.accentGreen,
    shadowColor: TOKENS.accentGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4
  },
  statusLedOff: {
    backgroundColor: "rgba(255, 255, 255, 0.15)"
  },
  gearButtonInline: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center"
  },
  fanSpeedBadgeRow: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.2)",
    marginTop: 2
  },
  fanSpeedBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: TOKENS.accentGreen,
    letterSpacing: 0.8
  },

  /* Gear Icon Button */
  gearButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#201F1F",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },

  /* Modal Overlay & Popup Window */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#1C1B1B",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)"
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: TOKENS.textPrimary
  },
  modalControlGroup: {
    marginVertical: 12
  },

  /* Fan Controls in Modal */
  levelHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 14
  },
  subLabelCaps: {
    fontSize: 11,
    fontWeight: "700",
    color: TOKENS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  speedValueText: {
    fontSize: 24,
    fontWeight: "900",
    color: TOKENS.accentGreen
  },
  speedBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 52,
    marginBottom: 8
  },
  speedBar: {
    flex: 1,
    borderRadius: 8
  },
  speedBarActive: {
    backgroundColor: TOKENS.accentGreen,
    ...Platform.select({
      ios: {
        shadowColor: TOKENS.accentGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8
      },
      android: {
        elevation: 6
      }
    })
  },
  speedBarInactive: {
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)"
  },
  speedNumLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4
  },
  speedNumText: {
    fontSize: 10,
    fontWeight: "700",
    color: TOKENS.textSecondary
  },

  /* Dimmer Controls in Modal (- and + buttons) */
  brightnessValueText: {
    fontSize: 16,
    fontWeight: "800",
    color: TOKENS.accentGreen,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
  },
  dimmerAdjusterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10
  },
  adjustBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  dimmerProgressBar: {
    flex: 1,
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 5,
    overflow: "hidden"
  },
  dimmerProgressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: TOKENS.accentGreen
  },
  fillActive: {
    backgroundColor: TOKENS.accentGreen
  },
  fillInactive: {
    backgroundColor: TOKENS.accentGreen
  },

  doneButton: {
    backgroundColor: TOKENS.accentGreen,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20
  },
  doneButtonText: {
    color: "#002112",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5
  },

  /* 3D Vertical Rocker Switch Styling (Borderless Solid Socket Fill) */
  rockerOuterWell: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10
      },
      android: {
        elevation: 6
      }
    })
  },
  rockerOuterWellOn: {
    backgroundColor: "#171616",
    borderWidth: 0
  },
  rockerOuterWellOff: {
    backgroundColor: "#171616",
    borderWidth: 0
  },
  rockerInnerBody: {
    width: "100%",
    height: "88%",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 0
  },
  rockerInnerBodyOn: {
    backgroundColor: "#2E2D2C"
  },
  rockerInnerBodyOff: {
    backgroundColor: "#1E1D1D"
  },

  labelCaps: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace"
  },
  labelOnActive: {
    color: TOKENS.accentGreen
  },
  labelOffActive: {
    color: "#E5E2E1"
  },
  labelInactive: {
    color: "rgba(229, 226, 225, 0.2)"
  },

  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  indicatorDotOn: {
    backgroundColor: TOKENS.accentGreen
  },
  indicatorDotOff: {
    backgroundColor: "rgba(229, 226, 225, 0.2)"
  }
});
