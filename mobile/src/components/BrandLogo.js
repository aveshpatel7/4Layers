import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

export default function BrandLogo({ size = "medium", color = "#22C55E", bg = "#0E0E0E" }) {
  const isLarge = size === "large";
  const iconSize = isLarge ? 36 : 24;
  const fontSize = isLarge ? 28 : 20;
  const borderWidth = isLarge ? 3.5 : 2.5;
  const gapWidth = iconSize * 0.35;
  const gapHeight = iconSize * 0.25;

  return (
    <View style={styles.container}>
      {/* Image 1 Circular Arc Power Loop Icon */}
      <View style={{ width: iconSize, height: iconSize, justifyContent: "center", alignItems: "center" }}>
        <View
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize / 2,
            borderWidth: borderWidth,
            borderColor: color
          }}
        />
        {/* Bottom Gap Mask */}
        <View
          style={{
            position: "absolute",
            bottom: -1,
            width: gapWidth,
            height: gapHeight,
            backgroundColor: bg
          }}
        />
      </View>

      {/* Brand Typography (4Layers) */}
      <Text style={[styles.brandText, { fontSize, color }]}>4Layers</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  brandText: {
    fontWeight: "900",
    letterSpacing: -0.5,
    fontFamily: "GoogleSansFlex-Bold"
  }
});
