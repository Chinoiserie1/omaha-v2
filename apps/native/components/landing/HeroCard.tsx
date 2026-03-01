import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";

export function HeroCard() {
  return (
    <View style={styles.card}>
      <Image
        source={require("../../assets/icon.png")}
        style={styles.image}
        contentFit="cover"
      />

      {/* Blue gradient overlay */}
      <LinearGradient
        colors={["rgba(0,112,255,0.7)", "rgba(30,64,175,0.3)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Info card at bottom */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.avatar} />
          <View style={styles.infoText}>
            <Text style={styles.kolName}>Top KOL</Text>
            <Text style={styles.kolHandle}>@autopilot_kol</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>+127%</Text>
            <Text style={styles.statLabel}>ROI</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>89%</Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    height: 320,
    backgroundColor: "#0F172A",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    shadowColor: "#0070FF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  infoCard: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,112,255,0.3)",
    borderWidth: 1,
    borderColor: "rgba(0,112,255,0.5)",
  },
  infoText: {
    flex: 1,
  },
  kolName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "SpaceGrotesk_600SemiBold",
  },
  kolHandle: {
    color: "#94A3B8",
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
  },
});
