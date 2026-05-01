import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Share, Alert, TextInput, Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { createRoom, joinRoom } from '../services/roomService';
import { useAuth } from '../context/AuthContext';

const MOODS = [
  { id: 'romantic', label: 'Romantic', image: require('../assets/images/romantic_old.png') },
  { id: 'energetic', label: 'Energetic', image: require('../assets/images/energetic.png') },
  { id: 'chill', label: 'Chill', image: require('../assets/images/chill.png') },
  { id: 'explorer', label: 'Explore', image: require('../assets/images/explore.png') },
  { id: 'focus', label: 'Focus', image: require('../assets/images/focus.png') },
  { id: 'hungry_quick', label: 'Quick', image: require('../assets/images/hungry.png') },
];

const BUDGETS = [
  { value: 1, label: '€', desc: 'Up to €15' },
  { value: 2, label: '€€', desc: '€15–35' },
  { value: 3, label: '€€€', desc: '€35+' },
];

const DISTANCES = [
  { value: 500, label: 'Nearby', desc: '< 500m' },
  { value: 3000, label: 'A bit further', desc: '2–5 km' },
  { value: 10000, label: 'Explore', desc: 'Anywhere' },
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
  const { user, isGuest, signOut } = useAuth();
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [budget, setBudget] = useState<number>(2);
  const [distance, setDistance] = useState<number>(3000);
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleCreateRoom = async () => {
    if (isGuest) {
      Alert.alert(
        'Account required',
        'Create a free account to use group rooms.',
        [
          { text: 'Maybe later', style: 'cancel' },
          { text: 'Sign up', onPress: () => signOut() },
        ]
      );
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const code = generateRoomCode();
      await createRoom(code, user!.uid, user!.displayName || 'Host', {
        moods: selectedMoods,
        budget,
        distance: Math.round(distance / 1000),
      });
      setRoomCode(code);
      __DEV__ && console.log('Room created:', code);
    } catch (error) {
      __DEV__ && console.error('Error creating room:', error);
      Alert.alert('Error', 'Could not create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMood = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMoods(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleShare = async () => {
    if (!roomCode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Join my Nomi group! Code: ${roomCode}\nnomi.app/room/${roomCode}`,
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
      Alert.alert(
        'Account required',
        'Create a free account to use group rooms.',
        [
          { text: 'Maybe later', style: 'cancel' },
          { text: 'Sign up', onPress: () => signOut() },
        ]
      );
      return;
    }

    setJoining(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const success = await joinRoom(joinCode.toUpperCase(), user.uid, user.displayName || 'Guest');
      if (success) {
        onJoinRoom(joinCode.toUpperCase());
      } else {
        Alert.alert('Room not found', 'Check the code and try again.');
      }
    } catch (error) {
      __DEV__ && console.error('Error joining room:', error);
      Alert.alert('Error', 'Could not join room.');
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
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Decide together</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.step, styles.stepActive]}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepLabel}>Set preferences</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={[styles.step, roomCode && styles.stepActive]}>
            <Text style={[styles.stepNumber, !roomCode && styles.stepNumberInactive]}>2</Text>
            <Text style={[styles.stepLabel, !roomCode && styles.stepLabelInactive]}>Create room</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={[styles.step, roomCode && styles.stepActive]}>
            <Text style={[styles.stepNumber, !roomCode && styles.stepNumberInactive]}>3</Text>
            <Text style={[styles.stepLabel, !roomCode && styles.stepLabelInactive]}>Start voting</Text>
          </View>
        </View>

        {/* Mood selection */}
        <Text style={styles.sectionTitle}>What's the vibe?</Text>
        <Text style={styles.sectionSubtitle}>Pick all that apply</Text>
        <View style={styles.moodGrid}>
          {MOODS.map(mood => {
            const isSelected = selectedMoods.includes(mood.id);
            return (
              <TouchableOpacity
                key={mood.id}
                style={[styles.moodCard, isSelected && styles.moodCardSelected]}
                onPress={() => toggleMood(mood.id)}
                accessibilityLabel={`${mood.label} mood`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
              >
                <Image source={mood.image} style={styles.moodImage} resizeMode="contain" />
                <Text style={[styles.moodLabel, isSelected && styles.moodLabelSelected]}>
                  {mood.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Budget */}
        <Text style={styles.sectionTitle}>Budget</Text>
        <View style={styles.optionRow}>
          {BUDGETS.map(b => (
            <TouchableOpacity
              key={b.value}
              style={[styles.optionButton, budget === b.value && styles.optionButtonSelected]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setBudget(b.value);
              }}
              accessibilityLabel={`${b.label} budget, ${b.desc}`}
              accessibilityRole="button"
            >
              <Text style={[styles.optionLabel, budget === b.value && styles.optionLabelSelected]}>
                {b.label}
              </Text>
              <Text style={[styles.optionDesc, budget === b.value && styles.optionDescSelected]}>
                {b.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Distance */}
        <Text style={styles.sectionTitle}>Distance</Text>
        <View style={styles.optionRow}>
          {DISTANCES.map(d => (
            <TouchableOpacity
              key={d.value}
              style={[styles.optionButton, distance === d.value && styles.optionButtonSelected]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDistance(d.value);
              }}
              accessibilityLabel={`${d.label}, ${d.desc}`}
              accessibilityRole="button"
            >
              <Text style={[styles.optionLabel, distance === d.value && styles.optionLabelSelected]}>
                {d.label}
              </Text>
              <Text style={[styles.optionDesc, distance === d.value && styles.optionDescSelected]}>
                {d.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Room code card - only visible after room created */}
        {roomCode && (
          <View style={styles.roomCodeCard}>
            <View style={styles.roomCodeRow}>
              <View>
                <Text style={styles.roomCodeLabel}>Room code</Text>
                <Text style={styles.roomCode} selectable>{roomCode}</Text>
              </View>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
                accessibilityLabel="Share room link"
                accessibilityRole="button"
              >
                <Text style={styles.shareButtonText}>📤 Share</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.waitingHint}>
              Share the code with friends, then tap Start Voting when everyone is ready.
            </Text>
          </View>
        )}

        {/* Hint text if no mood selected */}
        {selectedMoods.length === 0 && !roomCode && (
          <Text style={styles.hintText}>← Select at least one mood to continue</Text>
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
              {loading ? 'Creating room...' : 'Create Room →'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStart}
            accessibilityLabel="Start voting"
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Start Voting →</Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or join a room</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Join room */}
        <View style={styles.joinRow}>
          <TextInput
            style={styles.joinInput}
            placeholder="Enter room code"
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
            <Text style={styles.joinButtonText}>{joining ? '...' : 'Join'}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
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
});
