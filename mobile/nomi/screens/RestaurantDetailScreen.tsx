import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Share,
  Alert,
  Dimensions,
  ScrollView,
  FlatList,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Colors } from "../theme/colors";
import { Restaurant, getPhotoUrl, resolveLocalized } from "../services/restaurantService";
import { saveRestaurant, unsaveRestaurant, isRestaurantSaved } from "../services/swipeService";
import { useAuth } from "../context/AuthContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type DayHours = {
  day: string;
  hours: string;
  closed: boolean;
};

// Display order is Monday-first (matches getTodayIndex); Google Places numbers
// days Sunday-first, so map each display slot to its Places day number.
const DAY_ORDER: { day: string; placesDay: number }[] = [
  { day: "monday", placesDay: 1 },
  { day: "tuesday", placesDay: 2 },
  { day: "wednesday", placesDay: 3 },
  { day: "thursday", placesDay: 4 },
  { day: "friday", placesDay: 5 },
  { day: "saturday", placesDay: 6 },
  { day: "sunday", placesDay: 0 },
];

type Period = Restaurant["opening_hours"]["periods"][number];

// Google Places encodes times as "HHMM" strings.
function formatTime(time: string): string {
  if (!/^\d{4}$/.test(time)) return time;
  return `${time.slice(0, 2)}:${time.slice(2)}`;
}

// Build the week's opening hours from the Places periods stored on the
// restaurant. Returns null when the place has no hours data, so the caller can
// hide the section rather than show invented times.
function buildWeekHours(
  periods: Period[] | undefined,
  closedLabel: string,
  open24Label: string
): DayHours[] | null {
  if (!Array.isArray(periods) || periods.length === 0) return null;

  // A lone open-at-00:00 period with no close means the place never shuts.
  const alwaysOpen =
    periods.length === 1 && !periods[0]?.close && periods[0]?.open?.time === "0000";

  return DAY_ORDER.map(({ day, placesDay }) => {
    if (alwaysOpen) return { day, hours: open24Label, closed: false };

    const ranges = periods
      .filter((p) => p?.open?.day === placesDay && p?.open?.time)
      .map((p) =>
        p.close?.time
          ? `${formatTime(p.open.time)} \u2013 ${formatTime(p.close.time)}`
          : `${formatTime(p.open.time)} \u2013 ${open24Label}`
      );

    return ranges.length > 0
      ? { day, hours: ranges.join(", "), closed: false }
      : { day, hours: closedLabel, closed: true };
  });
}

const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const PHOTO_BG = "#1A1A2E";
const REASON_BG = "#1A1830";
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const GREEN = "#2ECC71";

function budgetSymbol(level: number): string {
  return "\u20AC".repeat(level);
}

function getTodayIndex(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

type Props = {
  restaurant: Restaurant;
  selectedMoods: string[];
  previousScreen: string;
  onBack: () => void;
};

export default function RestaurantDetailScreen({ restaurant, selectedMoods, onBack }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [validated, setValidated] = useState(false);

  // B-13: reflect whether this place is already saved when the screen opens.
  React.useEffect(() => {
    let active = true;
    if (user) {
      isRestaurantSaved(user.uid, restaurant.id).then((s) => {
        if (active) setSaved(s);
      });
    }
    return () => {
      active = false;
    };
  }, [user, restaurant.id]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const todayIndex = getTodayIndex();
  const weekHours = React.useMemo(
    () =>
      buildWeekHours(
        restaurant.opening_hours?.periods,
        t("restaurantDetail.closed"),
        t("restaurantDetail.open24h")
      ),
    [restaurant.opening_hours?.periods, t]
  );
  const photos = (restaurant.photos || []).slice(0, 3);

  const onViewRef = React.useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentPhotoIndex(viewableItems[0].index);
    }
  });
  const viewConfigRef = React.useRef({ viewAreaCoveragePercentThreshold: 50 });

  const handleBookmark = async () => {
    // Saving requires an authenticated user (incl. guest). If there is none —
    // e.g. anonymous sign-in failed — tell the user instead of silently no-op.
    if (!user) {
      Alert.alert(
        t('common.error') ?? 'Error',
        'Please sign in to save places.',
        [{ text: t('common.ok') ?? 'OK' }]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic toggle, reverted if the write fails.
    const next = !saved;
    setSaved(next);
    try {
      if (next) {
        await saveRestaurant(user.uid, restaurant.id);
      } else {
        await unsaveRestaurant(user.uid, restaurant.id);
      }
    } catch (error) {
      console.error('handleBookmark error:', error);
      setSaved(!next); // revert
      Alert.alert(
        t('common.error') ?? 'Error',
        'Could not update saved places. Please try again.',
        [{ text: t('common.ok') ?? 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header — same pattern as SwipeScreen */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={onBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>{"←"} {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.counterText}>
          {photos.length > 1 ? `${currentPhotoIndex + 1} / ${photos.length}` : ""}
        </Text>
        <View style={styles.headerSide} />
      </View>

      {/* Hero image carousel */}
      <View style={styles.heroContainer}>
        {photos.length > 0 ? (
          <>
            <FlatList
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => index.toString()}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              onViewableItemsChanged={onViewRef.current}
              viewabilityConfig={viewConfigRef.current}
              renderItem={({ item: photo, index }) => {
                const photoUrl = getPhotoUrl(restaurant, index);
                return (
                  <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.32 }}>
                    {photoUrl && (
                      <ExpoImage
                        source={{ uri: photoUrl }}
                        style={styles.heroImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={150}
                      />
                    )}
                  </View>
                );
              }}
              style={styles.photoScroll}
            />
            <View style={styles.photoAttribution}>
              <Text style={styles.photoAttributionText}>Photo from Google</Text>
            </View>
            {photos.length > 1 && (
              <View style={styles.photoPagination}>
                {photos.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      index === currentPhotoIndex && styles.paginationDotActive
                    ]}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={[styles.heroImage, { backgroundColor: '#E8E8E8' }]} />
        )}

        {/* Bottom overlay: save button (B-13: clear, labelled save action) */}
        <View style={styles.heroOverlay}>
          <TouchableOpacity
            style={[styles.saveButton, saved && styles.saveButtonActive]}
            onPress={handleBookmark}
            accessibilityLabel={saved ? "Remove from saved" : "Save restaurant"}
            accessibilityRole="button"
            accessibilityState={{ selected: saved }}
          >
            <Text style={[styles.saveIcon, saved && { color: "#FFFFFF" }]}>
              {"\u{1F516}"}
            </Text>
            <Text style={[styles.saveLabel, saved && { color: "#FFFFFF" }]}>
              {saved ? t('restaurantDetail.saved') : t('restaurantDetail.save')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Name + meta */}
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{restaurant.name}</Text>
            {restaurant.opening_hours?.is_open_monday !== false && (
              <View style={styles.openBadge}>
                <View style={styles.openDot} />
                <Text style={styles.openText}>{t('common.open')}</Text>
              </View>
            )}
          </View>

          {/* Rating + Reviews */}
          {restaurant.google_rating > 0 && restaurant.place_id && (
            <TouchableOpacity
              style={styles.ratingRow}
              onPress={() => {
                // Open Google Maps place page - reviews are prominently displayed
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}&query_place_id=${restaurant.place_id}`;
                Linking.openURL(url);
              }}
              accessibilityLabel={`Google rating ${restaurant.google_rating}, tap to view reviews`}
              accessibilityRole="button"
            >
              <Text style={styles.ratingStars}>
                {'⭐'.repeat(Math.round(restaurant.google_rating))}
              </Text>
              <Text style={styles.ratingScore}>{restaurant.google_rating.toFixed(1)}</Text>
              <Text style={styles.ratingLink}>· {t('restaurantDetail.seeReviews')}</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.meta}>
            {[
              restaurant.noise_level || "moderate",
              "~20 min wait",
            ].join(" \u00B7 ")}
          </Text>
        </View>

        {/* What Guests Say — NLP summary + sentiment nuances */}
        {resolveLocalized(restaurant.nlp_insights?.general_summary) && (
          <View style={styles.nlpCard}>
            <View style={styles.nlpCardHeader}>
              <Text style={styles.nlpCardLabel}>{t('restaurantDetail.nlp.whatGuestsSay')}</Text>
              {restaurant.nlp_review_count != null && (
                <Text style={styles.nlpReviewCount}>
                  {t('restaurantDetail.nlp.basedOnReviews', { count: restaurant.nlp_review_count })}
                </Text>
              )}
            </View>
            <Text style={styles.nlpSummary}>"{resolveLocalized(restaurant.nlp_insights?.general_summary)}"</Text>
            {restaurant.nlp_metrics?.most_frequent_emotion && (
              <Text style={styles.nlpEmotion}>
                {t('restaurantDetail.nlp.overallFeel', { emotion: restaurant.nlp_metrics.most_frequent_emotion })}
              </Text>
            )}
          </View>
        )}

        {/* What People Love — short badges (love_tags), falls back to long text */}
        {(() => {
          const raw = restaurant.love_tags?.length
            ? restaurant.love_tags
            : resolveLocalized<string[]>(restaurant.nlp_insights?.food_admiration) || [];
          const items = raw.filter((s: string) => s && s.trim() && !['N/A', 'n/a', 'null', 'None'].includes(s.trim()));
          return items.length > 0 ? (
            <View style={styles.nlpSection}>
              <Text style={styles.nlpSectionLabel}>{t('restaurantDetail.nlp.whatPeopleLove')}</Text>
              <View style={styles.nlpPillRow}>
                {items.map((item: string) => (
                  <View key={item} style={styles.foodPill}>
                    <Text style={styles.foodPillText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null;
        })()}

        {/* Heads Up — short badges (watch_tags), falls back to long text */}
        {(() => {
          const raw = restaurant.watch_tags?.length
            ? restaurant.watch_tags
            : resolveLocalized<string[]>(restaurant.nlp_insights?.negative_aspects) || [];
          const items = raw.filter((s: string) => s && s.trim() && !['N/A', 'n/a', 'null', 'None'].includes(s.trim()));
          return items.length > 0 ? (
            <View style={styles.nlpSection}>
              <Text style={styles.nlpSectionLabelNeutral}>{t('restaurantDetail.nlp.headsUp')}</Text>
              <View style={styles.nlpPillRow}>
                {items.map((item: string) => (
                  <View key={item} style={styles.headsUpPill}>
                    <Text style={styles.headsUpPillText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null;
        })()}

        {/* Opening hours — omitted entirely when the place has no hours data */}
        {weekHours && (
        <View style={styles.hoursContainer}>
          {weekHours.map((entry, index) => {
            const isToday = index === todayIndex;
            return (
              <View key={entry.day} style={[styles.hoursRow, isToday && styles.hoursRowToday]}>
                <Text
                  style={[
                    styles.hoursDay,
                    entry.closed && styles.hoursClosed,
                    isToday && styles.hoursTodayText,
                  ]}
                >
                  {t(`restaurantDetail.days.${entry.day}`)}
                </Text>
                <Text
                  style={[
                    styles.hoursTime,
                    entry.closed && styles.hoursClosed,
                    isToday && styles.hoursTodayText,
                  ]}
                >
                  {entry.hours}
                </Text>
              </View>
            );
          })}
        </View>
        )}

        {/* Actions grid */}
        <View style={styles.actionsGrid}>
          {[
            {
              id: 'call',
              icon: '📞',
              label: t('restaurantDetail.actions.call') ?? 'Call',
              show: true,
              onPress: () => {
                if (restaurant.phone) {
                  Linking.openURL(`tel:${restaurant.phone}`);
                } else {
                  Alert.alert(
                    t('common.error') ?? 'Error',
                    'No phone number available for this restaurant',
                    [{ text: t('common.ok') ?? 'OK' }]
                  );
                }
              },
            },
            {
              id: 'directions',
              icon: '🗺️',
              label: t('restaurantDetail.actions.directions') ?? 'Directions',
              show: true,
              onPress: () => {
                // Use place_id for accurate directions - format: destination with place_id
                let url;
                if (restaurant.place_id) {
                  // Use restaurant name as destination with place_id for accuracy
                  url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurant.name)}&destination_place_id=${restaurant.place_id}`;
                } else if (restaurant.location?.lat && restaurant.location?.lng) {
                  url = `https://www.google.com/maps/dir/?api=1&destination=${restaurant.location.lat},${restaurant.location.lng}`;
                } else {
                  // Fallback to search
                  url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}`;
                }
                Linking.openURL(url);
              },
            },
            {
              id: 'website',
              icon: restaurant.website ? '🌐' : '📋',
              label: restaurant.website
                ? (t('restaurantDetail.actions.website') ?? 'Website')
                : (t('restaurantDetail.actions.menu') ?? 'Menu'),
              show: true,
              onPress: () => {
                if (restaurant.website) {
                  Linking.openURL(restaurant.website);
                } else {
                  // Search for menu on Google if no website
                  const menuUrl = `https://www.google.com/search?q=${encodeURIComponent(restaurant.name + ' menu')}`;
                  Linking.openURL(menuUrl);
                }
              },
            },
            {
              id: 'share',
              icon: '📤',
              label: t('restaurantDetail.actions.share') ?? 'Share',
              show: true,
              onPress: async () => {
                try {
                  await Share.share({
                    message: `${restaurant.name}\n📍 ${restaurant.address}\n⭐ ${restaurant.google_rating}\n\nFound on Nomi 🍽️`,
                    title: restaurant.name,
                  });
                } catch (error: any) {
                  // Ignore "Share canceled" error - it's expected when user cancels
                  if (error.message !== 'Share canceled') {
                    console.error('Share error:', error);
                  }
                }
              },
            },
          ]
            .filter(a => a.show)
            .map(action => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionButton}
                onPress={action.onPress}
                accessibilityLabel={action.label}
                accessibilityRole="button"
              >
                <Text style={styles.actionIcon}>{action.icon}</Text>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
        </View>

        {/* Mood Validation - Personalized question based on restaurant's mood or default to 'chill' */}
        <View style={styles.validateStrip}>
          {validated ? (
            <Text style={styles.validateDone}>{"\u2714"} Thanks! +5 pts</Text>
          ) : (
            <TouchableOpacity
              style={styles.validateRow}
              onPress={() => setValidated(true)}
              accessibilityLabel={`Validate if this place is ${restaurant.mood_tags?.[0] || 'chill'}`}
              accessibilityRole="button"
            >
              <Text style={styles.validateText}>
                {t('restaurantDetail.validateMood', {
                  mood: restaurant.mood_tags?.[0] || 'chill'
                })}
              </Text>
              <View style={styles.validatePoints}>
                <Text style={styles.validatePointsText}>+5 pts</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  heroContainer: {
    height: SCREEN_HEIGHT * 0.32,
    position: "relative",
  },
  photoScroll: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.32,
  },
  heroImage: {
    width: "100%",
    height: "100%",
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
  photoPagination: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  paginationDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerSide: {
    flex: 1,
  },
  backText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  counterText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  heroOverlay: {
    position: "absolute",
    bottom: 12,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  saveButtonActive: {
    backgroundColor: ACCENT,
  },
  saveIcon: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  saveLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  ratingStars: {
    fontSize: 12,
  },
  ratingScore: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  ratingLink: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '500',
  },
  openBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(46, 204, 113, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
    marginRight: 4,
  },
  openText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "600",
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  reasonBox: {
    backgroundColor: "rgba(224, 106, 79, 0.08)",
    borderRadius: 12,
    padding: 12,
  },
  reasonLabel: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reasonText: {
    color: Colors.textPrimary,
    fontSize: 13,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  moodBadge: {
    backgroundColor: "rgba(224, 106, 79, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  moodBadgeText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "600",
  },
  hoursContainer: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  hoursRowToday: {
    backgroundColor: "rgba(224, 106, 79, 0.08)",
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  hoursDay: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  hoursTime: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  hoursClosed: {
    color: Colors.textSecondary,
  },
  hoursTodayText: {
    color: Colors.accent,
    fontWeight: "600",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    width: "48%",
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    gap: 3,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: "600",
  },
  validateStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
  },
  validateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  validateText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  validatePoints: {
    backgroundColor: "rgba(224, 106, 79, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  validatePointsText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  validateDone: {
    color: GREEN,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
  nlpCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#F0F0F0",
  },
  nlpCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  nlpCardLabel: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  nlpReviewCount: {
    color: TEXT_SECONDARY,
    fontSize: 11,
  },
  nlpSummary: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 20,
    marginBottom: 10,
  },
  nlpEmotion: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    textAlign: "right",
  },
  nlpSection: {
    marginBottom: 12,
  },
  nlpSectionLabel: {
    color: TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  nlpSectionLabelNeutral: {
    color: TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  nlpPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  foodPill: {
    backgroundColor: "rgba(76, 175, 80, 0.10)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  foodPillText: {
    color: "#4CAF50",
    fontSize: 11,
    fontWeight: "600",
  },
  headsUpPill: {
    backgroundColor: "rgba(231, 76, 60, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  headsUpPillText: {
    color: "#C0392B",
    fontSize: 11,
    fontWeight: "600",
  },
});
