import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme/colors';
import { Restaurant, getPhotoUrl } from '../services/restaurantService';

type Props = {
  restaurants: Restaurant[];
  votes: Record<string, Record<string, string>>; // {uid: {restaurantId: 'like'|'pass'}}
  totalVoters: number;
  onSelect: (restaurant: Restaurant) => void;
  onFinalVote?: () => void;
  onStartOver: () => void;
};

export default function GroupLikedScreen({
  restaurants, votes, totalVoters, onSelect, onFinalVote, onStartOver
}: Props) {
  const { t } = useTranslation();
  // Calculate like count per restaurant
  const getLikeCount = (restaurantId: string): number => {
    return Object.values(votes).filter(
      userVotes => userVotes[restaurantId] === 'like'
    ).length;
  };

  // Sort by most liked
  const sortedRestaurants = [...restaurants]
    .map(r => ({ ...r, likeCount: getLikeCount(r.id) }))
    .filter(r => r.likeCount > 0)
    .sort((a, b) => b.likeCount - a.likeCount);

  const handleStartOver = () => {
    Alert.alert(
      t('groupLiked.removeTitle'),
      t('groupLiked.removeMessage'),
      [
        { text: t('groupLiked.cancel'), style: 'cancel' },
        { text: t('groupLiked.remove'), style: 'destructive', onPress: onStartOver },
      ]
    );
  };

  const renderCard = ({ item }: { item: Restaurant & { likeCount: number } }) => {
    const photoUrl = getPhotoUrl(item);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onSelect(item)}
        accessibilityLabel={`${item.name}, liked by ${item.likeCount} people`}
        accessibilityRole="button"
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: '#E8E8E8' }]} />
        )}
        <View style={styles.cardInfo}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.likeBadge}>
              <Text style={styles.likeBadgeText}>
                ❤️ {item.likeCount}/{totalVoters}
              </Text>
            </View>
          </View>
          <Text style={styles.cardMeta}>
            {item.distance || t('common.nearby')} · {'€'.repeat(item.budget_level)}
          </Text>
          <View style={styles.voteBar}>
            <View
              style={[
                styles.voteBarFill,
                { width: `${(item.likeCount / totalVoters) * 100}%` }
              ]}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (sortedRestaurants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>😅</Text>
          <Text style={styles.emptyTitle}>{t('groupLiked.emptyState')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('groupLiked.emptyState')}
          </Text>
          <TouchableOpacity style={styles.startOverButton} onPress={handleStartOver}>
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
        <Text style={styles.title}>{t('groupLiked.title')}</Text>
        <Text style={styles.subtitle}>
          {t('groupLiked.subtitle', { count: sortedRestaurants.length })}
        </Text>
      </View>
      <FlatList
        data={sortedRestaurants}
        renderItem={renderCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      <View style={styles.bottom}>
        {onFinalVote && sortedRestaurants.length > 1 && (
          <TouchableOpacity style={styles.finalVoteButton} onPress={onFinalVote}>
            <Text style={styles.finalVoteText}>Continue to final vote</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.startOverButton} onPress={handleStartOver}>
          <Text style={styles.startOverText}>Start over</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 12,
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
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 160,
  },
  cardInfo: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  likeBadge: {
    backgroundColor: 'rgba(224, 106, 79, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  likeBadgeText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  cardMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  voteBar: {
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
  bottom: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    gap: 10,
  },
  finalVoteButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  finalVoteText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  startOverButton: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  startOverText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
});
