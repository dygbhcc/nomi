import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  recordPreferenceVote,
  listenToPreferenceVotes,
  calculateConsensus,
  type PreferenceVote,
} from '../services/roomService';

type Props = {
  roomCode: string;
  totalParticipants: number;
  onComplete: (consensusMoods: string[], consensusBudget: number, consensusDistance: number) => void;
};

const MOOD_OPTIONS = [
  { id: 'romantic', label: 'Romantic', emoji: '💕' },
  { id: 'cozy', label: 'Cozy', emoji: '🔥' },
  { id: 'lively', label: 'Lively', emoji: '🎉' },
  { id: 'quiet', label: 'Quiet', emoji: '🤫' },
  { id: 'fresh', label: 'Fresh', emoji: '🥗' },
];

const BUDGET_OPTIONS = [
  { level: 1, label: '€', description: 'Budget-friendly' },
  { level: 2, label: '€€', description: 'Moderate' },
  { level: 3, label: '€€€', description: 'Upscale' },
  { level: 4, label: '€€€€', description: 'Fine dining' },
];

const DISTANCE_OPTIONS = [
  { value: 1, label: '1 km', description: 'Very close' },
  { value: 3, label: '3 km', description: 'Walking distance' },
  { value: 5, label: '5 km', description: 'Short drive' },
  { value: 10, label: '10 km', description: 'Anywhere nearby' },
];

export default function GroupPreferenceVoteScreen({
  roomCode,
  totalParticipants,
  onComplete,
}: Props) {
  const { user } = useAuth();
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);
  const [votedCount, setVotedCount] = useState(0);

  // Listen to realtime preference votes
  useEffect(() => {
    if (!roomCode) return;

    __DEV__ && console.log('Setting up preference vote listener for:', roomCode);

    const unsubscribe = listenToPreferenceVotes(roomCode, (votes) => {
      const count = Object.keys(votes).length;
      setVotedCount(count);

      __DEV__ && console.log('Preference votes update:', { count, totalParticipants });

      // When all participants have voted, calculate consensus
      if (count >= totalParticipants && count > 0) {
        __DEV__ && console.log('All participants voted, calculating consensus');
        const consensus = calculateConsensus(votes);
        __DEV__ && console.log('Consensus:', consensus);
        onComplete(consensus.moods, consensus.budget, consensus.distance);
      }
    });

    return unsubscribe;
  }, [roomCode, totalParticipants, onComplete]);

  const toggleMood = (moodId: string) => {
    if (voted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedMoods(prev =>
      prev.includes(moodId)
        ? prev.filter(m => m !== moodId)
        : [...prev, moodId]
    );
  };

  const selectBudget = (level: number) => {
    if (voted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBudget(level);
  };

  const selectDistance = (value: number) => {
    if (voted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDistance(value);
  };

  const handleSubmit = async () => {
    if (!user || selectedBudget === null || selectedDistance === null) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setVoted(true);

    const preferences: PreferenceVote = {
      moods: selectedMoods,
      budget: selectedBudget,
      distance: selectedDistance,
    };

    __DEV__ && console.log('Recording preference vote:', preferences);

    try {
      await recordPreferenceVote(roomCode, user.uid, preferences);
      __DEV__ && console.log('Preference vote recorded successfully');
    } catch (error) {
      __DEV__ && console.error('Error recording preference vote:', error);
    }
  };

  const canSubmit = selectedBudget !== null && selectedDistance !== null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Group Preferences</Text>
          <Text style={styles.subtitle}>
            {voted
              ? `Waiting for others... (${votedCount}/${totalParticipants} voted)`
              : 'Choose your preferences'
            }
          </Text>
        </View>

        {/* Mood Selection */}
        <Text style={styles.sectionTitle}>What's the vibe? (optional)</Text>
        <View style={styles.moodGrid}>
          {MOOD_OPTIONS.map(mood => (
            <TouchableOpacity
              key={mood.id}
              style={[
                styles.moodButton,
                selectedMoods.includes(mood.id) && styles.moodButtonSelected,
                voted && styles.disabled,
              ]}
              onPress={() => toggleMood(mood.id)}
              disabled={voted}
            >
              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
              <Text style={[
                styles.moodLabel,
                selectedMoods.includes(mood.id) && styles.moodLabelSelected,
              ]}>
                {mood.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Budget Selection */}
        <Text style={styles.sectionTitle}>Budget *</Text>
        <View style={styles.optionList}>
          {BUDGET_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.level}
              style={[
                styles.optionButton,
                selectedBudget === option.level && styles.optionButtonSelected,
                voted && styles.disabled,
              ]}
              onPress={() => selectBudget(option.level)}
              disabled={voted}
            >
              <Text style={[
                styles.optionLabel,
                selectedBudget === option.level && styles.optionLabelSelected,
              ]}>
                {option.label}
              </Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Distance Selection */}
        <Text style={styles.sectionTitle}>How far? *</Text>
        <View style={styles.optionList}>
          {DISTANCE_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                selectedDistance === option.value && styles.optionButtonSelected,
                voted && styles.disabled,
              ]}
              onPress={() => selectDistance(option.value)}
              disabled={voted}
            >
              <Text style={[
                styles.optionLabel,
                selectedDistance === option.value && styles.optionLabelSelected,
              ]}>
                {option.label}
              </Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Submit Button */}
        {!voted && (
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.submitButtonText}>Submit my preferences</Text>
          </TouchableOpacity>
        )}

        {voted && (
          <View style={styles.waitingBanner}>
            <Text style={styles.waitingText}>
              ⏳ Waiting for {totalParticipants - votedCount} more...
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 12,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moodButton: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: '30%',
  },
  moodButtonSelected: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(224, 106, 79, 0.08)',
  },
  moodEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  moodLabelSelected: {
    color: Colors.accent,
    fontWeight: '700',
  },
  optionList: {
    gap: 10,
  },
  optionButton: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionButtonSelected: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(224, 106, 79, 0.08)',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  optionLabelSelected: {
    color: Colors.accent,
  },
  optionDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  waitingBanner: {
    backgroundColor: 'rgba(224, 106, 79, 0.15)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  waitingText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
