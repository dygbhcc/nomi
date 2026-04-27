import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

type BudgetOption = {
  value: number;
  symbol: string;
  description: string;
};

const BUDGET_OPTIONS: BudgetOption[] = [
  { value: 1, symbol: "\u20AC", description: "Up to \u20AC15 per person" },
  { value: 2, symbol: "\u20AC\u20AC", description: "\u20AC15\u201335 per person" },
  { value: 3, symbol: "\u20AC\u20AC\u20AC", description: "\u20AC35+ per person" },
];

const ACCENT = "#7F77DD";
const BG = "#0D0D0D";
const CARD_BG = "#1A1A1A";
const CARD_SELECTED_BG = "#1A1830";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#888888";
const STEP_INACTIVE = "#2A2A2A";

type Props = {
  selectedMoods: string[];
  onContinue: (budget: number) => void;
  onBack: () => void;
};

function ProgressBar() {
  return (
    <View style={styles.progressRow}>
      {[0, 1, 2].map((step) => (
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

export default function BudgetScreen({ onContinue, onBack }: Props) {
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);

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

      <Text style={styles.title}>What's your budget?</Text>

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

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.continueButton, selectedBudget === null && styles.continueButtonDisabled]}
          disabled={selectedBudget === null}
          activeOpacity={0.8}
          onPress={() => selectedBudget !== null && onContinue(selectedBudget)}
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
  cardSymbol: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
    width: 60,
  },
  cardSymbolSelected: {
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
