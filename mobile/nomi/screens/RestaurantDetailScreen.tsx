import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { Colors } from "../theme/colors";
import { Restaurant } from "../services/restaurantService";
import { saveRestaurant, unsaveRestaurant } from "../services/swipeService";
import { useAuth } from "../context/AuthContext";

type DayHours = {
  day: string;
  hours: string;
  closed: boolean;
};

const MOCK_HOURS: DayHours[] = [
  { day: "Monday", hours: "Closed", closed: true },
  { day: "Tuesday", hours: "12:00 – 15:00, 19:00 – 23:00", closed: false },
  { day: "Wednesday", hours: "12:00 – 15:00, 19:00 – 23:00", closed: false },
  { day: "Thursday", hours: "12:00 – 15:00, 19:00 – 23:00", closed: false },
  { day: "Friday", hours: "12:00 – 15:00, 19:00 – 00:00", closed: false },
  { day: "Saturday", hours: "12:00 – 00:00", closed: false },
  { day: "Sunday", hours: "12:00 – 16:00", closed: false },
];

const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const PHOTO_BG = "#1A1A2E";
const REASON_BG = "#1A1830";
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const GREEN = "#2ECC71";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function budgetSymbol(level: number): string {
  return "\u20AC".repeat(level);
}

function getTodayIndex(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

type Props = {
  restaurant: Restaurant;
  onBack: () => void;
};

export default function RestaurantDetailScreen({ restaurant, onBack }: Props) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [validated, setValidated] = useState(false);
  const todayIndex = getTodayIndex();

  const handleBookmark = async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (saved) {
      await unsaveRestaurant(user.uid, restaurant.id);
      setSaved(false);
    } else {
      await saveRestaurant(user.uid, restaurant.id);
      setSaved(true);
    }
  };

  const openReserve = () => {
    Linking.openURL(`https://www.thefork.com/search?q=${encodeURIComponent(restaurant.name)}`);
  };

  const openDirections = () => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}`);
  };

  const openMenu = () => {
    Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(restaurant.name + " menu")}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Hero image */}
      <View style={styles.heroContainer}>
        {restaurant.photos && restaurant.photos.length > 0 ? (
          <Image
            source={{ uri: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${restaurant.photos[0].photo_reference}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}` }}
            style={styles.heroImage}
          />
        ) : (
          <View style={[styles.heroImage, { backgroundColor: '#E8E8E8' }]} />
        )}

        {/* Back button */}
        <SafeAreaView style={styles.backButtonContainer} edges={["top"]}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backIcon}>{"\u2190"}</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Bottom overlay: save button */}
        <View style={styles.heroOverlay}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleBookmark}
            accessibilityLabel={saved ? "Remove from saved" : "Save restaurant"}
            accessibilityRole="button"
          >
            <Text style={[styles.saveIcon, saved && { color: Colors.accent }]}>
              {saved ? "🔖" : "🔗"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Name + meta */}
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{restaurant.name}</Text>
            {restaurant.opening_hours?.is_open_monday !== false && (
              <View style={styles.openBadge}>
                <View style={styles.openDot} />
                <Text style={styles.openText}>Open</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta}>
            {[
              restaurant.noise_level || "moderate",
              "~20 min wait",
            ].join(" \u00B7 ")}
          </Text>
        </View>

        {/* Why for you */}
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>WHY FOR YOU?</Text>
          <Text style={styles.reasonText}>{restaurant.reason}</Text>
          <View style={styles.badgeRow}>
            {restaurant.mood_tags && restaurant.mood_tags.slice(0, 3).map((mood: string) => (
              <View key={mood} style={styles.moodBadge}>
                <Text style={styles.moodBadgeText}>{mood}</Text>
              </View>
            ))}
            <View style={styles.moodBadge}>
              <Text style={styles.moodBadgeText}>{budgetSymbol(restaurant.budget_level)}</Text>
            </View>
            {restaurant.distance && (
              <View style={styles.moodBadge}>
                <Text style={styles.moodBadgeText}>{restaurant.distance}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Opening hours */}
        <View style={styles.hoursContainer}>
          {MOCK_HOURS.map((entry, index) => {
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
                  {entry.day}
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

        {/* Actions 2x2 grid */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionButton} onPress={openReserve}>
            <Text style={styles.actionIcon}>{"\u{1F4C5}"}</Text>
            <Text style={styles.actionLabel}>Reserve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={openDirections}>
            <Text style={styles.actionIcon}>{"\u{1F5FA}"}</Text>
            <Text style={styles.actionLabel}>Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={openMenu}>
            <Text style={styles.actionIcon}>{"\u{1F4CB}"}</Text>
            <Text style={styles.actionLabel}>Menu</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
            <Text style={styles.actionIcon}>{"\u{1F465}"}</Text>
            <Text style={styles.actionLabel}>Share with group</Text>
          </TouchableOpacity>
        </View>

        {/* Validate strip */}
        <View style={styles.validateStrip}>
          {validated ? (
            <Text style={styles.validateDone}>{"\u2714"} Thanks! +5 pts</Text>
          ) : (
            <TouchableOpacity style={styles.validateRow} onPress={() => setValidated(true)}>
              <Text style={styles.validateText}>
                Is this place {restaurant.mood_tags?.[0] || "good"}?
              </Text>
              <View style={styles.validatePoints}>
                <Text style={styles.validatePointsText}>+5 pts</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
  heroImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    backgroundColor: PHOTO_BG,
  },
  backButtonContainer: {
    position: "absolute",
    top: 0,
    left: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  backIcon: {
    color: TEXT_PRIMARY,
    fontSize: 20,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  saveIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    justifyContent: "space-between",
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
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
  },
  actionIcon: {
    fontSize: 20,
  },
  actionLabel: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: "600",
  },
  validateStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  },
});
