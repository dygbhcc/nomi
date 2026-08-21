import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Colors } from "../theme/colors";
import SwipeVoteCard from "../components/SwipeVoteCard";
import { recordVote, calculateWinner, declareWinner, listenToRoom, Room, setRoomRestaurantList } from '../services/roomService';
import { getRestaurantsByMood, getRestaurantsByIds, Restaurant, buildReason, getPhotoUrl } from '../services/restaurantService';
import { useAuth } from '../context/AuthContext';

export { type Restaurant };


const AVATAR_COLORS = ["#C25A41", "#E06A4F", "#B54F3A", "#FF8A3D"];
const SWIPE_THRESHOLD = 100;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const PHOTO_BG = "#1A1A2E";
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const REJECT_COLOR = "#E74C3C";

function budgetSymbol(level: number): string {
  return "\u20AC".repeat(level);
}

type Props = {
  roomCode: string;
  selectedMoods: string[];
  budgetLevel: number;
  isHost: boolean;
  onVotingComplete: (restaurants: Restaurant[], votes: Record<string, Record<string, string>>) => void;
  onBack: () => void;
  onDetail: (restaurant: Restaurant) => void;
};

export default function VotingScreen({ roomCode, selectedMoods, budgetLevel, isHost, onVotingComplete, onBack, onDetail }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myVotes, setMyVotes] = useState<Record<string, 'like' | 'pass'>>({});

  // Refs so room listener and panResponder always see latest values without stale closures
  const restaurantsRef = useRef<Restaurant[]>([]);
  restaurantsRef.current = restaurants;
  const participantLoadStartedRef = useRef(false);

  // Host: fetch restaurants by mood → store IDs in room so all participants load the same list
  useEffect(() => {
    if (!isHost) return;
    setLoading(true);
    setError(null);
    getRestaurantsByMood(selectedMoods, budgetLevel, 6)
      .then(({ restaurants: data }) => {
        const withReasons = data.map(r => ({ ...r, reason: buildReason(r, selectedMoods) }));
        setRestaurants(withReasons);
        if (data.length > 0) {
          setRoomRestaurantList(roomCode, data.map(r => r.id)).catch(e => {
            __DEV__ && console.error('setRoomRestaurantList error:', e);
          });
        }
      })
      .catch(() => setError(t('swipe.errorLoading')))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Participant fallback: if host hasn't stored restaurant_ids after 12s, fetch independently
  useEffect(() => {
    if (isHost) return;
    const timer = setTimeout(() => {
      if (!participantLoadStartedRef.current) {
        participantLoadStartedRef.current = true;
        getRestaurantsByMood(selectedMoods, budgetLevel, 6)
          .then(({ restaurants: data }) => {
            const withReasons = data.map(r => ({ ...r, reason: buildReason(r, selectedMoods) }));
            setRestaurants(withReasons);
          })
          .catch(() => setError(t('swipe.errorLoading')))
          .finally(() => setLoading(false));
      }
    }, 12000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Room listener: realtime votes + participant restaurant loading
  useEffect(() => {
    if (!roomCode) return;
    const unsubscribe = listenToRoom(roomCode, (roomData) => {
      setRoom(roomData);

      // Participant: load restaurants from room when host has stored them
      if (!isHost && !participantLoadStartedRef.current && roomData?.restaurant_ids?.length) {
        participantLoadStartedRef.current = true;
        getRestaurantsByIds(roomData.restaurant_ids)
          .then(data => {
            const withReasons = data.map(r => ({ ...r, reason: buildReason(r, selectedMoods) }));
            setRestaurants(withReasons);
          })
          .catch(() => setError(t('swipe.errorLoading')))
          .finally(() => setLoading(false));
      }

      if (roomData?.status === 'decided' && roomData.votes) {
        onVotingComplete(restaurantsRef.current, roomData.votes);
      }
    });
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-15deg", "0deg", "15deg"],
  });
  const likeOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const nopeOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const restaurant = restaurants[currentIndex];
  const allDone = currentIndex >= restaurants.length;

  const handleVote = async (direction: 'like' | 'pass') => {
    if (!user || !restaurant) {
      __DEV__ && console.log('Cannot vote: no user or restaurant');
      return;
    }

    __DEV__ && console.log('Voting:', { restaurant: restaurant.name, direction, currentIndex });

    Haptics.impactAsync(
      direction === 'like'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );

    // myVotes already updated in animateOut, just reference it for newVotes
    const newVotes = { ...myVotes, [restaurant.id]: direction };

    // Record vote to Firestore
    try {
      await recordVote(roomCode, user.uid, restaurant.id, direction);
      __DEV__ && console.log('Vote recorded successfully');
    } catch (error) {
      __DEV__ && console.error('Error recording vote:', error);
    }

    const nextIndex = currentIndex + 1;
    __DEV__ && console.log('Next index:', nextIndex, '/', restaurants.length);

    // Always increment index first
    setCurrentIndex(nextIndex);

    if (nextIndex >= restaurants.length) {
      __DEV__ && console.log('All cards done, checking if all participants voted');
      // All cards voted — check if all participants done
      const participants = Object.keys(room?.participants || {});
      const allVoted = participants.every(uid => {
        const votes = room?.votes?.[uid] || {};
        return restaurants.every(r => votes[r.id] !== undefined);
      });

      __DEV__ && console.log('All voted?', allVoted, 'Participants:', participants.length);

      if (allVoted && room?.organizer_uid === user.uid) {
        const winner = calculateWinner(
          { ...room?.votes, [user.uid]: newVotes },
          restaurants.map(r => r.id)
        );
        // Pass empty string when winner is null (no restaurant got any likes).
        // declareWinner still sets status:"decided" so all participants are
        // unblocked and GroupLikedScreen shows the no-consensus empty state.
        await declareWinner(roomCode, winner || "", user.uid);
      }
    }
  };

  const animateOut = (direction: "left" | "right") => {
    const toValue = direction === "right" ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    const vote = direction === "right" ? "like" : "pass";

    __DEV__ && console.log('🎬 animateOut called:', { direction, vote });
    __DEV__ && console.log('  Current restaurant:', restaurant);
    __DEV__ && console.log('  Restaurant ID:', restaurant?.id);

    // Update myVotes IMMEDIATELY so the count shows during animation
    if (restaurant) {
      const newVotes: Record<string, "like" | "pass"> = { ...myVotes, [restaurant.id]: vote };
      __DEV__ && console.log('  📝 Updating myVotes with:', { [restaurant.id]: vote });
      setMyVotes(newVotes);
      __DEV__ && console.log('  ✅ Vote updated immediately:', { restaurant: restaurant.name, vote });
    } else {
      __DEV__ && console.error('  ❌ Restaurant is undefined/null!');
    }

    Animated.timing(translateX, {
      toValue,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      __DEV__ && console.log('  🏁 Animation complete, calling handleVote');
      handleVote(vote);
    });
  };

  // Keep ref to latest animateOut so the pan responder (created once) always calls the current version
  const animateOutRef = useRef<(direction: "left" | "right") => void>(() => {});
  useEffect(() => { animateOutRef.current = animateOut; });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          animateOutRef.current("right");
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          animateOutRef.current("left");
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.doneContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.doneTitle}>{t('voting.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>😕</Text>
          <Text style={styles.doneTitle}>{t('common.error')}</Text>
          <Text style={styles.doneSubtitle}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              setError(null);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (restaurants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>🔍</Text>
          <Text style={styles.doneTitle}>{t('swipe.noResults')}</Text>
          <Text style={styles.doneSubtitle}>Try different preferences</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onBack}
          >
            <Text style={styles.retryButtonText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // When all cards are done, show waiting screen
  if (allDone || !restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>{"\u{1F4CA}"}</Text>
          <Text style={styles.doneTitle}>{t('voting.loading')}</Text>
          <Text style={styles.doneSubtitle}>{t('groupVote.waitingForVotes')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const participants = Object.values(room?.participants || {}).map(p => p.name);
  const participantCount = participants.length;

  __DEV__ && console.log('Current state:', {
    currentIndex,
    totalRestaurants: restaurants.length,
    participantCount,
    hasRoom: !!room,
  });

  // Calculate vote data for current restaurant
  const getLikeCount = (restaurantId: string): number => {
    if (!room?.votes && !user) {
      __DEV__ && console.log('❌ No room votes yet');
      return 0;
    }

    // Merge room votes with current user's pending votes
    const allVotes = { ...room?.votes };

    __DEV__ && console.log('📊 getLikeCount for restaurant:', restaurantId);
    __DEV__ && console.log('  room.votes:', JSON.stringify(room?.votes, null, 2));
    __DEV__ && console.log('  myVotes:', JSON.stringify(myVotes, null, 2));

    if (user && myVotes[restaurantId]) {
      allVotes[user.uid] = { ...allVotes[user.uid], [restaurantId]: myVotes[restaurantId] };
      __DEV__ && console.log('  ✅ Added current user vote to allVotes');
    }

    __DEV__ && console.log('  allVotes FULL:', JSON.stringify(allVotes, null, 2));

    // Debug: Check each user's vote
    Object.entries(allVotes).forEach(([userId, userVotes]) => {
      __DEV__ && console.log(`  User ${userId}:`, userVotes);
      __DEV__ && console.log(`    Vote for ${restaurantId}:`, userVotes[restaurantId]);
    });

    const count = Object.values(allVotes).filter(
      userVotes => {
        const vote = userVotes[restaurantId];
        __DEV__ && console.log(`  Checking vote: ${vote} === 'like' ?`, vote === 'like');
        return vote === 'like';
      }
    ).length;

    __DEV__ && console.log('  💚 FINAL Like count:', count);
    return count;
  };

  const getAvatars = (restaurantId: string): string[] => {
    if (!room?.participants) return [];

    // Merge room votes with current user's pending votes
    const allVotes = { ...room?.votes };
    if (user && myVotes[restaurantId]) {
      allVotes[user.uid] = { ...allVotes[user.uid], [restaurantId]: myVotes[restaurantId] };
    }

    const avatars: string[] = [];
    for (const uid in allVotes) {
      if (allVotes[uid][restaurantId] === 'like') {
        const name = room.participants[uid]?.name || '';
        avatars.push(name[0] || '?');
      }
    }
    return avatars;
  };

  const voteData = restaurant ? {
    liked: getLikeCount(restaurant.id),
    avatars: getAvatars(restaurant.id),
  } : { liked: 0, avatars: [] };

  __DEV__ && restaurant && console.log('🎯 Final vote data for', restaurant.name, ':', voteData);
  __DEV__ && console.log('👥 Participant count:', participantCount);
  __DEV__ && console.log('🏠 Room state:', room ? 'exists' : 'null');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Top bar: room code + participant avatars */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>{"\u2190"}</Text>
        </TouchableOpacity>
        <View style={styles.roomCodeBadge}>
          <Text style={styles.roomCodeText}>{roomCode}</Text>
        </View>
        <View style={styles.avatarRow}>
          {participants.slice(0, 4).map((name, i) => (
            <View key={name} style={[styles.miniAvatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], marginLeft: i > 0 ? -8 : 0 }]}>
              <Text style={styles.miniAvatarText}>{name[0]}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.counterText}>
          {currentIndex + 1}/{restaurants.length}
        </Text>
        <TouchableOpacity
          style={styles.detailButton}
          onPress={() => restaurant && onDetail(restaurant)}
          accessibilityLabel="View restaurant details"
          accessibilityRole="button"
        >
          <Text style={styles.detailButtonText}>{t('common.details')}</Text>
        </TouchableOpacity>
      </View>

      {/* Card */}
      <View style={styles.cardWrapper}>
        <SwipeVoteCard
          key={restaurant.id}
          name={restaurant.name}
          photo={getPhotoUrl(restaurant)
            ? { uri: getPhotoUrl(restaurant)! }
            : undefined
          }
          distance={restaurant.distance || 'Nearby'}
          budget={restaurant.budget_level}
          moods={restaurant.mood_tags?.slice(0, 3) || []}
          reason={restaurant.reason}
          voteData={{
            avatars: voteData.avatars,
            liked: voteData.liked,
            total: participantCount,
          }}
          translateX={translateX}
          rotate={rotate}
          likeOpacity={likeOpacity}
          nopeOpacity={nopeOpacity}
          panHandlers={panResponder.panHandlers}
          likeLabel="LIKE"
          rejectLabel="NOPE"
          rejectColor={REJECT_COLOR}
        />
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.rejectButton} onPress={() => animateOut("left")}>
          <Text style={styles.rejectIcon}>{"\u2715"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.likeButton} onPress={() => animateOut("right")}>
          <Text style={styles.likeIcon}>{"\u2665"}</Text>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
  },
  backText: {
    color: TEXT_SECONDARY,
    fontSize: 20,
  },
  roomCodeBadge: {
    backgroundColor: CARD_BG,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roomCodeText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  avatarRow: {
    flexDirection: "row",
    flex: 1,
  },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BG,
  },
  miniAvatarText: {
    color: TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: "700",
  },
  counterText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  cardWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  rejectButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(231, 76, 60, 0.15)",
    borderWidth: 2,
    borderColor: REJECT_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectIcon: {
    color: REJECT_COLOR,
    fontSize: 26,
    fontWeight: "700",
  },
  likeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(224, 106, 79, 0.12)",
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  likeIcon: {
    color: ACCENT,
    fontSize: 28,
  },
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  doneEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  doneTitle: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  doneSubtitle: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  retryButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Detail button (top bar)
  detailButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: CARD_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },
});
