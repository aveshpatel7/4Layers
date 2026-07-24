import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function VerticalCapsuleSwitch({
  isEnabled = false,
  onToggle,
  onTurnOn,
  onTurnOff,
  size = "md",
  orientation = "vertical"
}) {
  const isHorizontal = orientation === "horizontal";

  // Dimensions for specified variants:
  // sm: 72x160, radius 36
  // md: 96x210, radius 48
  // lg: 120x270, radius 60
  // normal: 54x110, radius 27 (vertical) OR 110x46, radius 23 (horizontal)
  let width = isHorizontal ? 110 : 96;
  let height = isHorizontal ? 46 : 210;
  let radius = isHorizontal ? 23 : 48;

  if (!isHorizontal) {
    if (size === "sm") {
      width = 72;
      height = 160;
      radius = 36;
    } else if (size === "lg") {
      width = 120;
      height = 270;
      radius = 60;
    } else if (size === "normal" || size === "compact") {
      width = 54;
      height = 110;
      radius = 27;
    }
  } else {
    if (size === "sm") {
      width = 90;
      height = 38;
      radius = 19;
    } else if (size === "lg") {
      width = 130;
      height = 54;
      radius = 27;
    }
  }

  // Animation values for smooth 350ms transition
  const animVal = useRef(new Animated.Value(isEnabled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: isEnabled ? 1 : 0,
      duration: 350,
      useNativeDriver: false
    }).start();
  }, [isEnabled]);

  // Interpolated opacity values for smooth 350ms color transitions
  const activeOpacity = animVal;
  const inactiveOpacity = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0]
  });

  const handlePressOn = () => {
    if (!isEnabled) {
      if (onTurnOn) onTurnOn();
      else if (onToggle) onToggle(true);
    }
  };

  const handlePressOff = () => {
    if (isEnabled) {
      if (onTurnOff) onTurnOff();
      else if (onToggle) onToggle(false);
    }
  };

  const fontSize = isHorizontal ? 11 : (size === "normal" ? 11 : width * 0.15);

  const gradStart = isHorizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 };
  const gradEnd = isHorizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 };

  const divStart = isHorizontal ? { x: 0.5, y: 0 } : { x: 0, y: 0.5 };
  const divEnd = isHorizontal ? { x: 0.5, y: 1 } : { x: 1, y: 0.5 };

  return (
    <View style={[styles.outerContainer, { width, height, borderRadius: radius }]}>
      {/* Outer Border & Glow Container */}
      <Animated.View
        style={[
          styles.capsuleShape,
          {
            width,
            height,
            borderRadius: radius,
            borderColor: isEnabled ? "#16a34a" : "rgba(255,255,255,0.08)",
            borderWidth: 1,
            flexDirection: isHorizontal ? "row" : "column"
          },
          isEnabled && styles.outerGlowOn
        ]}
      >
        {/* TOP / LEFT ZONE (ON) */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePressOn}
          style={styles.zoneTop}
        >
          {/* Active Gradient (ON = True) */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: activeOpacity }]}>
            <LinearGradient
              colors={["#14532d", "#166534", "#0f3e21"]}
              start={gradStart}
              end={gradEnd}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Inactive Gradient (ON = False) */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: inactiveOpacity }]}>
            <LinearGradient
              colors={["#111111", "#181818"]}
              start={gradStart}
              end={gradEnd}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Text
            style={[
              styles.labelText,
              { fontSize },
              isEnabled ? styles.textOnActive : styles.textInactive
            ]}
          >
            ON
          </Text>
        </TouchableOpacity>

        {/* THIN DIVIDER LINE */}
        <View
          style={[
            styles.dividerContainer,
            {
              height: isHorizontal ? "100%" : 1.5,
              width: isHorizontal ? 1.5 : "100%"
            }
          ]}
        >
          {/* Active Green Divider Line */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: activeOpacity }]}>
            <LinearGradient
              colors={["transparent", "rgba(34,197,94,0.6)", "transparent"]}
              start={divStart}
              end={divEnd}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Inactive Subtle White Divider Line */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: inactiveOpacity }]}>
            <LinearGradient
              colors={["transparent", "rgba(255,255,255,0.15)", "transparent"]}
              start={divStart}
              end={divEnd}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {/* BOTTOM / RIGHT ZONE (OFF) */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePressOff}
          style={styles.zoneBottom}
        >
          {/* Active OFF Gradient (When OFF = True, i.e. isEnabled = False) */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: inactiveOpacity }]}>
            <LinearGradient
              colors={["#2a2a2a", "#242424", "#1e1e1e"]}
              start={gradStart}
              end={gradEnd}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Inactive OFF Gradient (When OFF = False, i.e. isEnabled = True) */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: activeOpacity }]}>
            <LinearGradient
              colors={["#181818", "#1a1a1a"]}
              start={gradStart}
              end={gradEnd}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Text
            style={[
              styles.labelText,
              { fontSize },
              !isEnabled ? styles.textOffActive : styles.textInactive
            ]}
          >
            OFF
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    justifyContent: "center",
    alignItems: "center"
  },
  capsuleShape: {
    overflow: "hidden",
    justifyContent: "space-between",
    alignItems: "stretch"
  },
  outerGlowOn: {
    ...Platform.select({
      ios: {
        shadowColor: "#16a34a",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 8
      },
      android: {
        elevation: 4
      }
    })
  },
  zoneTop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },
  zoneBottom: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },
  dividerContainer: {
    height: 1.5,
    width: "100%",
    position: "relative"
  },
  labelText: {
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center"
  },
  textOnActive: {
    color: "#FFFFFF",
    textShadowColor: "rgba(34, 197, 94, 0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4
  },
  textOffActive: {
    color: "#FFFFFF"
  },
  textInactive: {
    color: "rgba(255, 255, 255, 0.18)"
  }
});
