import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";

type Mood = {
  id: string;
  label: string;
  emoji: string;
  hint: string;
};

const MOODS: Mood[] = [
  { id: "romantic", label: "Romantic", emoji: "\u{1F56F}", hint: "Dim lights, date night" },
  { id: "energetic", label: "Energetic", emoji: "\u26A1", hint: "Loud, buzzing, fun" },
  { id: "chill", label: "Chill", emoji: "\u{1F60A}", hint: "Warm, relaxed, no rush" },
  { id: "explorer", label: "Explore", emoji: "\u{1F9ED}", hint: "New spots, off the beaten path" },
  { id: "focus", label: "Focus", emoji: "\u{1F3AF}", hint: "Quiet, good wifi, calm" },
  { id: "retreat", label: "Retreat", emoji: "\u{1F9D8}", hint: "Peaceful, slow, recharge" },
  { id: "hungry&quick", label: "Hungry & Quick", emoji: "\u{1F354}", hint: "Fast, filling, no wait" },
  { id: "celebrating", label: "Celebrating", emoji: "\u{1F389}", hint: "Party vibes, special night" },
];

const ACCENT = "#7F77DD";
const BG = "#0D0D0D";
const CARD_BG = "#1A1A1A";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#888888";
const STEP_INACTIVE = "#2A2A2A";

type Props = {
  onContinue: (selectedMoods: string[]) => void;
  onSkip: () => void;
  onGroup: () => void;
  onProfile?: () => void;
};

function ProgressBar() {
  return (
    <View style={styles.progressRow}>
      {[0, 1, 2].map((step) => (
        <View
          key={step}
          style={[
            styles.progressSegment,
            { backgroundColor: step === 0 ? ACCENT : STEP_INACTIVE },
          ]}
        />
      ))}
    </View>
  );
}

export default function MoodScreen({ onContinue, onSkip, onGroup, onProfile }: Props) {
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [isSurprising, setIsSurprising] = useState(false);

  const toggleMood = (id: string) => {
    setSelectedMoods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSurprise = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSurprising(true);

    // Flash effect: rapidly cycle random highlights
    let flashCount = 0;
    const flashInterval = setInterval(() => {
      const shuffled = [...MOODS].sort(() => Math.random() - 0.5);
      setSelectedMoods(shuffled.slice(0, 3).map((m) => m.id));
      flashCount++;
      if (flashCount >= 4) {
        clearInterval(flashInterval);
        // Settle on final picks
        const finalShuffled = [...MOODS].sort(() => Math.random() - 0.5);
        const randomPicks = finalShuffled.slice(0, Math.floor(Math.random() * 2) + 2);
        const finalIds = randomPicks.map((m) => m.id);
        setSelectedMoods(finalIds);
        setTimeout(() => {
          setIsSurprising(false);
          onContinue(finalIds);
        }, 600);
      }
    }, 75);
  };

  const hasSelection = selectedMoods.length > 0;

  const renderMoodCard = ({ item }: { item: Mood }) => {
    const isSelected = selectedMoods.includes(item.id);
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => toggleMood(item.id)}
      >
        <Text style={styles.cardEmoji}>{item.emoji}</Text>
        <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
          {item.label}
        </Text>
        <Text style={[styles.cardHint, isSelected && styles.cardHintSelected]}>
          {item.hint}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.groupButton} onPress={onGroup}>
          <Text style={styles.groupIcon}>{"\u{1F465}"}</Text>
          <Text style={styles.groupText}>Group</Text>
        </TouchableOpacity>
        <ProgressBar />
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
        {onProfile && (
          <TouchableOpacity style={styles.profileButton} onPress={onProfile}>
            <Text style={styles.profileIcon}>{"\u{1F464}"}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>How are you feeling?</Text>

      <FlatList
        data={MOODS}
        renderItem={renderMoodCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContainer}
        scrollEnabled={false}
      />

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.surpriseButton}
          activeOpacity={0.8}
          onPress={handleSurprise}
          disabled={isSurprising}
        >
          <Text style={styles.surpriseText}>Surprise me {"\u{1F3B2}"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.continueButton, !hasSelection && styles.continueButtonDisabled]}
          disabled={!hasSelection}
          activeOpacity={0.8}
          onPress={() => onContinue(selectedMoods)}
        >
          <Text style={styles.continueText}>Continue</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  groupButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    paddingVertical: 4,
  },
  groupIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  groupText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "600",
  },
  progressRow: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  skipButton: {
    marginLeft: 16,
    paddingVertical: 4,
    paddingLeft: 12,
  },
  skipText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  profileButton: {
    marginLeft: 12,
    paddingVertical: 4,
  },
  profileIcon: {
    fontSize: 18,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 14,
  },
  gridContainer: {
    paddingHorizontal: 20,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardSelected: {
    borderColor: ACCENT,
    backgroundColor: "rgba(127, 119, 221, 0.12)",
  },
  cardEmoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  cardLabel: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "600",
  },
  cardLabelSelected: {
    color: ACCENT,
  },
  cardHint: {
    color: "#666666",
    fontSize: 10,
    marginTop: 2,
  },
  cardHintSelected: {
    color: "#9988DD",
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginTop: "auto",
  },
  surpriseButton: {
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  surpriseText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: "600",
  },
  continueButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueText: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "700",
  },
});
