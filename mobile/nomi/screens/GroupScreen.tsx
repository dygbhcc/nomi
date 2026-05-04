import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Share, Alert, TextInput, Image, Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { createRoom, joinRoom } from '../services/roomService';
import { useAuth } from '../context/AuthContext';

const MOODS = [
  { id: 'romantic', labelKey: 'mood.moods.romantic.label', image: require('../assets/images/romantic_old.png') },
  { id: 'energetic', labelKey: 'mood.moods.energetic.label', image: require('../assets/images/energetic.png') },
  { id: 'chill', labelKey: 'mood.moods.chill.label', image: require('../assets/images/chill.png') },
  { id: 'explorer', labelKey: 'mood.moods.explorer.label', image: require('../assets/images/explore.png') },
  { id: 'focus', labelKey: 'mood.moods.focus.label', image: require('../assets/images/focus.png') },
  { id: 'hungry_quick', labelKey: 'mood.moods.hungryQuick.label', image: require('../assets/images/hungry.png') },
];

const BUDGETS = [
  { value: 1, label: '€', labelKey: 'budget.budgetOptions.1.label' },
  { value: 2, label: '€€', labelKey: 'budget.budgetOptions.2.label' },
  { value: 3, label: '€€€', labelKey: 'budget.budgetOptions.3.label' },
];

const DISTANCES = [
  { value: 500, labelKey: 'budget.distanceOptions.500.title' },
  { value: 3500, labelKey: 'budget.distanceOptions.3500.title' },
  { value: 10000, labelKey: 'budget.distanceOptions.10000.title' },
];

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

type Props = {
  onStartVoting: (roomCode: string, moods: string[], budget: number, distance: number) => void;
  onJoinRoom: (roomCode: string) => void;
  onBack: () => void;
  onNavigate: (screen: string) => void;
};

export default function GroupScreen({ onStartVoting, onJoinRoom, onBack, onNavigate }: Props) {
  const { t } = useTranslation();
  const { user, isGuest, signOut } = useAuth();
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [budget, setBudget] = useState<number>(2);
  const [distance, setDistance] = useState<number>(3500);
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load default mood from settings on mount
  useEffect(() => {
    AsyncStorage.getItem('default_mood').then((mood) => {
      __DEV__ && console.log('📱 Loaded default mood from storage:', mood);
      if (mood) {
        setSelectedMoods([mood]);
        __DEV__ && console.log('✅ Default mood set:', [mood]);
      } else {
        __DEV__ && console.log('⚠️ No default mood found in storage');
      }
    });
  }, []);

  const handleCreateRoom = async () => {
    __DEV__ && console.log('🚀 handleCreateRoom called');
    __DEV__ && console.log('Selected moods:', selectedMoods);
    __DEV__ && console.log('Budget:', budget);
    __DEV__ && console.log('Distance:', distance);
    __DEV__ && console.log('Is guest:', isGuest);
    __DEV__ && console.log('User:', user);

    if (isGuest) {
      __DEV__ && console.log('⚠️ User is guest, showing modal');
      setShowGuestModal(true);
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const code = generateRoomCode();
      __DEV__ && console.log('Generated room code:', code);
      await createRoom(code, user!.uid, user!.displayName || 'Host', {
        moods: selectedMoods,
        budget,
        distance: Math.round(distance / 1000),
      });
      setRoomCode(code);
      __DEV__ && console.log('✅ Room created successfully:', code);
    } catch (error) {
      __DEV__ && console.error('❌ Error creating room:', error);
      setErrorMessage(t('group.errors.createFailed'));
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleMood = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMoods(prev => {
      const newMoods = prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id];
      __DEV__ && console.log('Mood toggled. New selection:', newMoods);
      return newMoods;
    });
  };

  // Debug: Log when selectedMoods changes
  useEffect(() => {
    __DEV__ && console.log('🔘 Button state - selectedMoods:', selectedMoods);
    __DEV__ && console.log('🔘 Button disabled?', selectedMoods.length === 0 || loading);
  }, [selectedMoods, loading]);

  const handleShare = async () => {
    if (!roomCode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: t('waitingRoom.shareMessage', { code: roomCode }),
    });
  };

  const handleStart = () => {
    if (!roomCode) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onStartVoting(roomCode, selectedMoods, budget, distance);
  };

  const handleJoin = async () => {
    if (joinCode.length !== 6 || !user) return;

    if (isGuest) {
      setShowGuestModal(true);
      return;
    }

    setJoining(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const success = await joinRoom(joinCode.toUpperCase(), user.uid, user.displayName || 'Guest');
      if (success) {
        onJoinRoom(joinCode.toUpperCase());
      } else {
        setErrorMessage(t('group.errors.joinFailed'));
        setShowErrorModal(true);
      }
    } catch (error) {
      __DEV__ && console.error('Error joining room:', error);
      setErrorMessage(t('group.errors.joinFailed'));
      setShowErrorModal(true);
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} accessibilityLabel="Go back" accessibilityRole="button">
          <Text style={styles.backText}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('group.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.step, styles.stepActive]}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepLabel}>{t('group.selectMoods')}</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={[styles.step, roomCode && styles.stepActive]}>
            <Text style={[styles.stepNumber, !roomCode && styles.stepNumberInactive]}>2</Text>
            <Text style={[styles.stepLabel, !roomCode && styles.stepLabelInactive]}>{t('group.createRoom')}</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={[styles.step, roomCode && styles.stepActive]}>
            <Text style={[styles.stepNumber, !roomCode && styles.stepNumberInactive]}>3</Text>
            <Text style={[styles.stepLabel, !roomCode && styles.stepLabelInactive]}>{t('waitingRoom.startVoting')}</Text>
          </View>
        </View>

        {/* Mood selection */}
        <Text style={styles.sectionTitle}>{t('mood.title')}</Text>
        <Text style={styles.sectionSubtitle}>{t('mood.selectMoods')}</Text>
        <View style={styles.moodGrid}>
          {MOODS.map(mood => {
            const isSelected = selectedMoods.includes(mood.id);
            return (
              <TouchableOpacity
                key={mood.id}
                style={[styles.moodCard, isSelected && styles.moodCardSelected]}
                onPress={() => toggleMood(mood.id)}
                accessibilityLabel={`${t(mood.labelKey)} mood`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
              >
                <Image source={mood.image} style={styles.moodImage} resizeMode="contain" />
                <Text style={[styles.moodLabel, isSelected && styles.moodLabelSelected]}>
                  {t(mood.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Budget */}
        <Text style={styles.sectionTitle}>{t('budget.budgetTitle')}</Text>
        <View style={styles.optionRow}>
          {BUDGETS.map(b => (
            <TouchableOpacity
              key={b.value}
              style={[styles.optionButton, budget === b.value && styles.optionButtonSelected]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setBudget(b.value);
              }}
              accessibilityLabel={t(b.labelKey)}
              accessibilityRole="button"
            >
              <Text style={[styles.optionLabel, budget === b.value && styles.optionLabelSelected]}>
                {b.label}
              </Text>
              <Text style={[styles.optionDesc, budget === b.value && styles.optionDescSelected]}>
                {t(b.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Distance */}
        <Text style={styles.sectionTitle}>{t('budget.distanceTitle')}</Text>
        <View style={styles.optionRow}>
          {DISTANCES.map(d => (
            <TouchableOpacity
              key={d.value}
              style={[styles.optionButton, distance === d.value && styles.optionButtonSelected]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDistance(d.value);
              }}
              accessibilityLabel={t(d.labelKey)}
              accessibilityRole="button"
            >
              <Text style={[styles.optionDesc, distance === d.value && styles.optionDescSelected]}>
                {t(d.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Room code card - only visible after room created */}
        {roomCode && (
          <View style={styles.roomCodeCard}>
            <View style={styles.roomCodeRow}>
              <View>
                <Text style={styles.roomCodeLabel}>{t('waitingRoom.shareCode')}</Text>
                <Text style={styles.roomCode} selectable>{roomCode}</Text>
              </View>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
                accessibilityLabel="Share room link"
                accessibilityRole="button"
              >
                <Text style={styles.shareButtonText}>📤 {t('common.share')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.waitingHint}>
              {t('waitingRoom.shareCode')}
            </Text>
          </View>
        )}

        {/* Hint text if no mood selected */}
        {selectedMoods.length === 0 && !roomCode && (
          <Text style={styles.hintText}>← {t('mood.selectMoods')}</Text>
        )}

        {/* Primary CTA - changes based on state */}
        {!roomCode ? (
          <TouchableOpacity
            style={[styles.primaryButton, (selectedMoods.length === 0 || loading) && styles.primaryButtonDisabled]}
            onPress={handleCreateRoom}
            disabled={selectedMoods.length === 0 || loading}
            accessibilityLabel="Create room with selected preferences"
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {loading ? t('common.loading') : t('group.createRoom')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStart}
            accessibilityLabel="Start voting"
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>{t('waitingRoom.startVoting')}</Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('group.joinRoom')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Join room */}
        <View style={styles.joinRow}>
          <TextInput
            style={styles.joinInput}
            placeholder={t('group.enterCode')}
            placeholderTextColor={Colors.textSecondary}
            value={joinCode}
            onChangeText={(t) => setJoinCode(t.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            accessibilityLabel="Enter room code"
          />
          <TouchableOpacity
            style={[styles.joinButton, (joinCode.length !== 6 || joining) && styles.joinButtonDisabled]}
            onPress={handleJoin}
            disabled={joinCode.length !== 6 || joining}
            accessibilityLabel="Join room"
            accessibilityRole="button"
          >
            <Text style={styles.joinButtonText}>{joining ? '...' : t('group.join')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Guest Modal */}
      <Modal
        visible={showGuestModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGuestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('auth.guestNote')}</Text>
            <Text style={styles.modalMessage}>{t('auth.createAccount')}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowGuestModal(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={() => {
                  setShowGuestModal(false);
                  signOut();
                }}
              >
                <Text style={styles.modalConfirmText}>{t('auth.signUp')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('common.error')}</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalConfirmButton, { width: '100%' }]}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.modalConfirmText}>{t('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backText: { fontSize: 15, color: Colors.textSecondary },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  step: {
    alignItems: 'center',
    gap: 4,
  },
  stepActive: {},
  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E8E8',
    marginHorizontal: 8,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  stepNumberInactive: {
    backgroundColor: '#E8E8E8',
    color: Colors.textSecondary,
  },
  stepLabel: {
    fontSize: 10,
    color: Colors.accent,
    fontWeight: '600',
  },
  stepLabelInactive: {
    color: Colors.textSecondary,
  },

  // Sections
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
    marginTop: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
  },

  // Mood grid
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  moodCard: {
    width: '30%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  moodCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(224, 106, 79, 0.08)',
  },
  moodImage: {
    width: 56,
    height: 56,
  },
  moodLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  moodLabelSelected: { color: Colors.accent, fontWeight: '700' },

  // Options
  optionRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  optionButton: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
  },
  optionButtonSelected: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(224, 106, 79, 0.08)',
  },
  optionLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  optionLabelSelected: { color: Colors.accent },
  optionDesc: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  optionDescSelected: { color: Colors.accent },

  // Room code card
  roomCodeCard: {
    backgroundColor: 'rgba(224, 106, 79, 0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  roomCodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomCodeLabel: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '600',
    marginBottom: 2,
  },
  roomCode: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 4,
  },
  shareButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  waitingHint: {
    fontSize: 12,
    color: Colors.accent,
    lineHeight: 18,
  },

  // Hint and CTA
  hintText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: '#E8E8E8' },
  dividerText: { fontSize: 12, color: Colors.textSecondary },

  // Join room
  joinRow: { flexDirection: 'row', gap: 10 },
  joinInput: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 3,
  },
  joinButton: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  joinButtonDisabled: {
    opacity: 0.4,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Modals
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
