import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Restaurant, getPhotoUrl } from '../services/restaurantService';
import { recordFinalVote, listenToFinalVotes } from '../services/roomService';
import { useAuth } from '../context/AuthContext';

type Props = {
  roomCode: string;
  restaurants: Restaurant[];
  totalParticipants: number;
  onWinner: (restaurant: Restaurant) => void;
  onStartOver: () => void;
};

export default function GroupVoteScreen({
  roomCode, restaurants, totalParticipants, onWinner, onStartOver
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [finalVotes, setFinalVotes] = useState<Record<string, string>>({});
  const [waitingCount, setWaitingCount] = useState(0);

  // Debug log
  useEffect(() => {
    __DEV__ && console.log('GroupVoteScreen mounted', {
      roomCode,
      restaurantCount: restaurants?.length,
      totalParticipants,
    });
  }, []);

  useEffect(() => {
    if (!roomCode) {
      __DEV__ && console.log('GroupVoteScreen: No room code');
      return;
    }

    __DEV__ && console.log('Setting up final votes listener for room:', roomCode);

    try {
      const unsubscribe = listenToFinalVotes(roomCode, (votes) => {
        __DEV__ && console.log('Final votes update:', votes);
        setFinalVotes(votes);
        setWaitingCount(Object.keys(votes).length);

        // All voted — calculate winner
        if (Object.keys(votes).length >= totalParticipants) {
          const scores: Record<string, number> = {};
          Object.values(votes).forEach(restaurantId => {
            scores[restaurantId] = (scores[restaurantId] || 0) + 1;
          });
          const winnerId = Object.entries(scores)
            .sort(([,a], [,b]) => b - a)[0]?.[0];
          const winner = restaurants.find(r => r.id === winnerId);
          if (winner) {
            __DEV__ && console.log('Winner found:', winner.name);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onWinner(winner);
          }
        }
      });
      return unsubscribe;
    } catch (error) {
      __DEV__ && console.error('Error setting up final votes listener:', error);
    }
  }, [roomCode, totalParticipants, restaurants, onWinner]);

  const handleSelect = async (restaurant: Restaurant) => {
    if (voted || !user) {
      __DEV__ && console.log('Cannot vote:', { voted, hasUser: !!user });
      return;
    }

    __DEV__ && console.log('Voting for:', restaurant.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedId(restaurant.id);
    setVoted(true);

    try {
      await recordFinalVote(roomCode, user.uid, restaurant.id);
      __DEV__ && console.log('Vote recorded successfully');
    } catch (error) {
      __DEV__ && console.error('Error recording vote:', error);
      setVoted(false);
      setSelectedId(null);
    }
  };

  const getVoteCount = (restaurantId: string): number => {
    return Object.values(finalVotes).filter(id => id === restaurantId).length;
  };

  const renderCard = ({ item }: { item: Restaurant }) => {
    const photoUrl = getPhotoUrl(item);
    const isSelected = selectedId === item.id;
    const voteCount = getVoteCount(item.id);

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => handleSelect(item)}
        disabled={voted}
        accessibilityLabel={`Vote for ${item.name}`}
        accessibilityRole="button"
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: '#E8E8E8' }]} />
        )}
        {isSelected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>{t('groupVote.yourPick')}</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {item.distance || t('common.nearby')} · {'€'.repeat(item.budget_level)}
          </Text>
          {voteCount > 0 && (
            <View style={styles.voteRow}>
              <View style={styles.voteBar}>
                <View
                  style={[
                    styles.voteBarFill,
                    { width: `${(voteCount / totalParticipants) * 100}%` }
                  ]}
                />
              </View>
              <Text style={styles.voteCount}>{t('groupVote.votes', { count: voteCount })}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!restaurants || restaurants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🤔</Text>
          <Text style={styles.emptyTitle}>{t('groupVote.emptyState')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('common.errorOccurred')}
          </Text>
          <TouchableOpacity style={styles.startOverButton} onPress={onStartOver}>
            <Text style={styles.startOverText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>{t('groupVote.title')}</Text>
        <Text style={styles.subtitle}>
          {voted
            ? t('groupVote.waitingForVotes')
            : t('groupVote.pickFavourite')}
        </Text>
      </View>

      {voted && (
        <View style={styles.waitingBanner}>
          <Text style={styles.waitingText}>
            ⏳ {t('groupVote.stillVoting', { count: totalParticipants - waitingCount })}
          </Text>
        </View>
      )}

      <FlatList
        data={restaurants}
        renderItem={renderCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  waitingBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(224, 106, 79, 0.15)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  waitingText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSelected: {
    borderColor: Colors.accent,
  },
  cardImage: {
    width: '100%',
    height: 140,
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardInfo: {
    padding: 14,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voteBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  voteBarFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  voteCount: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
    minWidth: 50,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  startOverButton: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  startOverText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
});
