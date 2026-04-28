import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const ACCENT = "#7F77DD";
const BG = "#0D0D0D";
const CARD_BG = "#1A1A1A";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#888888";
const HIGHLIGHT_BG = "#1A1830";
const GOLD = "#FFD700";
const SILVER = "#C0C0C0";
const BRONZE = "#CD7F32";

type LeaderboardEntry = {
  rank: number;
  name: string;
  points: number;
  badges: number;
  isCurrentUser: boolean;
};

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "Maria S.", points: 1240, badges: 8, isCurrentUser: false },
  { rank: 2, name: "Jo\u00E3o M.", points: 980, badges: 6, isCurrentUser: false },
  { rank: 3, name: "Ana P.", points: 756, badges: 5, isCurrentUser: false },
  { rank: 4, name: "Duygu B.", points: 340, badges: 3, isCurrentUser: true },
  { rank: 5, name: "Carlos R.", points: 290, badges: 2, isCurrentUser: false },
  { rank: 6, name: "Sofia L.", points: 245, badges: 2, isCurrentUser: false },
  { rank: 7, name: "Miguel F.", points: 198, badges: 1, isCurrentUser: false },
  { rank: 8, name: "Beatriz C.", points: 167, badges: 1, isCurrentUser: false },
  { rank: 9, name: "Tiago N.", points: 134, badges: 1, isCurrentUser: false },
  { rank: 10, name: "In\u00EAs V.", points: 98, badges: 0, isCurrentUser: false },
];

type Scope = "Friends" | "Lisbon" | "Global";

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Resetting...";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("");
}

const MEDAL_COLORS = [GOLD, SILVER, BRONZE];

type Props = {
  onNavigate: (screen: string) => void;
};

export default function LeaderboardScreen({ onNavigate }: Props) {
  const [scope, setScope] = useState<Scope>("Lisbon");
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const tick = () => {
      const ms = getNextMonday().getTime() - Date.now();
      setCountdown(formatCountdown(ms));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const top3 = MOCK_LEADERBOARD.slice(0, 3);
  const rest = MOCK_LEADERBOARD.slice(3);

  // Podium order: 2nd, 1st, 3rd for visual layout
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const podiumHeights = [100, 130, 80];
  const podiumColors = [SILVER, GOLD, BRONZE];
  const podiumAvatarSizes = [52, 64, 48];
  const podiumRankLabels = ["2nd", "1st", "3rd"];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Header --- */}
        <Text style={styles.headerTitle}>This Week's Top Deciders</Text>
        <Text style={styles.cityName}>Lisbon {"\u{1F1F5}\u{1F1F9}"}</Text>
        <Text style={styles.countdown}>
          Resets in {countdown}
        </Text>

        {/* --- Scope Tabs --- */}
        <View style={styles.scopeRow}>
          {(["Friends", "Lisbon", "Global"] as Scope[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.scopeTab, scope === s && styles.scopeTabActive]}
              onPress={() => setScope(s)}
            >
              <Text
                style={[
                  styles.scopeTabText,
                  scope === s && styles.scopeTabTextActive,
                ]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* --- Podium --- */}
        <View style={styles.podiumContainer}>
          {podiumOrder.map((user, idx) => (
            <View key={user.rank} style={styles.podiumSlot}>
              {/* Crown for 1st */}
              {idx === 1 && (
                <Text style={styles.crown}>{"\u{1F451}"}</Text>
              )}
              <View
                style={[
                  styles.podiumAvatar,
                  {
                    width: podiumAvatarSizes[idx],
                    height: podiumAvatarSizes[idx],
                    borderRadius: podiumAvatarSizes[idx] / 2,
                    borderColor: podiumColors[idx],
                  },
                ]}
              >
                <Text
                  style={[
                    styles.podiumAvatarText,
                    { fontSize: podiumAvatarSizes[idx] * 0.35 },
                  ]}
                >
                  {getInitials(user.name)}
                </Text>
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>
                {user.name}
              </Text>
              <Text
                style={[styles.podiumPoints, { color: podiumColors[idx] }]}
              >
                {user.points} pts
              </Text>
              <View
                style={[
                  styles.podiumBar,
                  {
                    height: podiumHeights[idx],
                    backgroundColor: podiumColors[idx],
                  },
                ]}
              >
                <Text style={styles.podiumRank}>{podiumRankLabels[idx]}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* --- Rest of list (4-10) --- */}
        {rest.map((user) => (
          <View
            key={user.rank}
            style={[
              styles.listRow,
              user.isCurrentUser && styles.listRowHighlight,
            ]}
          >
            <Text style={styles.listRank}>{user.rank}</Text>
            <View style={styles.listAvatar}>
              <Text style={styles.listAvatarText}>
                {getInitials(user.name)}
              </Text>
            </View>
            <View style={styles.listInfo}>
              <Text
                style={[
                  styles.listName,
                  user.isCurrentUser && styles.listNameHighlight,
                ]}
              >
                {user.name}
                {user.isCurrentUser ? " (You)" : ""}
              </Text>
              <Text style={styles.listBadges}>
                {user.badges} badge{user.badges !== 1 ? "s" : ""}
              </Text>
            </View>
            <Text style={styles.listPoints}>{user.points} pts</Text>
          </View>
        ))}

        {/* --- Promo Banner --- */}
        <View style={styles.promoBanner}>
          <Text style={styles.promoText}>
            Win a free drink at our partner restaurants this week {"\u{1F379}"}
          </Text>
        </View>

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
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onNavigate("validate")}
        >
          <Text style={styles.tabIcon}>{"\u{1F50D}"}</Text>
          <Text style={styles.tabLabel}>Validate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onNavigate("group")}
        >
          <Text style={styles.tabIcon}>{"\u{1F465}"}</Text>
          <Text style={styles.tabLabel}>Group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={[styles.tabIcon, styles.tabActive]}>{"\u{1F3C6}"}</Text>
          <Text style={[styles.tabLabel, styles.tabActive]}>Ranking</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => onNavigate("profile")}
        >
          <Text style={styles.tabIcon}>{"\u{1F464}"}</Text>
          <Text style={styles.tabLabel}>Profile</Text>
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

  // --- Header ---
  headerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  cityName: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    textAlign: "center",
    marginTop: 4,
  },
  countdown: {
    color: ACCENT,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    fontWeight: "600",
  },

  // --- Scope Tabs ---
  scopeRow: {
    flexDirection: "row",
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 4,
    marginTop: 20,
    marginBottom: 24,
  },
  scopeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  scopeTabActive: {
    backgroundColor: ACCENT,
  },
  scopeTabText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "600",
  },
  scopeTabTextActive: {
    color: TEXT_PRIMARY,
  },

  // --- Podium ---
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  podiumSlot: {
    flex: 1,
    alignItems: "center",
  },
  crown: {
    fontSize: 28,
    marginBottom: 4,
  },
  podiumAvatar: {
    backgroundColor: CARD_BG,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  podiumAvatarText: {
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  podiumName: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  podiumPoints: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  podiumBar: {
    width: "80%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.25,
  },
  podiumRank: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "800",
  },

  // --- List ---
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  listRowHighlight: {
    backgroundColor: HIGHLIGHT_BG,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  listRank: {
    color: TEXT_SECONDARY,
    fontSize: 16,
    fontWeight: "700",
    width: 28,
    textAlign: "center",
  },
  listAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2A2A3A",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  listAvatarText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "600",
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listName: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "600",
  },
  listNameHighlight: {
    color: ACCENT,
  },
  listBadges: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 2,
  },
  listPoints: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },

  // --- Promo ---
  promoBanner: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    alignItems: "center",
  },
  promoText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
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
