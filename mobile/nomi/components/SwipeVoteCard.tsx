import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  ImageSourcePropType,
} from "react-native";
import { Colors } from "../theme/colors";

const ACCENT = Colors.accent;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const GREEN = "#2ECC71";
const RED = "#E74C3C";
const AVATAR_COLORS = ["#6B5FCC", "#9B8FEE", "#5A4FBB", "#7F77DD"];

function budgetSymbol(level: number): string {
  return "\u20AC".repeat(level);
}

type VoteData = {
  avatars: string[];
  liked: number;
  total: number;
};

type SwipeVoteCardProps = {
  // Restaurant data
  name: string;
  photo?: ImageSourcePropType;
  photoColor?: string;

  // Meta info (optional)
  distance?: string;
  budget?: number;
  moods?: string[];
  address?: string;

  // Vote info (optional, for group voting)
  voteData?: VoteData;

  // Animation
  translateX: Animated.Value;
  rotate: Animated.AnimatedInterpolation;
  scale?: Animated.AnimatedInterpolation;
  likeOpacity: Animated.AnimatedInterpolation;
  nopeOpacity: Animated.AnimatedInterpolation;

  // Handlers
  panHandlers: any;

  // Labels
  likeLabel?: string; // "LIKE" or "YES"
  rejectLabel?: string; // "NOPE" or "NO"
  rejectColor?: string; // RED or custom
};

export default function SwipeVoteCard({
  name,
  photo,
  photoColor = "#1A1A2E",
  distance,
  budget,
  moods,
  address,
  voteData,
  translateX,
  rotate,
  scale,
  likeOpacity,
  nopeOpacity,
  panHandlers,
  likeLabel = "LIKE",
  rejectLabel = "NOPE",
  rejectColor = RED,
}: SwipeVoteCardProps) {
  const transformStyle = scale
    ? { transform: [{ translateX }, { rotate }, { scale }] }
    : { transform: [{ translateX }, { rotate }] };

  return (
    <Animated.View style={[styles.card, transformStyle]} {...panHandlers}>
      {/* Swipe overlays */}
      <Animated.View
        style={[styles.swipeLabel, styles.likeLabel, { opacity: likeOpacity }]}
      >
        <Text style={styles.swipeLabelText}>{likeLabel}</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.swipeLabel,
          styles.rejectLabel,
          { opacity: nopeOpacity, borderColor: rejectColor },
        ]}
      >
        <Text style={[styles.swipeLabelText, { color: rejectColor }]}>
          {rejectLabel}
        </Text>
      </Animated.View>

      {/* Photo */}
      {photo ? (
        <Image source={photo} style={styles.photoImage} resizeMode="cover" />
      ) : (
        <View style={[styles.photoPlaceholder, { backgroundColor: photoColor }]}>
          <Text style={styles.photoInitial}>{name.charAt(0)}</Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.infoSection}>
        <Text style={styles.restaurantName}>{name}</Text>

        {address && (
          <Text style={styles.address}>{address}</Text>
        )}

        {(distance || budget) && (
          <View style={styles.metaRow}>
            {distance && <Text style={styles.metaText}>{distance}</Text>}
            {distance && budget && (
              <Text style={styles.metaDot}>{"\u00B7"}</Text>
            )}
            {budget && (
              <Text style={styles.metaText}>{budgetSymbol(budget)}</Text>
            )}
          </View>
        )}

        {moods && moods.length > 0 && (
          <View style={styles.moodRow}>
            {moods.map((mood) => (
              <View key={mood} style={styles.moodBadge}>
                <Text style={styles.moodBadgeText}>{mood}</Text>
              </View>
            ))}
          </View>
        )}

        {voteData && (
          <View style={styles.voteRow}>
            <View style={styles.voteAvatars}>
              {voteData.avatars.map((initial, i) => (
                <View
                  key={`${initial}-${i}`}
                  style={[
                    styles.voteDot,
                    {
                      backgroundColor:
                        AVATAR_COLORS[i % AVATAR_COLORS.length],
                      marginLeft: i > 0 ? -6 : 0,
                    },
                  ]}
                >
                  <Text style={styles.voteDotText}>{initial}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.voteText}>
              {voteData.liked}/{voteData.total} liked this
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    overflow: "hidden",
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
  rejectLabel: {
    right: 20,
  },
  swipeLabelText: {
    fontSize: 24,
    fontWeight: "800",
    color: ACCENT,
  },
  photoImage: {
    width: "100%",
    height: 380,
  },
  photoPlaceholder: {
    width: "100%",
    height: 380,
    alignItems: "center",
    justifyContent: "center",
  },
  photoInitial: {
    color: ACCENT,
    fontSize: 56,
    fontWeight: "700",
    opacity: 0.3,
  },
  infoSection: {
    padding: 16,
  },
  restaurantName: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  address: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    marginBottom: 8,
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
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  moodBadge: {
    backgroundColor: "rgba(127, 119, 221, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  moodBadgeText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "600",
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  voteAvatars: {
    flexDirection: "row",
    marginRight: 10,
  },
  voteDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: CARD_BG,
  },
  voteDotText: {
    color: TEXT_PRIMARY,
    fontSize: 9,
    fontWeight: "700",
  },
  voteText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
});
