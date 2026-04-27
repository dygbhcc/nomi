import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

type DistanceOption = {
  value: number;
  emoji: string;
  label: string;
  description: string;
};

const DISTANCE_OPTIONS: DistanceOption[] = [
  { value: 500, emoji: "\u{1F6B6}", label: "Nearby", description: "Walking distance (500m)" },
  { value: 3000, emoji: "\u{1F697}", label: "A bit further", description: "2\u20135 km away" },
  { value: 10000, emoji: "\u{1F5FA}", label: "Explore", description: "Anywhere in the city" },
];

const ACCENT = "#7F77DD";
const BG = "#0D0D0D";
const CARD_BG = "#1A1A1A";
const CARD_SELECTED_BG = "#1A1830";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#888888";

type Props = {
  selectedMoods: string[];
  selectedBudget: number | null;
  onContinue: (distance: number) => void;
  onBack: () => void;
};

function ProgressBar() {
  return (
    <View style={styles.progressRow}>
      {[0, 1, 2].map((step) => (
        <View key={step} style={[styles.progressSegment, { backgroundColor: ACCENT }]} />
      ))}
    </View>
  );
}

export default function DistanceScreen({ selectedMoods, selectedBudget, onContinue, onBack }: Props) {
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);

  const handleFind = () => {
    if (selectedDistance === null) return;
    console.log({ moods: selectedMoods, budget: selectedBudget, distance: selectedDistance });
    onContinue(selectedDistance);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <View style={styles.progressBarWrapper}>
          <ProgressBar />
        </View>
      </View>

      <Text style={styles.title}>How far are you willing to go?</Text>

      <View style={styles.listContainer}>
        {DISTANCE_OPTIONS.map((option) => {
          const isSelected = selectedDistance === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              activeOpacity={0.7}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setSelectedDistance(option.value)}
            >
              <Text style={styles.cardEmoji}>{option.emoji}</Text>
              <View style={styles.cardTextContainer}>
                <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                  {option.label}
                </Text>
                <Text style={[styles.cardDescription, isSelected && styles.cardDescriptionSelected]}>
                  {option.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.findButton, selectedDistance === null && styles.findButtonDisabled]}
          disabled={selectedDistance === null}
          activeOpacity={0.8}
          onPress={handleFind}
        >
          <Text style={styles.findText}>Find Restaurants</Text>
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
  backButton: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  backText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  progressBarWrapper: {
    flex: 1,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 26,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 24,
  },
  listContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardSelected: {
    borderColor: ACCENT,
    backgroundColor: CARD_SELECTED_BG,
  },
  cardEmoji: {
    fontSize: 28,
    marginRight: 16,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardLabel: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 2,
  },
  cardLabelSelected: {
    color: ACCENT,
  },
  cardDescription: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  cardDescriptionSelected: {
    color: TEXT_PRIMARY,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    marginTop: "auto",
  },
  findButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  findButtonDisabled: {
    opacity: 0.4,
  },
  findText: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "700",
  },
});
