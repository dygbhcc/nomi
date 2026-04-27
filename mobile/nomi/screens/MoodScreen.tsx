import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

type Mood = {
  id: string;
  label: string;
  emoji: string;
};

const MOODS: Mood[] = [
  { id: "romantic", label: "Romantic", emoji: "\u{1F56F}" },
  { id: "energetic", label: "Energetic", emoji: "\u26A1" },
  { id: "chill", label: "Chill", emoji: "\u{1F60A}" },
  { id: "adventurous", label: "Adventurous", emoji: "\u{1F9ED}" },
  { id: "focus", label: "Focus", emoji: "\u{1F3AF}" },
  { id: "retreat", label: "Retreat", emoji: "\u{1F9D8}" },
  { id: "hungry&quick", label: "Hungry & Quick", emoji: "\u{1F354}" },
  { id: "celebrating", label: "Celebrating", emoji: "\u{1F389}" },
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

export default function MoodScreen({ onContinue, onSkip, onGroup }: Props) {
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  const toggleMood = (id: string) => {
    setSelectedMoods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
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
  title: {
    color: TEXT_PRIMARY,
    fontSize: 26,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 24,
  },
  gridContainer: {
    paddingHorizontal: 20,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingVertical: 24,
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
    fontSize: 32,
    marginBottom: 8,
  },
  cardLabel: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "600",
  },
  cardLabelSelected: {
    color: ACCENT,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    marginTop: "auto",
  },
  continueButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
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
