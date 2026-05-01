import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
  ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../theme/colors";
import BottomNavigationBar from "../components/BottomNavigationBar";

const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;

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

// FIX 8 - Proper type instead of any
type SavedRestaurant = {
  id: string;
  name: string;
  distance: string;
  budget: number;
  photo?: ImageSourcePropType;
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
  {
    id: "1",
    name: "Taberna da Rua das Flores",
    distance: "0.3 km",
    budget: 2,
    photo: require("../assets/images/restaurants/taberna-rua-das-flores.jpg")
  },
  {
    id: "3",
    name: "Cantinho do Avillez",
    distance: "1.2 km",
    budget: 3,
    photo: require("../assets/images/restaurants/catinho.jpg")
  },
  {
    id: "2",
    name: "ZeroZero",
    distance: "0.8 km",
    budget: 2,
    photo: require("../assets/images/restaurants/zerozero.jpg")
  },
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
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Header with Home and Settings --- */}
        <View style={styles.settingsRow}>
          <TouchableOpacity
            onPress={() => onNavigate("mood")}
            style={styles.homeButton}
            accessibilityLabel="Back to home"
            accessibilityRole="button"
          >
            <Text style={styles.homeButtonText}>{"\u2190"} Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onNavigate("settings")}
            style={styles.settingsButton}
            accessibilityLabel="Open settings"
            accessibilityRole="button"
            accessibilityHint="Manage your account settings"
          >
            <Text style={styles.settingsIcon}>{"\u2699\uFE0F"}</Text>
          </TouchableOpacity>
        </View>

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
        {user.savedRestaurants.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.savedRow}
          >
            {user.savedRestaurants.map((r: SavedRestaurant) => (
              <View key={r.id} style={styles.savedCard}>
                {r.photo ? (
                  <Image source={r.photo} style={styles.savedPhoto} resizeMode="cover" />
                ) : (
                  <View style={[styles.savedPhoto, { backgroundColor: "#1A1A2E" }]}>
                    <Text style={styles.savedPhotoText}>
                      {r.name.charAt(0)}
                    </Text>
                  </View>
                )}
                <Text style={styles.savedName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.savedMeta}>
                  {r.distance} · {budgetSymbol(r.budget)}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🍽️</Text>
            <Text style={styles.emptyStateTitle}>No saved restaurants yet</Text>
            <Text style={styles.emptyStateSubtext}>Start swiping to save your favorites!</Text>
          </View>
        )}

        {/* spacer for tab bar */}
        <View style={{ height: 80 }} />
      </ScrollView>

      <BottomNavigationBar activeTab="profile" onNavigate={onNavigate} />
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

  // --- Settings ---
  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  homeButton: {
    padding: 10,
    minHeight: 44,
  },
  homeButtonText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: "600",
  },
  settingsButton: {
    // FIX 6 - Touch target minimum
    padding: 10,
    minHeight: 44,
    minWidth: 44,
  },
  settingsIcon: {
    fontSize: 22,
  },

  // --- Profile ---
  profileSection: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarText: {
    color: TEXT_PRIMARY,
    fontSize: 26,
    fontWeight: "700",
  },
  displayName: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
  },
  memberSince: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    marginTop: 3,
  },
  totalPoints: {
    color: ACCENT,
    fontSize: 36,
    fontWeight: "800",
    marginTop: 12,
  },
  pointsLabel: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    marginTop: -4,
  },

  // --- Level ---
  levelSection: {
    marginTop: 16,
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
    backgroundColor: Colors.stepInactive,
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
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  badgeCardLocked: {
    opacity: 0.45,
  },
  badgeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  grayscale: {
    opacity: 0.6,
  },
  badgeName: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  badgeNameLocked: {
    color: TEXT_SECONDARY,
  },
  badgeCondition: {
    color: TEXT_SECONDARY,
    fontSize: 10,
    textAlign: "center",
    marginTop: 1,
  },
  badgeConditionLocked: {
    color: Colors.textSecondary,
  },

  // --- Saved Restaurants ---
  savedRow: {
    gap: 12,
    paddingRight: 20,
  },
  savedCard: {
    width: 160,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    overflow: "hidden",
  },
  savedPhoto: {
    height: 120,
    width: "100%",
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

  // FIX 4 - Empty state styles
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  emptyStateEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyStateTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    textAlign: 'center',
  },
});
