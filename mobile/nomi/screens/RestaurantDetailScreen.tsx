import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export type Restaurant = {
  id: string;
  name: string;
  distance: string;
  budget: number;
  moods: string[];
  reason: string;
  cuisine?: string;
  noiseLevel?: "quiet" | "moderate" | "loud";
  isOpenNow?: boolean;
};

type DayHours = {
  day: string;
  hours: string;
  closed: boolean;
};

const MOCK_HOURS: DayHours[] = [
  { day: "Monday", hours: "Closed", closed: true },
  { day: "Tuesday", hours: "12:00 \u2013 15:00, 19:00 \u2013 23:00", closed: false },
  { day: "Wednesday", hours: "12:00 \u2013 15:00, 19:00 \u2013 23:00", closed: false },
  { day: "Thursday", hours: "12:00 \u2013 15:00, 19:00 \u2013 23:00", closed: false },
  { day: "Friday", hours: "12:00 \u2013 15:00, 19:00 \u2013 00:00", closed: false },
  { day: "Saturday", hours: "12:00 \u2013 00:00", closed: false },
  { day: "Sunday", hours: "12:00 \u2013 16:00", closed: false },
];

const ACCENT = "#7F77DD";
const BG = "#0D0D0D";
const CARD_BG = "#1A1A1A";
const PHOTO_BG = "#1A1A2E";
const REASON_BG = "#1A1830";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#888888";
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
  const [saved, setSaved] = useState(false);
  const [validated, setValidated] = useState(false);
  const todayIndex = getTodayIndex();

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
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar style="light" />

      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <View style={styles.heroContainer}>
          <View style={styles.hero} />

          {/* Back button */}
          <SafeAreaView style={styles.backButtonContainer} edges={["top"]}>
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backIcon}>{"\u2190"}</Text>
            </TouchableOpacity>
          </SafeAreaView>

          {/* Bottom overlay: open badge + save */}
          <View style={styles.heroOverlay}>
            {restaurant.isOpenNow !== false && (
              <View style={styles.openBadge}>
                <View style={styles.openDot} />
                <Text style={styles.openText}>Open now</Text>
              </View>
            )}
            <TouchableOpacity style={styles.saveButton} onPress={() => setSaved(!saved)}>
              <Text style={styles.saveIcon}>{saved ? "\u{1F516}" : "\u{1F517}"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Name */}
          <Text style={styles.name}>{restaurant.name}</Text>

          {/* Meta line */}
          <Text style={styles.meta}>
            {[
              restaurant.cuisine || "Portuguese",
              restaurant.noiseLevel || "moderate",
              "~20 min wait",
            ].join(" \u00B7 ")}
          </Text>

          {/* Why for you */}
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Why for you?</Text>
            <Text style={styles.reasonText}>{restaurant.reason}</Text>
            <View style={styles.reasonTags}>
              {restaurant.moods.map((mood) => (
                <View key={mood} style={styles.reasonTag}>
                  <Text style={styles.reasonTagText}>{mood}</Text>
                </View>
              ))}
              <View style={styles.reasonTag}>
                <Text style={styles.reasonTagText}>{budgetSymbol(restaurant.budget)}</Text>
              </View>
              <View style={styles.reasonTag}>
                <Text style={styles.reasonTagText}>{restaurant.distance}</Text>
              </View>
            </View>
          </View>

          {/* Opening hours */}
          <Text style={styles.sectionTitle}>Opening Hours</Text>
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

          {/* Action buttons 2x2 */}
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={openReserve}>
              <Text style={styles.actionEmoji}>{"\u{1F4C5}"}</Text>
              <Text style={styles.actionLabel}>Reserve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={openDirections}>
              <Text style={styles.actionEmoji}>{"\u{1F5FA}"}</Text>
              <Text style={styles.actionLabel}>Directions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={openMenu}>
              <Text style={styles.actionEmoji}>{"\u{1F4CB}"}</Text>
              <Text style={styles.actionLabel}>Menu</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => {}}>
              <Text style={styles.actionEmoji}>{"\u{1F465}"}</Text>
              <Text style={styles.actionLabel}>Share with group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom validation strip */}
      <View style={styles.validateStrip}>
        {validated ? (
          <Text style={styles.validateDone}>{"\u2714"} Thanks! +5 pts</Text>
        ) : (
          <TouchableOpacity style={styles.validateRow} onPress={() => setValidated(true)}>
            <Text style={styles.validateQuestion}>
              Is this place {restaurant.moods[0] || "good"}?
            </Text>
            <View style={styles.validateBadge}>
              <Text style={styles.validateBadgeText}>+5 pts</Text>
            </View>
          </TouchableOpacity>
        )}
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
    height: SCREEN_HEIGHT * 0.4,
    position: "relative",
  },
  hero: {
    flex: 1,
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
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  openBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  openDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
    marginRight: 6,
  },
  openText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: "600",
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
    padding: 20,
  },
  name: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
  },
  meta: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginBottom: 16,
  },
  reasonBox: {
    backgroundColor: REASON_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ACCENT,
    padding: 14,
    marginBottom: 24,
  },
  reasonLabel: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reasonText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  reasonTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  reasonTag: {
    backgroundColor: "rgba(127, 119, 221, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  reasonTagText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  hoursContainer: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  hoursRowToday: {
    backgroundColor: "rgba(127, 119, 221, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  hoursDay: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    width: 100,
  },
  hoursTime: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    textAlign: "right",
    flex: 1,
  },
  hoursClosed: {
    color: "#555555",
  },
  hoursTodayText: {
    color: ACCENT,
    fontWeight: "600",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    width: "47%",
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  actionLabel: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "600",
  },
  validateStrip: {
    backgroundColor: CARD_BG,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#222222",
  },
  validateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  validateQuestion: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    flex: 1,
  },
  validateBadge: {
    backgroundColor: "rgba(127, 119, 221, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 12,
  },
  validateBadgeText: {
    color: ACCENT,
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
