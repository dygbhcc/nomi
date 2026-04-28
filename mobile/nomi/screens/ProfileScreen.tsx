import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const ACCENT = "#7F77DD";
const BG = "#0D0D0D";
const CARD_BG = "#1A1A1A";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#888888";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// --- Level System ---
const LEVELS = [
  { level: 1, min: 0, max: 100, title: "Foodie Newbie" },
  { level: 2, min: 100, max: 300, title: "Taste Explorer" },
  { level: 3, min: 300, max: 600, title: "Mood Master" },
  { level: 4, min: 600, max: 1000, title: "Local Legend" },
  { level: 5, min: 1000, max: Infinity, title: "Hidden Gem Hunter" },
];

function getLevelInfo(points: number) {
  const level = LEVELS.find((l) => points >= l.min && points < l.max) || LEVELS[LEVELS.length - 1];
  const progress =
    level.max === Infinity
      ? 1
      : (points - level.min) / (level.max - level.min);
  return { ...level, progress };
}

// --- Badges ---
type Badge = {
  id: string;
  name: string;
  emoji: string;
  condition: string;
};

const ALL_BADGES: Badge[] = [
  { id: "romantic_scout", name: "Romantic Scout", emoji: "\u{1F490}", condition: "Pick 5 romantic spots" },
  { id: "hidden_gem_hunter", name: "Hidden Gem Hunter", emoji: "\u{1F48E}", condition: "Find 3 hidden gems" },
  { id: "pet_hero", name: "Pet Hero", emoji: "\u{1F43E}", condition: "Visit 3 pet-friendly places" },
  { id: "the_decider", name: "The Decider", emoji: "\u{1F451}", condition: "Win 5 group votes" },
  { id: "connector", name: "Connector", emoji: "\u{1F91D}", condition: "Create 3 group sessions" },
  { id: "local_expert", name: "Local Expert", emoji: "\u{1F4CD}", condition: "Rate 10 restaurants" },
  { id: "night_owl", name: "Night Owl", emoji: "\u{1F989}", condition: "Dine after 10pm 3 times" },
  { id: "trendsetter", name: "Trendsetter", emoji: "\u{1F525}", condition: "Be first to try 3 new spots" },
];

// --- Mock Data ---
const MOCK_SAVED_RESTAURANTS = [
  { id: "1", name: "Taberna da Rua das Flores", distance: "0.3 km", budget: 2 },
  { id: "3", name: "Cantinho do Avillez", distance: "1.2 km", budget: 3 },
  { id: "4", name: "A Cevicheria", distance: "0.5 km", budget: 3 },
];

const MOCK_USER = {
  name: "Duygu B.",
  points: 340,
  memberSince: "March 2026",
  badges: ["romantic_scout", "the_decider"],
  savedRestaurants: MOCK_SAVED_RESTAURANTS,
};

function budgetSymbol(level: number): string {
  return "\u20AC".repeat(level);
}

type Props = {
  onNavigate: (screen: string) => void;
};

export default function ProfileScreen({ onNavigate }: Props) {
  const user = MOCK_USER;
  const levelInfo = getLevelInfo(user.points);
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Avatar & Info --- */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{user.name}</Text>
          <Text style={styles.memberSince}>
            Member since {user.memberSince}
          </Text>
          <Text style={styles.totalPoints}>{user.points}</Text>
          <Text style={styles.pointsLabel}>total points</Text>
        </View>

        {/* --- Level Progress --- */}
        <View style={styles.levelSection}>
          <View style={styles.levelRow}>
            <Text style={styles.levelTitle}>
              Level {levelInfo.level} — {levelInfo.title}
            </Text>
            {levelInfo.max !== Infinity && (
              <Text style={styles.levelPts}>
                {user.points}/{levelInfo.max} pts
              </Text>
            )}
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(levelInfo.progress * 100, 100)}%` },
              ]}
            />
          </View>
          {levelInfo.level < 5 && (
            <Text style={styles.nextLevel}>
              Next: Level {levelInfo.level + 1} —{" "}
              {LEVELS[levelInfo.level].title}
            </Text>
          )}
        </View>

        {/* --- Badges --- */}
        <Text style={styles.sectionTitle}>Badges</Text>
        <View style={styles.badgeGrid}>
          {ALL_BADGES.map((badge) => {
            const earned = user.badges.includes(badge.id);
            return (
              <View
                key={badge.id}
                style={[styles.badgeCard, !earned && styles.badgeCardLocked]}
              >
                <Text style={[styles.badgeEmoji, !earned && styles.grayscale]}>
                  {earned ? badge.emoji : "\u{1F512}"}
                </Text>
                <Text
                  style={[
                    styles.badgeName,
                    !earned && styles.badgeNameLocked,
                  ]}
                  numberOfLines={1}
                >
                  {badge.name}
                </Text>
                <Text
                  style={[
                    styles.badgeCondition,
                    !earned && styles.badgeConditionLocked,
                  ]}
                  numberOfLines={2}
                >
                  {badge.condition}
                </Text>
              </View>
            );
          })}
        </View>

        {/* --- Saved Restaurants --- */}
        <Text style={styles.sectionTitle}>Saved Restaurants</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.savedRow}
        >
          {user.savedRestaurants.map((r) => (
            <View key={r.id} style={styles.savedCard}>
              <View style={styles.savedPhoto}>
                <Text style={styles.savedPhotoText}>
                  {r.name.charAt(0)}
                </Text>
              </View>
              <Text style={styles.savedName} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.savedMeta}>
                {r.distance} · {budgetSymbol(r.budget)}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* spacer for tab bar */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* --- Bottom Tab Bar --- */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onNavigate("mood")}
        >
          <Text style={styles.tabIcon}>{"\u{1F3E0}"}</Text>
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabIcon}>{"\u{1F50D}"}</Text>
          <Text style={styles.tabLabel}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onNavigate("group")}
        >
          <Text style={styles.tabIcon}>{"\u{1F465}"}</Text>
          <Text style={styles.tabLabel}>Group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab]}>
          <Text style={[styles.tabIcon, styles.tabActive]}>{"\u{1F464}"}</Text>
          <Text style={[styles.tabLabel, styles.tabActive]}>Profile</Text>
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
  scrollContent: {
    paddingHorizontal: 20,
  },

  // --- Profile ---
  profileSection: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: TEXT_PRIMARY,
    fontSize: 32,
    fontWeight: "700",
  },
  displayName: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "700",
  },
  memberSince: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginTop: 4,
  },
  totalPoints: {
    color: ACCENT,
    fontSize: 48,
    fontWeight: "800",
    marginTop: 16,
  },
  pointsLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginTop: -4,
  },

  // --- Level ---
  levelSection: {
    marginTop: 24,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
  },
  levelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  levelTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "600",
  },
  levelPts: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#2A2A2A",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8,
    backgroundColor: ACCENT,
    borderRadius: 4,
  },
  nextLevel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 8,
  },

  // --- Badges ---
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 12,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  badgeCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  badgeCardLocked: {
    opacity: 0.45,
  },
  badgeEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  grayscale: {
    opacity: 0.6,
  },
  badgeName: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  badgeNameLocked: {
    color: TEXT_SECONDARY,
  },
  badgeCondition: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
  badgeConditionLocked: {
    color: "#555",
  },

  // --- Saved Restaurants ---
  savedRow: {
    gap: 12,
    paddingRight: 20,
  },
  savedCard: {
    width: 140,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    overflow: "hidden",
  },
  savedPhoto: {
    height: 80,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
  },
  savedPhotoText: {
    color: ACCENT,
    fontSize: 28,
    fontWeight: "700",
  },
  savedName: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  savedMeta: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 2,
  },

  // --- Tab Bar ---
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "#111111",
    borderTopWidth: 1,
    borderTopColor: "#222",
    paddingBottom: 28,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: "center",
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  tabLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "500",
  },
  tabActive: {
    color: ACCENT,
  },
});
