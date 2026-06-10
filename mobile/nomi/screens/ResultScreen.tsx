import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  Image,
  ImageSourcePropType,
  Linking,
  Alert,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Colors } from "../theme/colors";

const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Restaurant = {
  id: string;
  name: string;
  distance: string;
  budget: number;
  moods: string[];
  reason: string;
  photo?: ImageSourcePropType;
  phone?: string;
  website?: string;
  place_id?: string;
  address?: string;
  google_rating?: number;
  location?: { lat: number; lng: number };
};

type Props = {
  restaurant: Restaurant;
  totalVoters: number;
  likedBy: number;
  roomCode: string;
  onStartOver: () => void;
  onNavigate: (screen: string) => void;
};

function budgetSymbol(level: number): string {
  return "\u20AC".repeat(level);
}

// --- Confetti Particle ---
const CONFETTI_COLORS = ["#E06A4F", "#FFD700", "#E74C3C", "#2ECC71", "#3498DB", "#F39C12", "#FF8A3D"];
const PARTICLE_COUNT = 40;

function ConfettiAnimation() {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: new Animated.Value(Math.random() * SCREEN_WIDTH),
      y: new Animated.Value(-20 - Math.random() * 60),
      rotate: new Animated.Value(0),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 6,
      delay: Math.random() * 800,
    }))
  ).current;

  useEffect(() => {
    particles.forEach((p) => {
      const duration = 2000 + Math.random() * 1500;
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.y, {
            toValue: 800,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(p.x, {
            toValue: (p.x as any)._value + (Math.random() - 0.5) * 120,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(p.rotate, {
            toValue: 4 + Math.random() * 4,
            duration,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, []);

  return (
    <View style={confettiStyles.container} pointerEvents="none">
      {particles.map((p, i) => {
        const spin = p.rotate.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        });
        return (
          <Animated.View
            key={i}
            style={[
              confettiStyles.particle,
              {
                width: p.size,
                height: p.size * 1.5,
                backgroundColor: p.color,
                borderRadius: p.size * 0.3,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { rotate: spin },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const confettiStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    overflow: "hidden",
  },
  particle: {
    position: "absolute",
  },
});

export default function ResultScreen({
  restaurant,
  totalVoters,
  likedBy,
  roomCode,
  onStartOver,
  onNavigate,
}: Props) {
  const { t } = useTranslation();
  // Trophy scale-in animation
  const trophyScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Trophy bounce in
    Animated.spring(trophyScale, {
      toValue: 1,
      tension: 50,
      friction: 5,
      useNativeDriver: true,
      delay: 300,
    }).start();

  }, []);

  // Voter avatar dots
  const voterDots = Array.from({ length: totalVoters }, (_, i) => i);
  const AVATAR_COLORS = ["#C25A41", "#E06A4F", "#B54F3A", "#FF8A3D"];

  // Same actions as RestaurantDetailScreen so behavior stays consistent
  const actions = [
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
            message: `${restaurant.name}\n📍 ${restaurant.address ?? ''}\n⭐ ${restaurant.google_rating ?? ''}\n\nFound on Nomi 🍽️`,
            title: restaurant.name,
          });
        } catch (error: any) {
          // Ignore "Share canceled" error - it's expected when user cancels
          if (error.message !== 'Share canceled') {
            __DEV__ && console.error('Share error:', error);
          }
        }
      },
    },
  ];

  const handleStartOver = () => {
    Alert.alert(
      t('result.shareTitle'),
      t('result.shareMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), style: 'destructive', onPress: onStartOver },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ConfettiAnimation />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Trophy --- */}
        <Animated.View
          style={[
            styles.trophyContainer,
            { transform: [{ scale: trophyScale }] },
          ]}
        >
          <Text style={styles.trophyIcon}>{"\u2713"}</Text>
        </Animated.View>

        <Text style={styles.title}>
          {t('result.title')}
        </Text>

        {/* --- Winner Card --- */}
        <View style={styles.winnerCard}>
          {restaurant.photo ? (
            <Image source={restaurant.photo} style={styles.winnerPhoto} resizeMode="cover" />
          ) : (
            <View style={styles.winnerPhotoPlaceholder}>
              <Text style={styles.winnerPhotoText}>
                {restaurant.name.charAt(0)}
              </Text>
            </View>
          )}

          <View style={styles.winnerInfo}>
            <Text style={styles.winnerName}>{restaurant.name}</Text>

            <View style={styles.moodRow}>
              {restaurant.moods.map((mood) => (
                <View key={mood} style={styles.moodBadge}>
                  <Text style={styles.moodBadgeText}>{mood}</Text>
                </View>
              ))}
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{restaurant.distance}</Text>
              <Text style={styles.metaDot}>{"\u00B7"}</Text>
              <Text style={styles.metaText}>
                {budgetSymbol(restaurant.budget)}
              </Text>
            </View>

            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>{t('swipe.whyForYou')}</Text>
              <Text style={styles.reasonText}>{restaurant.reason}</Text>
            </View>
          </View>
        </View>

        {/* --- Vote Summary --- */}
        <View style={styles.voteSummary}>
          <View style={styles.voterDots}>
            {voterDots.map((i) => (
              <View
                key={i}
                style={[
                  styles.voterDot,
                  {
                    backgroundColor:
                      i < likedBy
                        ? AVATAR_COLORS[i % AVATAR_COLORS.length]
                        : Colors.stepInactive,
                    marginLeft: i > 0 ? -6 : 0,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.voteText}>
            {t('result.voteSummary', { likedBy, totalVoters })}
          </Text>
        </View>

        {/* --- Action Buttons 2x2 grid (same as RestaurantDetailScreen) --- */}
        <View style={styles.actionsGrid}>
          {actions
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

        <TouchableOpacity style={styles.textButton} onPress={handleStartOver}>
          <Text style={styles.textButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>


        <View style={{ height: 40 }} />
      </ScrollView>
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
    alignItems: "center",
    paddingTop: 24,
  },

  // --- Trophy ---
  trophyContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  trophyIcon: {
    color: TEXT_PRIMARY,
    fontSize: 40,
    fontWeight: "800",
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },

  // --- Winner Card ---
  winnerCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: ACCENT,
    overflow: "hidden",
    width: "100%",
    marginBottom: 16,
  },
  winnerPhoto: {
    width: "100%",
    height: 200,
  },
  winnerPhotoPlaceholder: {
    height: 200,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
  },
  winnerPhotoText: {
    color: ACCENT,
    fontSize: 48,
    fontWeight: "700",
    opacity: 0.4,
  },
  winnerInfo: {
    padding: 16,
  },
  winnerName: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  moodRow: {
    flexDirection: "row",
    gap: 8,
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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
  reasonBox: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    padding: 12,
  },
  reasonLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reasonText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "500",
  },

  // --- Vote Summary ---
  voteSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: "100%",
    marginBottom: 24,
  },
  voterDots: {
    flexDirection: "row",
    marginRight: 12,
  },
  voterDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: CARD_BG,
  },
  voteText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    flex: 1,
  },

  // --- Action Buttons Grid ---
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
    marginBottom: 12,
  },
  actionButton: {
    width: "48%",
    backgroundColor: CARD_BG,
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
    color: TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: "600",
  },
  textButton: {
    paddingVertical: 12,
    marginBottom: 16,
  },
  textButtonText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },

});
