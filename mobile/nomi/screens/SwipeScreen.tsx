import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics"; // FIX 3 - Haptic feedback
import { Colors } from "../theme/colors";
import { getRestaurantsByMood, buildReason, Restaurant } from '../services/restaurantService';
import { recordSwipe } from '../services/swipeService';
import { useAuth } from '../context/AuthContext';

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
  selectedMoods: string[];
  budgetLevel: number;
  onBack: () => void;
  onChangePreferences: () => void;
  onDetail: (restaurant: Restaurant) => void;
};

export { type Restaurant };

export default function SwipeScreen({ selectedMoods, budgetLevel, onBack, onChangePreferences, onDetail }: Props) {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [batchStart, setBatchStart] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getRestaurantsByMood(selectedMoods, budgetLevel, 15);
        const withReasons = data.map(r => ({
          ...r,
          reason: buildReason(r, selectedMoods),
        }));
        setRestaurants(withReasons);
      } catch (e) {
        setError('Could not load restaurants. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurants();
  }, [selectedMoods, budgetLevel]);

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
  const currentBatch = restaurants.slice(batchStart, batchEnd);
  const allDone = batchStart >= restaurants.length;
  const batchDone = currentIndex >= currentBatch.length && !allDone;
  const restaurant = currentBatch[currentIndex];

  const animateOut = (direction: "left" | "right") => {
    // FIX 3 - Haptic feedback on swipe
    if (direction === "right") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Record swipe to Firestore
    if (user && restaurant) {
      recordSwipe(
        user.uid,
        restaurant.id,
        direction === "right" ? "like" : "pass",
        selectedMoods
      );
    }

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

  const refetchRestaurants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRestaurantsByMood(selectedMoods, budgetLevel, 15);
      const withReasons = data.map(r => ({
        ...r,
        reason: buildReason(r, selectedMoods),
      }));
      setRestaurants(withReasons);
    } catch (e) {
      setError('Could not load restaurants. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.accent} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={refetchRestaurants}
            accessibilityLabel="Try again"
            accessibilityRole="button"
          >
            <Text style={styles.loadMoreText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // FIX 5 - Empty state when no restaurants found
  if (!loading && restaurants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{"\u{1F50D}"}</Text>
          <Text style={styles.emptyTitle}>No restaurants found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your mood or budget preferences
          </Text>
          <TouchableOpacity
            style={styles.preferencesButton}
            onPress={onChangePreferences}
            accessibilityLabel="Change preferences"
            accessibilityRole="button"
          >
            <Text style={styles.preferencesButtonText}>Change Preferences</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            {restaurants.length - batchEnd > 0
              ? `${restaurants.length - batchEnd} more to discover`
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
        <TouchableOpacity
          onPress={onBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.counterText}>
          {batchStart + currentIndex + 1} / {restaurants.length}
        </Text>
        <TouchableOpacity
          style={styles.detailButton}
          onPress={() => restaurant && onDetail(restaurant)}
          accessibilityLabel="View restaurant details"
          accessibilityRole="button"
        >
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
          {restaurant.photos && restaurant.photos.length > 0 ? (
            <Image
              source={{ uri: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${restaurant.photos[0].photo_reference}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}` }}
              style={styles.photoSection}
            />
          ) : (
            <View style={[styles.photoSection, { backgroundColor: '#E8E8E8' }]} />
          )}

          {/* Info section */}
          <View style={styles.infoSection}>
            <Text style={styles.restaurantName}>{restaurant.name}</Text>

            <View style={styles.metaRow}>
              {restaurant.distance && <Text style={styles.metaText}>{restaurant.distance}</Text>}
              {restaurant.distance && <Text style={styles.metaDot}>{"\u00B7"}</Text>}
              <Text style={styles.metaText}>{budgetSymbol(restaurant.budget_level)}</Text>
            </View>

            <View style={styles.moodRow}>
              {restaurant.mood_tags && restaurant.mood_tags.slice(0, 3).map((mood) => (
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
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => animateOut("left")}
          accessibilityLabel="Dislike this restaurant"
          accessibilityRole="button"
          accessibilityHint="Swipe left or tap to reject"
        >
          <Text style={styles.rejectIcon}>{"\u2715"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => animateOut("right")}
          accessibilityLabel="Like this restaurant"
          accessibilityRole="button"
          accessibilityHint="Swipe right or tap to save"
        >
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
    backgroundColor: "rgba(224, 106, 79, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10, // FIX 6 - Increased from 6 for 44px touch target
    borderRadius: 12,
    minHeight: 44,
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
    backgroundColor: "rgba(224, 106, 79, 0.15)",
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
    backgroundColor: "rgba(224, 106, 79, 0.08)",
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
