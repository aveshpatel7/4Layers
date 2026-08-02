import React from "react";
import { StyleSheet, Text, View } from "react-native";
const TOKENS = {
  bg: "#0D0D0D",
  cardBg: "#1A1A1A",
  accent: "#22C55E",
  border: "#262626",
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF"
};
export default function EnergyChart() {
  const weeklyConsumption = [
    { day: "Mon", usage: 14 },
    { day: "Tue", usage: 19 },
    { day: "Wed", usage: 12 },
    { day: "Thu", usage: 22 },
    { day: "Fri", usage: 18 },
    { day: "Sat", usage: 8 },
    { day: "Sun", usage: 9 }
  ];
  const maxUsage = Math.max(...weeklyConsumption.map((w) => w.usage));
  return <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>POWER CONSUMPTION</Text>
          <Text style={styles.chartSubTitle}>Weekly Efficiency Statistics</Text>
        </View>
        <Text style={styles.chartMetric}>15.4 kWh/day</Text>
      </View>

      {
    /* Simulated High-Fidelity Graph Bars */
  }
      <View style={styles.barsContainer}>
        {weeklyConsumption.map((item, index) => {
    const heightPercent = item.usage / maxUsage * 100;
    const isHighest = item.usage === maxUsage;
    return <View key={item.day} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
      style={[
        styles.barFill,
        { height: `${heightPercent}%` },
        // STABILITY RULE 2: Explicit boolean checks in inline layouts
        !!isHighest && styles.barFillHighest
      ]}
    />
              </View>
              <Text style={[
      styles.dayText,
      !!isHighest && styles.dayTextHighest
    ]}>
                {item.day}
              </Text>
            </View>;
  })}
      </View>

      <View style={styles.footerInfo}>
        <View style={styles.footerDot} />
        <Text style={styles.footerText}>Optimized solar-charging priority route is active</Text>
      </View>
    </View>;
}
const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: TOKENS.cardBg,
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: TOKENS.border
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: TOKENS.textSecondary,
    letterSpacing: 1.5
  },
  chartSubTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.textPrimary,
    marginTop: 2
  },
  chartMetric: {
    fontSize: 14,
    fontWeight: "700",
    color: TOKENS.accent
  },
  barsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 120,
    alignItems: "flex-end",
    paddingHorizontal: 10,
    marginBottom: 12
  },
  barColumn: {
    alignItems: "center",
    flex: 1
  },
  barTrack: {
    width: 12,
    height: 90,
    backgroundColor: TOKENS.bg,
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "flex-end"
  },
  barFill: {
    width: "100%",
    backgroundColor: "#4B5563",
    // Secondary gray
    borderRadius: 6
  },
  barFillHighest: {
    backgroundColor: TOKENS.accent
    // Glowing Green accent
  },
  dayText: {
    fontSize: 10,
    color: TOKENS.textSecondary,
    marginTop: 6
  },
  dayTextHighest: {
    color: TOKENS.accent,
    fontWeight: "600"
  },
  footerInfo: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    paddingTop: 12,
    marginTop: 6
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TOKENS.accent,
    marginRight: 8
  },
  footerText: {
    fontSize: 11,
    color: TOKENS.textSecondary
  }
});
