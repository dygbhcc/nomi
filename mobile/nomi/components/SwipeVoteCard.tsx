import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  ImageSourcePropType,
  PanResponderInstance,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Colors } from "../theme/colors";

const ACCENT = Colors.accent;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const RED = "#E74C3C";
const AVATAR_COLORS = ["#C25A41", "#E06A4F", "#B54F3A", "#FF8A3D"];

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
  reason?: string; // "Why for you?" text
  sentimentNuances?: string[]; // NLP sentiment pills (matches swipe card)

  // Vote info (optional, for group voting)
  voteData?: VoteData;

  // Animation
  translateX: Animated.Value;
  rotate: Animated.AnimatedInterpolation<string | number>;
  scale?: Animated.AnimatedInterpolation<number>;
  likeOpacity: Animated.AnimatedInterpolation<number>;
  nopeOpacity: Animated.AnimatedInterpolation<number>;

  // Handlers
  panHandlers: PanResponderInstance['panHandlers']; // FIX 8 - Proper type

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
  reason,
  sentimentNuances,
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
  const { t } = useTranslation();

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
          <Text style={styles.photoInitial}>{name?.charAt(0) || '?'}</Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.infoSection}>
        <Text style={styles.restaurantName}>{name || 'Unknown Restaurant'}</Text>

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

        {reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>{t('swipe.whyForYou')}</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        )}

        {sentimentNuances && sentimentNuances.length > 0 && (
          <View style={styles.sentimentRow}>
            {sentimentNuances.slice(0, 3).map((nuance) => (
              <View key={nuance} style={styles.sentimentPill}>
                <Text style={styles.sentimentPillText}>{nuance}</Text>
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
              {voteData.liked}/{voteData.total} {t('common.likedThis')}
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
    // B-04/B-07/B-18: consistent orange-framed card on a white background
    // across validation, swipe and suggestion screens.
    borderWidth: 1.5,
    borderColor: ACCENT,
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
    flex: 1,
    minHeight: 140,
    maxHeight: 380,
    backgroundColor: "#E8E8E8",
  },
  photoPlaceholder: {
    width: "100%",
    flex: 1,
    minHeight: 140,
    maxHeight: 380,
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
    fontSize: 20,
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
  sentimentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  reasonBox: {
    backgroundColor: "rgba(224, 106, 79, 0.08)",
    borderRadius: 10,
    padding: 12,
  },
  reasonLabel: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  reasonText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
  },
});
