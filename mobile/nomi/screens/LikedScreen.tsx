import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Restaurant } from '../services/restaurantService';

type Props = {
  likedRestaurants: Restaurant[];
  onSelect: (restaurant: Restaurant) => void;
  onStartOver: () => void;
};

export default function LikedScreen({ likedRestaurants, onSelect, onStartOver }: Props) {
  const handleStartOver = () => {
    __DEV__ && console.log('handleStartOver called in LikedScreen');
    Alert.alert(
      'Start New Search?',
      "You'll lose your current picks.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => __DEV__ && console.log('User cancelled') },
        {
          text: 'Start Over',
          style: 'destructive',
          onPress: () => {
            __DEV__ && console.log('User confirmed Start Over');
            onStartOver();
          }
        },
      ]
    );
  };

  const getPhotoUrl = (restaurant: Restaurant): string | null => {
    if (!restaurant.photos || restaurant.photos.length === 0) return null;
    const photo = restaurant.photos[0];
    if (photo.url) return photo.url;
    if (photo.photo_reference) {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`;
    }
    return null;
  };

  const renderCard = ({ item }: { item: Restaurant }) => {
    const photoUrl = getPhotoUrl(item);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSelect(item);
        }}
        accessibilityLabel={`Select ${item.name}`}
        accessibilityRole="button"
      >
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: '#E8E8E8' }]} />
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardMeta}>{item.distance || 'Nearby'} · {'€'.repeat(item.budget_level)}</Text>
          <View style={styles.badgeRow}>
            {item.mood_tags?.slice(0, 2).map(mood => (
              <View key={mood} style={styles.badge}>
                <Text style={styles.badgeText}>{mood}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.cardHint}>Tap to view details</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (likedRestaurants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🤔</Text>
          <Text style={styles.emptyTitle}>Nothing caught your eye?</Text>
          <Text style={styles.emptySubtitle}>Try different preferences or explore more spots.</Text>
          <TouchableOpacity
            style={styles.startOverButton}
            onPress={handleStartOver}
            accessibilityLabel="Start over"
            accessibilityRole="button"
          >
            <Text style={styles.startOverText}>Start over</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Your picks</Text>
        <Text style={styles.subtitle}>
          {likedRestaurants.length} place{likedRestaurants.length > 1 ? 's' : ''} you liked
        </Text>
      </View>
      <FlatList
        data={likedRestaurants}
        renderItem={renderCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.startOverButton}
          onPress={handleStartOver}
          accessibilityLabel="Start over with new preferences"
          accessibilityRole="button"
        >
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
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    backgroundColor: 'rgba(224, 106, 79, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  cardHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
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
