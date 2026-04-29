import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Image,
  ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../theme/colors";

type Restaurant = {
  id: string;
  name: string;
  distance: string;
  budget: number;
  moods: string[];
  reason: string;
  photo?: ImageSourcePropType;
};

const MOCK_RESTAURANTS: Restaurant[] = [
  {
    id: "1",
    name: "Taberna da Rua das Flores",
    distance: "0.3 km",
    budget: 2,
    moods: ["romantic", "cozy"],
    reason: "Perfect match for your romantic + cozy mood",
    photo: require("../assets/images/restaurants/taberna-rua-das-flores.jpg")
  },
  {
    id: "2",
    name: "ZeroZero",
    distance: "0.8 km",
    budget: 2,
    moods: ["fresh", "lively"],
    reason: "Great fresh vibe with energetic crowd",
    photo: require("../assets/images/restaurants/zerozero.jpg")
  },
  {
    id: "3",
    name: "Cantinho do Avillez",
    distance: "1.2 km",
    budget: 3,
    moods: ["hidden_gem", "romantic"],
    reason: "Hidden gem with intimate atmosphere",
    photo: require("../assets/images/restaurants/catinho.jpg")
  },
  {
    id: "4",
    name: "A Cevicheria",
    distance: "0.5 km",
    budget: 3,
    moods: ["fresh", "energetic"],
    reason: "Fresh seafood, buzzing energy",
    // photo: require("../assets/images/restaurants/acevicheria.png")
  },
  {
    id: "5",
    name: "Taberna Albricoque",
    distance: "1.8 km",
    budget: 1,
    moods: ["cozy", "pet_friendly"],
    reason: "Pet friendly cozy spot",
    // photo: require("../assets/images/restaurants/taberna_albricoque.png")
  },
];

const BATCH_SIZE = 3;
const SWIPE_THRESHOLD = 100;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Using central theme
const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const PHOTO_BG = "#E8E8E8"; // Light gray for photo background
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [batchStart, setBatchStart] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);

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

  if (allDone) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
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
        <StatusBar style="dark" />
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

          {/* Photo */}
          {restaurant.photo ? (
            <Image source={restaurant.photo} style={styles.photoSection} />
          ) : (
            <View style={styles.photoSection} />
          )}

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
    justifyContent: "space-between",
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
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
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
    height: SCREEN_HEIGHT * 0.40,
    width: "100%",
    resizeMode: "cover",
    backgroundColor: PHOTO_BG,
  },
  infoSection: {
    padding: 16,
    paddingBottom: 20,
    backgroundColor: CARD_BG,
  },
  restaurantName: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
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
    gap: 6,
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
    backgroundColor: "rgba(127, 119, 221, 0.08)",
    borderRadius: 10,
    padding: 12,
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
    alignItems: "center",
    gap: 48,
    paddingTop: 16,
    paddingBottom: 16,
  },
  rejectButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFF0EF",
    borderWidth: 1.5,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F0EFFE",
    borderWidth: 1.5,
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
