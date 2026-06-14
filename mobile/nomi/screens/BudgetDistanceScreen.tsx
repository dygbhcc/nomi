import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Colors, Shadows, Spacing, BorderRadius } from "../theme/colors";
import BottomNavigationBar from "../components/BottomNavigationBar";
import { useAuth } from "../context/AuthContext";
import { createRoom } from "../services/roomService";

type BudgetOption = {
  value: number;
  symbol: string;
  labelKey: string;
};

type DistanceOption = {
  value: number;
  emoji: string;
  titleKey: string;
  subtitleKey: string;
};

const BUDGET_OPTIONS: BudgetOption[] = [
  { value: 1, symbol: "\u20AC", labelKey: "budget.budgetOptions.1.label" },
  { value: 2, symbol: "\u20AC\u20AC", labelKey: "budget.budgetOptions.2.label" },
  { value: 3, symbol: "\u20AC\u20AC\u20AC", labelKey: "budget.budgetOptions.3.label" },
];

const DISTANCE_OPTIONS: DistanceOption[] = [
  { value: 500, emoji: "\u{1F6B6}", titleKey: "budget.distanceOptions.500.title", subtitleKey: "budget.distanceOptions.500.subtitle" },
  { value: 3500, emoji: "\u{1F697}", titleKey: "budget.distanceOptions.3500.title", subtitleKey: "budget.distanceOptions.3500.subtitle" },
  { value: 10000, emoji: "\u{1F5FA}", titleKey: "budget.distanceOptions.10000.title", subtitleKey: "budget.distanceOptions.10000.subtitle" },
];

// Both sections plus the CTA and tab bar must fit one viewport without
// scrolling — scale paddings down on short screens instead of overflowing.
const SCREEN_HEIGHT = Dimensions.get("window").height;
const IS_COMPACT = SCREEN_HEIGHT < 760;
const sz = (regular: number, compact: number) => (IS_COMPACT ? compact : regular);

// Using central theme
const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const STEP_INACTIVE = Colors.stepInactive;

type Props = {
  selectedMoods: string[];
  isGroupMode?: boolean;
  isHost?: boolean;
  roomCode?: string;
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

export default function BudgetDistanceScreen({
  selectedMoods,
  isGroupMode = false,
  isHost = false,
  roomCode = "",
  onContinue,
  onBack,
  onSkip,
  onNavigate
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);

  const handleContinue = async () => {
    // Use default values if not selected (auto mode)
    const budget = selectedBudget ?? 2; // default: €€
    const distance = selectedDistance ?? 3500; // default: A bit further

    // If host in group mode, create room with preferences
    if (isGroupMode && isHost && roomCode && user) {
      __DEV__ && console.log('Creating room with host preferences:', { selectedMoods, budget, distance });
      try {
        await createRoom(
          roomCode,
          user.uid,
          user.displayName || 'Host',
          {
            moods: selectedMoods,
            budget,
            distance: Math.round(distance / 1000), // Convert to km
          }
        );
        __DEV__ && console.log('Room created successfully');
      } catch (error) {
        __DEV__ && console.error('Error creating room:', error);
      }
    }

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
          <Text style={styles.backText}>{"\u2190"} {t('common.back')}</Text>
        </TouchableOpacity>
        <View style={styles.progressBarWrapper}>
          <ProgressBar />
        </View>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>{t('common.skip')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {/* Budget Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('budget.budgetTitle')}</Text>
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
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Distance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('budget.distanceTitle')}</Text>
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
                      {t(option.titleKey)}
                    </Text>
                    <Text style={[styles.cardDescription, isSelected && styles.cardDescriptionSelected]}>
                      {t(option.subtitleKey)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomContainer, { marginBottom: 64 + insets.bottom }]}>
        <TouchableOpacity
          style={styles.continueButton}
          activeOpacity={0.8}
          onPress={handleContinue}
        >
          <Text style={styles.continueText}>{t('budget.continueButton')}</Text>
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
    paddingBottom: 8,
  },
  section: {
    marginTop: sz(16, 10),
  },
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: sz(20, 18),
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: sz(10, 8),
  },
  listContainer: {
    paddingHorizontal: 20,
    gap: sz(10, 8),
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingVertical: sz(14, 10),
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
    // Solid tint, not a translucent rgba — a semi-transparent background with
    // Android `elevation` renders a gray shadow box behind the card.
    backgroundColor: "#FDF6F4",
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
    fontSize: sz(28, 24),
    marginRight: 16,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardLabel: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 4,
  },
  cardLabelSelected: {
    color: TEXT_PRIMARY,
  },
  cardDescription: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    flex: 1,
  },
  cardDescriptionSelected: {
    color: "#666666",
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: BG,
    // marginBottom set inline as 64 + insets.bottom to clear the absolute nav bar
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
