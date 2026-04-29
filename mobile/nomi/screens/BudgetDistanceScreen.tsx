import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors, Shadows, Spacing, BorderRadius } from "../theme/colors";
import BottomNavigationBar from "../components/BottomNavigationBar";

type BudgetOption = {
  value: number;
  symbol: string;
  description: string;
};

type DistanceOption = {
  value: number;
  emoji: string;
  label: string;
  description: string;
};

const BUDGET_OPTIONS: BudgetOption[] = [
  { value: 1, symbol: "\u20AC", description: "Up to \u20AC15 per person" },
  { value: 2, symbol: "\u20AC\u20AC", description: "\u20AC15\u201335 per person" },
  { value: 3, symbol: "\u20AC\u20AC\u20AC", description: "\u20AC35+ per person" },
];

const DISTANCE_OPTIONS: DistanceOption[] = [
  { value: 500, emoji: "\u{1F6B6}", label: "Nearby", description: "Walking distance (500m)" },
  { value: 3000, emoji: "\u{1F697}", label: "A bit further", description: "2\u20135 km away" },
  { value: 10000, emoji: "\u{1F5FA}", label: "Explore", description: "Anywhere in the city" },
];

// Using central theme
const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const STEP_INACTIVE = Colors.stepInactive;

type Props = {
  selectedMoods: string[];
  onContinue: (budget: number, distance: number) => void;
  onBack: () => void;
  onSkip?: () => void;
  onNavigate: (screen: string) => void;
};

function ProgressBar() {
  return (
    <View style={styles.progressRow}>
      {[0, 1].map((step) => (
        <View
          key={step}
          style={[
            styles.progressSegment,
            { backgroundColor: step <= 1 ? ACCENT : STEP_INACTIVE },
          ]}
        />
      ))}
    </View>
  );
}

export default function BudgetDistanceScreen({ onContinue, onBack, onSkip, onNavigate }: Props) {
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);

  const handleContinue = () => {
    // Use default values if not selected (auto mode)
    const budget = selectedBudget ?? 2; // default: €€
    const distance = selectedDistance ?? 3000; // default: A bit further
    onContinue(budget, distance);
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      // If no skip handler, use auto mode with defaults
      handleContinue();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <View style={styles.progressBarWrapper}>
          <ProgressBar />
        </View>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Budget Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget</Text>
          <View style={styles.listContainer}>
            {BUDGET_OPTIONS.map((option) => {
              const isSelected = selectedBudget === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.7}
                  style={[styles.card, isSelected && styles.cardSelected]}
                  onPress={() => setSelectedBudget(option.value)}
                >
                  <Text style={[styles.cardSymbol, isSelected && styles.cardSymbolSelected]}>
                    {option.symbol}
                  </Text>
                  <Text style={[styles.cardDescription, isSelected && styles.cardDescriptionSelected]}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Distance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distance</Text>
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
        </View>
      </ScrollView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.continueButton}
          activeOpacity={0.8}
          onPress={handleContinue}
        >
          <Text style={styles.continueText}>Find Restaurants</Text>
        </TouchableOpacity>
      </View>

      <BottomNavigationBar activeTab="home" onNavigate={onNavigate} />
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
  skipButton: {
    marginLeft: 16,
    paddingVertical: 4,
    paddingLeft: 12,
  },
  skipText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
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
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: 16,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSelected: {
    borderColor: ACCENT,
    backgroundColor: "rgba(127, 119, 221, 0.08)",
  },
  cardSymbol: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
    width: 60,
  },
  cardSymbolSelected: {
    color: ACCENT,
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
    fontSize: 15,
    flex: 1,
  },
  cardDescriptionSelected: {
    color: TEXT_PRIMARY,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 70,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: BG,
  },
  continueButton: {
    width: "100%",
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
