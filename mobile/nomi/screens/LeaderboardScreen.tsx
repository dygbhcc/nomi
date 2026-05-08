import { useTranslation } from "react-i18next";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../theme/colors";
import BottomNavigationBar from "../components/BottomNavigationBar";
import { getLeaderboard, getUserRank, LeaderboardEntry } from "../services/userService";
import { useAuth } from "../context/AuthContext";

const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const HIGHLIGHT_BG = "#1A1830";
const GOLD = "#FFD700";
const SILVER = "#C0C0C0";
const BRONZE = "#CD7F32";

type Scope = "Friends" | "Lisbon" | "Global";

type LeaderboardEntryWithRank = LeaderboardEntry & {
  rank: number;
  name: string;
  isCurrentUser: boolean;
};

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("Lisbon");
  const [countdown, setCountdown] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryWithRank[]>([]);
  const [userRank, setUserRank] = useState<number>(-1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tick = () => {
      const ms = getNextMonday().getTime() - Date.now();
      setCountdown(formatCountdown(ms));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [user]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const data = await getLeaderboard(10);

      // Add rank and mark current user
      const withRank: LeaderboardEntryWithRank[] = data.map((entry, index) => ({
        ...entry,
        rank: index + 1,
        name: entry.displayName,
        isCurrentUser: user ? entry.userId === user.uid : false,
      }));

      setLeaderboard(withRank);

      // Fetch user's rank if not in top 10
      if (user) {
        const rank = await getUserRank(user.uid);
        setUserRank(rank);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
        <BottomNavigationBar activeTab="ranking" onNavigate={onNavigate} />
      </SafeAreaView>
    );
  }

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  // Podium order: 2nd, 1st, 3rd for visual layout
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumHeights = [100, 130, 80];
  const podiumColors = [SILVER, GOLD, BRONZE];
  const podiumAvatarSizes = [52, 64, 48];
  const podiumRankLabels = ["2nd", "1st", "3rd"];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Header --- */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => onNavigate("mood")}
            style={styles.homeButton}
            accessibilityLabel="Back to home"
            accessibilityRole="button"
          >
            <Text style={styles.homeButtonText}>{"\u2190"} {t('tabs.home')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>{t('leaderboard.weeklyTitle')}</Text>
        <Text style={styles.cityName}>{t('settings.preferences.cities.lisbon')}</Text>
        <Text style={styles.countdown}>
          {t('leaderboard.resetsIn', { time: countdown })}
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
                {t(`leaderboard.scopes.${s.toLowerCase()}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* --- Podium --- */}
        {top3.length >= 3 && (
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
                  {t('leaderboard.points', { points: user.points })}
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
                  <Text style={styles.podiumRank}>{t(`leaderboard.podium.${podiumRankLabels[idx]}`)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

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
                {user.isCurrentUser ? ` (${t('leaderboard.you')})` : ""}
              </Text>
              <Text style={styles.listBadges}>
                {t('leaderboard.badgeCount', { count: user.badges })}
              </Text>
            </View>
            <Text style={styles.listPoints}>{t('leaderboard.points', { points: user.points })}</Text>
          </View>
        ))}

        {/* --- Promo Banner --- */}
        <View style={styles.promoBanner}>
          <Text style={styles.promoText}>
            {t('leaderboard.promoMessage')}
          </Text>
        </View>

        {/* spacer for tab bar */}
        <View style={{ height: 80 }} />
      </ScrollView>

      <BottomNavigationBar activeTab="ranking" onNavigate={onNavigate} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  // --- Header ---
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
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
  headerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 8,
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
    backgroundColor: Colors.stepInactive,
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
});
