import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const ACCENT = "#7F77DD";
const BG = "#0D0D0D";
const CARD_BG = "#1A1A1A";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#888888";
const GOLD = "#FFD700";
const GREEN = "#2ECC71";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Restaurant = {
  id: string;
  name: string;
  distance: string;
  budget: number;
  moods: string[];
  reason: string;
};

type Props = {
  restaurant: Restaurant;
  totalVoters: number;
  likedBy: number;
  isCurrentUserWinner: boolean;
  roomCode: string;
  onStartOver: () => void;
};

function budgetSymbol(level: number): string {
  return "\u20AC".repeat(level);
}

// --- Confetti Particle ---
const CONFETTI_COLORS = ["#7F77DD", "#FFD700", "#E74C3C", "#2ECC71", "#3498DB", "#F39C12", "#9B59B6"];
const PARTICLE_COUNT = 40;

function ConfettiAnimation() {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: new Animated.Value(Math.random() * SCREEN_WIDTH),
      y: new Animated.Value(-20 - Math.random() * 60),
      rotate: new Animated.Value(0),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 6,
      delay: Math.random() * 800,
    }))
  ).current;

  useEffect(() => {
    particles.forEach((p) => {
      const duration = 2000 + Math.random() * 1500;
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.y, {
            toValue: 800,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(p.x, {
            toValue: (p.x as any)._value + (Math.random() - 0.5) * 120,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(p.rotate, {
            toValue: 4 + Math.random() * 4,
            duration,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, []);

  return (
    <View style={confettiStyles.container} pointerEvents="none">
      {particles.map((p, i) => {
        const spin = p.rotate.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        });
        return (
          <Animated.View
            key={i}
            style={[
              confettiStyles.particle,
              {
                width: p.size,
                height: p.size * 1.5,
                backgroundColor: p.color,
                borderRadius: p.size * 0.3,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { rotate: spin },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const confettiStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    overflow: "hidden",
  },
  particle: {
    position: "absolute",
  },
});

export default function ResultScreen({
  restaurant,
  totalVoters,
  likedBy,
  isCurrentUserWinner,
  roomCode,
  onStartOver,
}: Props) {
  // Trophy scale-in animation
  const trophyScale = useRef(new Animated.Value(0)).current;
  // Badge slide-up animation
  const badgeTranslateY = useRef(new Animated.Value(100)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  // Points animation
  const ptsOpacity = useRef(new Animated.Value(0)).current;
  const ptsTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Trophy bounce in
    Animated.spring(trophyScale, {
      toValue: 1,
      tension: 50,
      friction: 5,
      useNativeDriver: true,
      delay: 300,
    }).start();

    // Badge slide up after delay
    if (isCurrentUserWinner) {
      Animated.sequence([
        Animated.delay(1500),
        Animated.parallel([
          Animated.spring(badgeTranslateY, {
            toValue: 0,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(badgeOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(ptsOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(ptsTranslateY, {
            toValue: -20,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, []);

  // Voter avatar dots
  const voterDots = Array.from({ length: totalVoters }, (_, i) => i);
  const AVATAR_COLORS = ["#6B5FCC", "#9B8FEE", "#5A4FBB", "#7F77DD"];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ConfettiAnimation />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Trophy --- */}
        <Animated.View
          style={[
            styles.trophyContainer,
            { transform: [{ scale: trophyScale }] },
          ]}
        >
          <Text style={styles.trophyIcon}>{"\u2713"}</Text>
        </Animated.View>

        <Text style={styles.title}>
          Nomi has decided! {"\u{1F389}"}
        </Text>

        {/* --- Winner Card --- */}
        <View style={styles.winnerCard}>
          <View style={styles.winnerPhotoPlaceholder}>
            <Text style={styles.winnerPhotoText}>
              {restaurant.name.charAt(0)}
            </Text>
          </View>

          <View style={styles.winnerInfo}>
            <Text style={styles.winnerName}>{restaurant.name}</Text>

            <View style={styles.moodRow}>
              {restaurant.moods.map((mood) => (
                <View key={mood} style={styles.moodBadge}>
                  <Text style={styles.moodBadgeText}>{mood}</Text>
                </View>
              ))}
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{restaurant.distance}</Text>
              <Text style={styles.metaDot}>{"\u00B7"}</Text>
              <Text style={styles.metaText}>
                {budgetSymbol(restaurant.budget)}
              </Text>
            </View>

            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Why this place?</Text>
              <Text style={styles.reasonText}>{restaurant.reason}</Text>
            </View>
          </View>
        </View>

        {/* --- Vote Summary --- */}
        <View style={styles.voteSummary}>
          <View style={styles.voterDots}>
            {voterDots.map((i) => (
              <View
                key={i}
                style={[
                  styles.voterDot,
                  {
                    backgroundColor:
                      i < likedBy
                        ? AVATAR_COLORS[i % AVATAR_COLORS.length]
                        : "#2A2A2A",
                    marginLeft: i > 0 ? -6 : 0,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.voteText}>
            {likedBy} out of {totalVoters} people liked this
          </Text>
        </View>

        {/* --- Action Buttons --- */}
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Get Directions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Make a Reservation</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.textButton} onPress={onStartOver}>
          <Text style={styles.textButtonText}>Start Over</Text>
        </TouchableOpacity>

        {/* --- The Decider Badge --- */}
        {isCurrentUserWinner && (
          <Animated.View
            style={[
              styles.badgeContainer,
              {
                opacity: badgeOpacity,
                transform: [{ translateY: badgeTranslateY }],
              },
            ]}
          >
            <View style={styles.badgeCard}>
              <Text style={styles.badgeIcon}>{"\u{1F3C6}"}</Text>
              <View style={styles.badgeTextContainer}>
                <Text style={styles.badgeTitle}>The Decider</Text>
                <Text style={styles.badgeSubtitle}>
                  You decided for the group! {"\u{1F451}"}
                </Text>
              </View>
              <Animated.View
                style={{
                  opacity: ptsOpacity,
                  transform: [{ translateY: ptsTranslateY }],
                }}
              >
                <Text style={styles.badgePts}>+100 pts</Text>
              </Animated.View>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 20,
    alignItems: "center",
    paddingTop: 24,
  },

  // --- Trophy ---
  trophyContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  trophyIcon: {
    color: TEXT_PRIMARY,
    fontSize: 40,
    fontWeight: "800",
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },

  // --- Winner Card ---
  winnerCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: ACCENT,
    overflow: "hidden",
    width: "100%",
    marginBottom: 16,
  },
  winnerPhotoPlaceholder: {
    height: 140,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
  },
  winnerPhotoText: {
    color: ACCENT,
    fontSize: 48,
    fontWeight: "700",
    opacity: 0.4,
  },
  winnerInfo: {
    padding: 16,
  },
  winnerName: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  moodRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  moodBadge: {
    backgroundColor: "rgba(127, 119, 221, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  moodBadgeText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  metaText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  metaDot: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginHorizontal: 6,
  },
  reasonBox: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    padding: 12,
  },
  reasonLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reasonText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "500",
  },

  // --- Vote Summary ---
  voteSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: "100%",
    marginBottom: 24,
  },
  voterDots: {
    flexDirection: "row",
    marginRight: 12,
  },
  voterDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: CARD_BG,
  },
  voteText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    flex: 1,
  },

  // --- Buttons ---
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: ACCENT,
    fontSize: 17,
    fontWeight: "700",
  },
  textButton: {
    paddingVertical: 12,
    marginBottom: 16,
  },
  textButtonText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },

  // --- The Decider Badge ---
  badgeContainer: {
    width: "100%",
  },
  badgeCard: {
    backgroundColor: "#1A1800",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GOLD,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badgeIcon: {
    fontSize: 36,
  },
  badgeTextContainer: {
    flex: 1,
  },
  badgeTitle: {
    color: GOLD,
    fontSize: 17,
    fontWeight: "800",
  },
  badgeSubtitle: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    marginTop: 2,
  },
  badgePts: {
    color: GREEN,
    fontSize: 18,
    fontWeight: "800",
  },
});
