import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";

export default function BrandLogo({ size = "medium", color = "#1fa971", showText = true }) {
  const isLarge = size === "large";
  const imgSize = isLarge ? 44 : 32;
  const fontSize = isLarge ? 28 : 20;

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/4layers_logo.png")}
        style={{ width: imgSize, height: imgSize, resizeMode: "contain" }}
      />
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
