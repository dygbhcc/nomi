import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  Image,
  ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";

type Mood = {
  id: string;
  label: string;
  emoji?: string;
  image?: ImageSourcePropType;
  hint: string;
};

const MOODS: Mood[] = [
  { id: "romantic", label: "Romantic", image: require("../assets/images/romantic.png"), hint: "Dim lights, date night" },
  { id: "energetic", label: "Energetic", image: require("../assets/images/energetic.png"), hint: "Loud, buzzing, fun" },
  { id: "chill", label: "Chill", image: require("../assets/images/chill.png"), hint: "Warm, relaxed, no rush" },
  { id: "explorer", label: "Explore", image: require("../assets/images/explore.png"), hint: "New spots, off the beaten path" },
  { id: "focus", label: "Focus", image: require("../assets/images/focus.png"), hint: "Quiet, good wifi, calm" },
  { id: "hungry&quick", label: "Hungry & Quick", image: require("../assets/images/hungry.png"), hint: "Fast, filling, no wait" },
  { id: "surprising", label: "I don't know, surprise me", emoji: "\u{1F60E}", hint: "Unexpected, exciting, fun" },

];

const ACCENT = "#7F77DD";
const BG = "#F5F5F0";
const CARD_BG = "#FFFFFF";
const TEXT_PRIMARY = "#1A1A1A";
const TEXT_SECONDARY = "#666666";
const STEP_INACTIVE = "#E0E0E0";

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
        {item.image ? (
          <Image source={item.image} style={styles.cardImage} />
        ) : (
          <Text style={styles.cardEmoji}>{item.emoji}</Text>
        )}
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
      <StatusBar style="dark" />

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

      <FlatList
        style={{ flex: 1 }}
        data={MOODS}
        renderItem={renderMoodCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.title}>How are you feeling?</Text>
        }
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
    marginTop: 24,
    marginBottom: 24,
  },
  gridContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 12,
    minHeight: 130,
    alignItems: "center",
    justifyContent: "flex-start",
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
  cardEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  cardImage: {
    width: 70,
    height: 70,
    marginBottom: 8,
    resizeMode: "contain",
  },
  cardLabel: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  cardLabelSelected: {
    color: ACCENT,
  },
  cardHint: {
    color: "#888888",
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  cardHintSelected: {
    color: "#6B63B5",
  },
  bottomContainer: {
    paddingHorizontal: 20,
  
    paddingTop: 16,
    paddingBottom: 20,
  },
  
  
  continueButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    width: "100%",
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
