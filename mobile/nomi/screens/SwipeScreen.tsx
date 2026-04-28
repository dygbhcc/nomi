import React, { useState, useRef, useEffect } from "react";
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
import ValidateScreen from "./ValidateScreen";

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

const BATCH_SIZE = 3;
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
  onBack: () => void;
  onChangePreferences: () => void;
  onDetail: (restaurant: Restaurant) => void;
};

export { type Restaurant };

export default function SwipeScreen({ onBack, onChangePreferences, onDetail }: Props) {
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [batchStart, setBatchStart] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);

  useEffect(() => {
    const delay = 1000 + Math.random() * 2000; // 1-3 seconds
    const timer = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(timer);
  }, []);

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

  const batchEnd = batchStart + BATCH_SIZE;
  const currentBatch = MOCK_RESTAURANTS.slice(batchStart, batchEnd);
  const allDone = batchStart >= MOCK_RESTAURANTS.length;
  const batchDone = currentIndex >= currentBatch.length && !allDone;
  const restaurant = currentBatch[currentIndex];

  const animateOut = (direction: "left" | "right") => {
    const toValue = direction === "right" ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    if (direction === "right" && restaurant) {
      setLiked((prev) => [...prev, restaurant.id]);
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

  const handleLoadMore = () => {
    setBatchStart(batchEnd);
    setCurrentIndex(0);
  };

  // Show validate mini-game while "loading" restaurant data
  if (loading) {
    return (
      <ValidateScreen
        onDone={() => setLoading(false)}
        onSkip={() => setLoading(false)}
      />
    );
  }

  if (allDone) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{"\u{1F37D}"}</Text>
          <Text style={styles.emptyTitle}>No more restaurants</Text>
          <Text style={styles.emptySubtitle}>
            {liked.length > 0
              ? `You liked ${liked.length} place${liked.length > 1 ? "s" : ""}!`
              : "Try different preferences to discover more."}
          </Text>
          <TouchableOpacity style={styles.preferencesButton} onPress={onChangePreferences}>
            <Text style={styles.preferencesButtonText}>Change Preferences</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (batchDone) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{"\u{1F50D}"}</Text>
          <Text style={styles.emptyTitle}>
            {MOCK_RESTAURANTS.length - batchEnd > 0
              ? `${MOCK_RESTAURANTS.length - batchEnd} more to discover`
              : "Last batch coming up!"}
          </Text>
          <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
            <Text style={styles.loadMoreText}>Load More</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.counterText}>
          {batchStart + currentIndex + 1} / {MOCK_RESTAURANTS.length}
        </Text>
        <TouchableOpacity style={styles.detailButton} onPress={() => restaurant && onDetail(restaurant)}>
          <Text style={styles.detailButtonText}>Details</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardWrapper}>
        <Animated.View
          style={[styles.card, { transform: [{ translateX }, { rotate }] }]}
          {...panResponder.panHandlers}
        >
          {/* Swipe indicators */}
          <Animated.View style={[styles.swipeLabel, styles.likeLabel, { opacity: likeOpacity }]}>
            <Text style={styles.swipeLabelText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.swipeLabel, styles.nopeLabel, { opacity: nopeOpacity }]}>
            <Text style={[styles.swipeLabelText, { color: REJECT_COLOR }]}>NOPE</Text>
          </Animated.View>

          {/* Photo placeholder */}
          <View style={styles.photoSection} />

          {/* Info section */}
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

            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Why for you?</Text>
              <Text style={styles.reasonText}>{restaurant.reason}</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  counterText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  detailButton: {
    backgroundColor: "rgba(127, 119, 221, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  detailButtonText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: "600",
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
    marginBottom: 10,
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
  reasonBox: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    padding: 10,
  },
  reasonLabel: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reasonText: {
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
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
  },
  loadMoreButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  loadMoreText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  preferencesButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  preferencesButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
});
