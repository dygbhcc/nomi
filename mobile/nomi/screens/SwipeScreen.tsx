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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics"; // FIX 3 - Haptic feedback
import { Colors } from "../theme/colors";
import LoadingOverlay from "../components/LoadingOverlay";
import { getSmartRecommendations, buildReason, Restaurant, getPhotoUrl } from '../services/restaurantService';
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

// Default location: Lisbon center (used for web and mobile)
const DEFAULT_LAT = 38.7223;
const DEFAULT_LNG = -9.1393;

type Props = {
  selectedMoods: string[];
  budgetLevel: number;
  selectedDistance: number | null;
  onBack: () => void;
  onChangePreferences: () => void;
  onDetail: (restaurant: Restaurant) => void;
  onShowLiked: (restaurants: Restaurant[]) => void;
};

export { type Restaurant };

export default function SwipeScreen({ selectedMoods, budgetLevel, selectedDistance, onBack, onChangePreferences, onDetail, onShowLiked }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [batchStart, setBatchStart] = useState(0);
  const [likedRestaurants, setLikedRestaurants] = useState<Restaurant[]>([]);
  const transitionedRef = useRef(false);

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getSmartRecommendations(
          user?.uid ?? null,
          selectedMoods,
          budgetLevel,
          selectedDistance,
          DEFAULT_LAT,
          DEFAULT_LNG
        );
        const withReasons = result.restaurants.slice(0, 6).map(r => ({
          ...r,
          reason: buildReason(r, selectedMoods),
        }));
        setRestaurants(withReasons);
        transitionedRef.current = false; // Reset when new restaurants load
      } catch (e) {
        setError(t('swipe.errorLoading'));
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurants();
  }, [selectedMoods, budgetLevel, selectedDistance]);

  const batchEnd = batchStart + BATCH_SIZE;
  const currentBatch = restaurants.slice(batchStart, batchEnd);
  const allDone = batchStart >= restaurants.length;

  useEffect(() => {
    if (allDone && restaurants.length > 0 && !transitionedRef.current) {
      transitionedRef.current = true;
      // Use setTimeout to avoid updating parent during render
      setTimeout(() => {
        onShowLiked(likedRestaurants);
      }, 0);
    }
  }, [allDone, restaurants.length]);

  const batchDone = currentIndex >= currentBatch.length && !allDone;

  // Handle transition when batch is done and no more restaurants
  useEffect(() => {
    if (batchDone && batchEnd >= restaurants.length && !transitionedRef.current) {
      transitionedRef.current = true;
      setTimeout(() => {
        onShowLiked(likedRestaurants);
      }, 0);
    }
  }, [batchDone, batchEnd, restaurants.length]);

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

  const restaurant = currentBatch[currentIndex];

  // Reset card position after the next card has mounted. Resetting only inside
  // the animation callback races with the native-driver state under Fabric and
  // can leave the new card stuck off-screen.
  useEffect(() => {
    translateX.setValue(0);
  }, [currentIndex, batchStart, translateX]);

  const animateOut = (direction: "left" | "right") => {
    // FIX 3 - Haptic feedback on swipe
    if (direction === "right") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Track liked restaurants
    if (direction === "right" && restaurant) {
      setLikedRestaurants((prev) => [...prev, restaurant]);
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
    Animated.timing(translateX, {
      toValue,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      setCurrentIndex((prev) => prev + 1);
    });
  };

  // PanResponder is created once, so its handlers must not close over a single
  // render's animateOut — otherwise gesture swipes on later cards record the
  // first card's restaurant.
  const animateOutRef = useRef(animateOut);
  animateOutRef.current = animateOut;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          animateOutRef.current("right");
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          animateOutRef.current("left");
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
      const result = await getSmartRecommendations(
        user?.uid ?? null,
        selectedMoods,
        budgetLevel,
        selectedDistance,
        DEFAULT_LAT,
        DEFAULT_LNG
      );
      const withReasons = result.restaurants.slice(0, 6).map(r => ({
        ...r,
        reason: buildReason(r, selectedMoods),
      }));
      setRestaurants(withReasons);
    } catch (e) {
      setError(t('swipe.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingOverlay />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>{t('common.error')}</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={refetchRestaurants}
            accessibilityLabel="Try again"
            accessibilityRole="button"
          >
            <Text style={styles.loadMoreText}>{t('common.ok')}</Text>
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
          <Text style={styles.emptyTitle}>{t('swipe.noResults')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('swipe.noMore')}
          </Text>
          <TouchableOpacity
            style={styles.preferencesButton}
            onPress={onChangePreferences}
            accessibilityLabel="Change preferences"
            accessibilityRole="button"
          >
            <Text style={styles.preferencesButtonText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (allDone) {
    // Transitioning to liked screen
    return null;
  }

  if (batchDone) {
    // If no more restaurants, transitioning to liked screen
    if (batchEnd >= restaurants.length) {
      return null;
    }

    // Otherwise show load more
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{"\u{1F50D}"}</Text>
          <Text style={styles.emptyTitle}>
            {t('swipe.moreToDiscover', { count: restaurants.length - batchEnd })}
          </Text>
          <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
            <Text style={styles.loadMoreText}>{t('common.loadMore')}</Text>
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
          <Text style={styles.backText}>{"\u2190"} {t('common.back')}</Text>
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
          <Text style={styles.detailButtonText}>{t('common.details')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardWrapper}>
        {/* Keyed per restaurant so each card mounts fresh native views — reused
            native-driver nodes can keep a stale transform/opacity on Fabric */}
        <Animated.View
          key={restaurant.id}
          style={[styles.card, { transform: [{ translateX }, { rotate }] }]}
          {...panResponder.panHandlers}
        >
          {/* Swipe indicators */}
          <Animated.View style={[styles.swipeLabel, styles.likeLabel, { opacity: likeOpacity }]}>
            <Text style={styles.swipeLabelText}>{t('swipe.like')}</Text>
          </Animated.View>
          <Animated.View style={[styles.swipeLabel, styles.nopeLabel, { opacity: nopeOpacity }]}>
            <Text style={[styles.swipeLabelText, { color: REJECT_COLOR }]}>{t('swipe.nope')}</Text>
          </Animated.View>

          {/* Photo */}
          {getPhotoUrl(restaurant) ? (
            <Image
              source={{ uri: getPhotoUrl(restaurant)! }}
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
              {restaurant.mood_tags && restaurant.mood_tags
                .filter((mood) => selectedMoods.includes(mood))
                .slice(0, 3)
                .map((mood) => (
                <View key={mood} style={styles.moodBadge}>
                  <Text style={styles.moodBadgeText}>{mood}</Text>
                </View>
              ))}
            </View>

            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>{t('swipe.whyForYou')}</Text>
              <Text style={styles.reasonText}>{restaurant.reason}</Text>
            </View>

            {restaurant.nlp_metrics?.primary_sentiment_nuances && restaurant.nlp_metrics.primary_sentiment_nuances.length > 0 && (
              <View style={styles.sentimentRow}>
                {restaurant.nlp_metrics.primary_sentiment_nuances.slice(0, 3).map((nuance: string) => (
                  <View key={nuance} style={styles.sentimentPill}>
                    <Text style={styles.sentimentPillText}>{nuance}</Text>
                  </View>
                ))}
              </View>
            )}
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
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  card: {
    flexShrink: 1,
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
    flexShrink: 1, // photo gives up space first on short screens
    minHeight: 140,
    width: "100%",
    resizeMode: "cover",
    backgroundColor: PHOTO_BG,
  },
  photoAttribution: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoAttributionText: {
    color: "#FFFFFF",
    fontSize: 9,
    opacity: 0.8,
  },
  infoSection: {
    flexShrink: 0, // text keeps its space; the photo shrinks instead
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
    marginBottom: 6,
  },
  sentimentRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  sentimentPill: {
    backgroundColor: "rgba(76, 175, 80, 0.10)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  sentimentPillText: {
    color: "#4CAF50",
    fontSize: 10,
    fontWeight: "600",
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
