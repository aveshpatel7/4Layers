import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";

export default function BrandLogo({ size = "medium", color = "#1fa971", showText = true }) {
  const isLarge = size === "large";
  const imgSize = isLarge ? 40 : 28;
  const fontSize = isLarge ? 26 : 20;

  return (
    <View style={styles.container}>
      <View style={{ backgroundColor: '#0E0E0E', borderRadius: 8, overflow: 'hidden', padding: 2 }}>
        <Image
          source={require("../../assets/4layers_logo.png")}
          style={{ width: imgSize, height: imgSize, backgroundColor: '#0E0E0E' }}
          resizeMode="contain"
        />
      </View>
      {showText && <Text style={[styles.brandText, { fontSize, color }]}>4Layers</Text>}
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
    letterSpacing: -0.5
  }
});
