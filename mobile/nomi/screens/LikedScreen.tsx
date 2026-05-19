import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Restaurant } from '../services/restaurantService';

type Props = {
  likedRestaurants: Restaurant[];
  onSelect: (restaurant: Restaurant) => void;
  onStartOver: () => void;
};

export default function LikedScreen({ likedRestaurants, onSelect, onStartOver }: Props) {
  const { t } = useTranslation();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleStartOver = () => {
    console.log('🔴 handleStartOver called - showing modal');
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    console.log('🟢 User confirmed Start Over');
    setShowConfirmModal(false);
    onStartOver();
  };

  const handleCancel = () => {
    console.log('🟡 User cancelled');
    setShowConfirmModal(false);
  };

  const getPhotoUrl = (restaurant: Restaurant): string | null => {
    if (!restaurant.photos || restaurant.photos.length === 0) return null;
    const photo = restaurant.photos[0];
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
          <View>
            <Image source={{ uri: photoUrl }} style={styles.cardImage} resizeMode="cover" />
            <View style={styles.photoAttribution}>
              <Text style={styles.photoAttributionText}>Photo from Google</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.cardImage, { backgroundColor: '#E8E8E8' }]} />
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardMeta}>{item.distance || t('common.nearby')} · {'€'.repeat(item.budget_level)}</Text>
          <View style={styles.badgeRow}>
            {item.mood_tags?.slice(0, 2).map(mood => (
              <View key={mood} style={styles.badge}>
                <Text style={styles.badgeText}>{mood}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.cardHint}>{t('common.tapToViewDetails')}</Text>
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
          <Text style={styles.emptyTitle}>{t('liked.emptyState')}</Text>
          <Text style={styles.emptySubtitle}>{t('swipe.noMore')}</Text>
          <TouchableOpacity
            style={styles.startOverButton}
            onPress={handleStartOver}
            accessibilityLabel="Start over"
            accessibilityRole="button"
          >
            <Text style={styles.startOverText}>{t('liked.startOver')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>{t('liked.title')}</Text>
        <Text style={styles.subtitle}>
          {t('liked.subtitle', { count: likedRestaurants.length })}
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
          <Text style={styles.startOverText}>{t('liked.startOver')}</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t('liked.startOverTitle') || 'Start New Search?'}
            </Text>
            <Text style={styles.modalMessage}>
              {t('liked.startOverMessage') || "You'll lose your current picks."}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleCancel}
              >
                <Text style={styles.modalCancelText}>
                  {t('common.cancel') || 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleConfirm}
              >
                <Text style={styles.modalConfirmText}>
                  {t('liked.startOver') || 'Start Over'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  photoAttribution: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoAttributionText: {
    color: "#FFFFFF",
    fontSize: 9,
    opacity: 0.8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
  },
  modalConfirmButton: {
    backgroundColor: Colors.accent,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
