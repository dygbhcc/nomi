import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

type Restaurant = {
  id: string;
  name: string;
  distance: string;
  budget: number;
  moods: string[];
  reason: string;
};

const MOCK_RESTAURANTS: Restaurant[] = [
  { id: "1", name: "Taberna da Rua das Flores", distance: "0.3 km", budget: 2, moods: ["romantic", "cozy"], reason: "Perfect match for your romantic + cozy mood" },
  { id: "2", name: "ZeroZero", distance: "0.8 km", budget: 2, moods: ["fresh", "lively"], reason: "Great fresh vibe with energetic crowd" },
  { id: "3", name: "Cantinho do Avillez", distance: "1.2 km", budget: 3, moods: ["hidden_gem", "romantic"], reason: "Hidden gem with intimate atmosphere" },
  { id: "4", name: "A Cevicheria", distance: "0.5 km", budget: 3, moods: ["fresh", "energetic"], reason: "Fresh seafood, buzzing energy" },
  { id: "5", name: "Taberna Albricoque", distance: "1.8 km", budget: 1, moods: ["cozy", "pet_friendly"], reason: "Pet friendly cozy spot" },
];

// Mock vote data per restaurant (simulating other participants' votes)
const MOCK_VOTES: Record<string, { liked: number; avatars: string[] }> = {
  "1": { liked: 3, avatars: ["A", "M", "S"] },
  "2": { liked: 1, avatars: ["A"] },
  "3": { liked: 2, avatars: ["M", "S"] },
  "4": { liked: 2, avatars: ["A", "M"] },
  "5": { liked: 1, avatars: ["S"] },
};

const AVATAR_COLORS = ["#6B5FCC", "#9B8FEE", "#5A4FBB", "#7F77DD"];
const SWIPE_THRESHOLD = 100;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ACCENT = "#7F77DD";
const BG = "#0D0D0D";
const CARD_BG = "#1A1A1A";
const PHOTO_BG = "#1A1A2E";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#888888";
const REJECT_COLOR = "#E74C3C";

function budgetSymbol(level: number): string {
  return "\u20AC".repeat(level);
}

type Props = {
  roomCode: string;
  participants: string[];
  onFinish: (winnerName: string) => void;
  onBack: () => void;
};

export default function VotingScreen({ roomCode, participants, onFinish, onBack }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>({});

  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-15deg", "0deg", "15deg"],
  });
  const likeOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const nopeOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const restaurant = MOCK_RESTAURANTS[currentIndex];
  const allDone = currentIndex >= MOCK_RESTAURANTS.length;

  const animateOut = (direction: "left" | "right") => {
    const toValue = direction === "right" ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    if (restaurant) {
      setMyVotes((prev) => ({ ...prev, [restaurant.id]: direction === "right" }));
    }
    Animated.timing(translateX, {
      toValue,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      setCurrentIndex((prev) => prev + 1);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          animateOut("right");
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          animateOut("left");
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // When all cards are done, determine winner
  if (allDone) {
    // Find the restaurant with highest combined votes (mock votes + my vote)
    let bestId = "1";
    let bestScore = 0;
    for (const r of MOCK_RESTAURANTS) {
      const mockLikes = MOCK_VOTES[r.id]?.liked || 0;
      const myLike = myVotes[r.id] ? 1 : 0;
      const total = mockLikes + myLike;
      if (total > bestScore) {
        bestScore = total;
        bestId = r.id;
      }
    }
    const winner = MOCK_RESTAURANTS.find((r) => r.id === bestId)!;
    // Auto-navigate to result
    setTimeout(() => onFinish(winner.name), 0);
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>{"\u{1F4CA}"}</Text>
          <Text style={styles.doneTitle}>Counting votes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const voteData = MOCK_VOTES[restaurant.id] || { liked: 0, avatars: [] };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Top bar: room code + participant avatars */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>{"\u2190"}</Text>
        </TouchableOpacity>
        <View style={styles.roomCodeBadge}>
          <Text style={styles.roomCodeText}>{roomCode}</Text>
        </View>
        <View style={styles.avatarRow}>
          {participants.slice(0, 4).map((name, i) => (
            <View key={name} style={[styles.miniAvatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], marginLeft: i > 0 ? -8 : 0 }]}>
              <Text style={styles.miniAvatarText}>{name[0]}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.counterText}>
          {currentIndex + 1}/{MOCK_RESTAURANTS.length}
        </Text>
      </View>

      {/* Card */}
      <View style={styles.cardWrapper}>
        <Animated.View
          style={[styles.card, { transform: [{ translateX }, { rotate }] }]}
          {...panResponder.panHandlers}
        >
          <Animated.View style={[styles.swipeLabel, styles.likeLabel, { opacity: likeOpacity }]}>
            <Text style={styles.swipeLabelText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.swipeLabel, styles.nopeLabel, { opacity: nopeOpacity }]}>
            <Text style={[styles.swipeLabelText, { color: REJECT_COLOR }]}>NOPE</Text>
          </Animated.View>

          <View style={styles.photoSection} />

          <View style={styles.infoSection}>
            <Text style={styles.restaurantName}>{restaurant.name}</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{restaurant.distance}</Text>
              <Text style={styles.metaDot}>{"\u00B7"}</Text>
              <Text style={styles.metaText}>{budgetSymbol(restaurant.budget)}</Text>
            </View>

            <View style={styles.moodRow}>
              {restaurant.moods.map((mood) => (
                <View key={mood} style={styles.moodBadge}>
                  <Text style={styles.moodBadgeText}>{mood}</Text>
                </View>
              ))}
            </View>

            {/* Live vote counter */}
            <View style={styles.voteRow}>
              <View style={styles.voteAvatars}>
                {voteData.avatars.map((initial, i) => (
                  <View key={initial} style={[styles.voteDot, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], marginLeft: i > 0 ? -6 : 0 }]}>
                    <Text style={styles.voteDotText}>{initial}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.voteText}>
                {voteData.liked}/{participants.length} liked this
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.rejectButton} onPress={() => animateOut("left")}>
          <Text style={styles.rejectIcon}>{"\u2715"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.likeButton} onPress={() => animateOut("right")}>
          <Text style={styles.likeIcon}>{"\u2665"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
  },
  backText: {
    color: TEXT_SECONDARY,
    fontSize: 20,
  },
  roomCodeBadge: {
    backgroundColor: CARD_BG,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  roomCodeText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  avatarRow: {
    flexDirection: "row",
    flex: 1,
  },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BG,
  },
  miniAvatarText: {
    color: TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: "700",
  },
  counterText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  cardWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    overflow: "hidden",
  },
  swipeLabel: {
    position: "absolute",
    top: 40,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 3,
  },
  likeLabel: {
    left: 20,
    borderColor: ACCENT,
  },
  nopeLabel: {
    right: 20,
    borderColor: REJECT_COLOR,
  },
  swipeLabelText: {
    fontSize: 24,
    fontWeight: "800",
    color: ACCENT,
  },
  photoSection: {
    flex: 7,
    backgroundColor: PHOTO_BG,
  },
  infoSection: {
    flex: 3,
    padding: 16,
    justifyContent: "center",
  },
  restaurantName: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
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
  moodRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
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
  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  voteAvatars: {
    flexDirection: "row",
    marginRight: 10,
  },
  voteDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: CARD_BG,
  },
  voteDotText: {
    color: TEXT_PRIMARY,
    fontSize: 9,
    fontWeight: "700",
  },
  voteText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  rejectButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(231, 76, 60, 0.15)",
    borderWidth: 2,
    borderColor: REJECT_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectIcon: {
    color: REJECT_COLOR,
    fontSize: 26,
    fontWeight: "700",
  },
  likeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(127, 119, 221, 0.15)",
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  likeIcon: {
    color: ACCENT,
    fontSize: 28,
  },
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  doneEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  doneTitle: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "700",
  },
});
