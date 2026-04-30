import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Image,
  ImageSourcePropType,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { Colors, Shadows, Spacing, BorderRadius } from "../theme/colors";
import BottomNavigationBar from "../components/BottomNavigationBar";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - 12) / 2; // 2 columns, 20px padding, 12px gap
const CARD_IMAGE_HEIGHT = CARD_WIDTH * 0.65; // image takes 65% of card width

type Mood = {
  id: string;
  label: string;
  emoji?: string;
  image?: ImageSourcePropType;
  hint: string;
};

const MOODS: Mood[] = [
  { id: "romantic", label: "Romantic", image: require("../assets/images/romantic_old.png"), hint: "Dim lights, date night" },
  { id: "energetic", label: "Energetic", image: require("../assets/images/energetic.png"), hint: "Loud, buzzing, fun" },
  { id: "chill", label: "Chill", image: require("../assets/images/chill.png"), hint: "Warm, relaxed, no rush" },
  { id: "explorer", label: "Explore", image: require("../assets/images/explore.png"), hint: "New spots, hidden gems" },
  { id: "focus", label: "Focus", image: require("../assets/images/focus.png"), hint: "Quiet, good wifi, calm" },
  { id: "hungry&quick", label: "Hungry & Quick", image: require("../assets/images/hungry.png"), hint: "Fast, filling, no wait" },
  { id: "surprise", label: "I don't know, surprise me", image: require("../assets/images/surprise.png"), hint: "Unexpected, exciting, fun" },

];

// Using central theme
const ACCENT = Colors.accent;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const STEP_INACTIVE = Colors.stepInactive;

type Props = {
  onContinue: (selectedMoods: string[]) => void;
  onSkip: () => void;
  onGroup: () => void;
  onProfile?: () => void;
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
            { backgroundColor: step === 0 ? ACCENT : STEP_INACTIVE },
          ]}
        />
      ))}
    </View>
  );
}

export default function MoodScreen({ onContinue, onSkip, onGroup, onProfile, onNavigate }: Props) {
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

  const renderMoodCard = ({ item, index }: { item: Mood; index: number }) => {
    const isLast = index === MOODS.length - 1;
    const isSelected = selectedMoods.includes(item.id);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          styles.card,
          isSelected && styles.cardSelected,
          isLast && styles.cardFullWidth,
        ]}
        onPress={() => item.id === 'surprise' ? handleSurprise() : toggleMood(item.id)}
        accessibilityLabel={`${item.label} mood. ${item.hint}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
      >
        {isLast ? (
          <>
            {item.image && <Image source={item.image} style={styles.cardImageSmall} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                {item.label}
              </Text>
              <Text style={[styles.cardHint, isSelected && styles.cardHintSelected]}>
                {item.hint}
              </Text>
            </View>
          </>
        ) : (
          <>
            
            <Image source={item.image} style={styles.cardImage} />
    
            <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
              {item.label}
            </Text>
            <Text style={[styles.cardHint, isSelected && styles.cardHintSelected]}>
              {item.hint}
            </Text>
            {isSelected && (
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>✓</Text>
              </View>
            )}
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.groupButton}
          onPress={onGroup}
          accessibilityLabel="Create or join group session"
          accessibilityRole="button"
        >
          <Text style={styles.groupIcon}>{"\u{1F465}"}</Text>
          <Text style={styles.groupText}>Group</Text>
        </TouchableOpacity>
        <ProgressBar />
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          accessibilityLabel="Skip mood selection"
          accessibilityRole="button"
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
        {onProfile && (
          <TouchableOpacity
            style={styles.profileButton}
            onPress={onProfile}
            accessibilityLabel="View profile"
            accessibilityRole="button"
          >
            <Text style={styles.profileIcon}>{"\u{1F464}"}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>How are you feeling?</Text>

          {(() => {
            // Create rows: pair items except last one
            const rows = [];
            const items = MOODS.slice(0, -1); // all except last
            for (let i = 0; i < items.length; i += 2) {
              rows.push([items[i], items[i + 1]].filter(Boolean));
            }
            rows.push([MOODS[MOODS.length - 1]]); // surprise as own row

            return rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((item) => renderMoodCard({ item, index: MOODS.indexOf(item) }))}
              </View>
            ));
          })()}
        </ScrollView>

        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.continueButton, !hasSelection && styles.continueButtonDisabled]}
            disabled={!hasSelection}
            activeOpacity={0.8}
            onPress={() => onContinue(selectedMoods)}
            accessibilityLabel="Continue with selected moods"
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasSelection }}
          >
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomNavigationBar activeTab="home" onNavigate={onNavigate} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  groupButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    paddingVertical: 10, // FIX 6 - Increased from 4 for 44px touch target
    minHeight: 44,
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
    paddingVertical: 10, // FIX 6 - Increased from 4 for 44px touch target
    paddingLeft: 12,
    minHeight: 44,
  },
  skipText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  profileButton: {
    marginLeft: 12,
    padding: 10, // FIX 6 - Increased for 44px touch target
    minHeight: 44,
    minWidth: 44,
  },
  profileIcon: {
    fontSize: 18,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: "700",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  gridContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: 'rgba(224, 106, 79, 0.04)',
  },
  cardFullWidth: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 0,
  },
  cardImage: {
    width: "100%",
    height: CARD_IMAGE_HEIGHT,
    resizeMode: "contain",
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  cardImageSmall: {
    width: 70,
    height: 70,
    resizeMode: "contain",
  },
  cardLabel: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 6,
  },
  cardLabelSelected: {
    color: ACCENT,
  },
  cardHint: {
    color: "#888888",
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  cardHintSelected: {
    color: "#C25A41",
  },
  checkmark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#F7F7F7',
    marginBottom: 70,
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
