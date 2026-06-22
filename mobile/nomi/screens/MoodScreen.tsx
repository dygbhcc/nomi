import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  ImageSourcePropType,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Colors, Shadows, Spacing, BorderRadius } from "../theme/colors";
import BottomNavigationBar from "../components/BottomNavigationBar";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - 12) / 2; // 2 columns, 20px padding, 12px gap
const CARD_IMAGE_HEIGHT = CARD_WIDTH * 0.65; // image takes 65% of card width

// The mood grid fills the screen with flex rows; on short screens the flex:1
// card images are squeezed to zero height, so scale text/chrome down and
// guarantee a minimum image size instead.
const IS_COMPACT = SCREEN_HEIGHT < 760;
const sz = (regular: number, compact: number) => (IS_COMPACT ? compact : regular);

type Mood = {
  id: string;
  labelKey: string;
  emoji?: string;
  image?: ImageSourcePropType;
  hintKey: string;
};

const MOODS: Mood[] = [
  { id: "romantic", labelKey: "mood.moods.romantic.label", image: require("../assets/images/romantic_old.png"), hintKey: "mood.moods.romantic.hint" },
  { id: "energetic", labelKey: "mood.moods.energetic.label", image: require("../assets/images/energetic.png"), hintKey: "mood.moods.energetic.hint" },
  { id: "chill", labelKey: "mood.moods.chill.label", image: require("../assets/images/chill.png"), hintKey: "mood.moods.chill.hint" },
  { id: "explorer", labelKey: "mood.moods.explorer.label", image: require("../assets/images/explore.png"), hintKey: "mood.moods.explorer.hint" },
  { id: "focus", labelKey: "mood.moods.focus.label", image: require("../assets/images/focus.png"), hintKey: "mood.moods.focus.hint" },
  { id: "hungry&quick", labelKey: "mood.moods.hungryQuick.label", image: require("../assets/images/hungry.png"), hintKey: "mood.moods.hungryQuick.hint" },
  { id: "surprise", labelKey: "mood.moods.surprise.label", image: require("../assets/images/surprise.png"), hintKey: "mood.moods.surprise.hint" },

];

// Using central theme
const ACCENT = Colors.accent;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const STEP_INACTIVE = Colors.stepInactive;

type Props = {
  onContinue: (selectedMoods: string[]) => void;
  onSkip: () => void;
  onGroup?: () => void; // B-02: group now lives only in the bottom nav bar
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

export default function MoodScreen({ onContinue, onSkip, onProfile, onNavigate }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [showTestButtons, setShowTestButtons] = useState(false);

  const toggleMood = (id: string) => {
    setSelectedMoods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSurprise = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // B-09: pick 2-3 random real moods silently and go straight to the next
    // screen. The old version flashed the selection on-screen, which looked
    // like the UI was glitching and exposed that the app picked the moods.
    const realMoods = MOODS.filter((m) => m.id !== "surprise");
    const shuffled = [...realMoods].sort(() => Math.random() - 0.5);
    const count = Math.floor(Math.random() * 2) + 2; // 2 or 3 moods
    const finalIds = shuffled.slice(0, count).map((m) => m.id);
    onContinue(finalIds);
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
        accessibilityLabel={`${t(item.labelKey)} mood. ${t(item.hintKey)}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
      >
        {isLast ? (
          <>
            {item.image && <Image source={item.image} style={styles.cardImageSmall} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                {t(item.labelKey)}
              </Text>
              <Text style={[styles.cardHint, isSelected && styles.cardHintSelected]}>
                {t(item.hintKey)}
              </Text>
            </View>
          </>
        ) : (
          <>
            
            <Image source={item.image} style={styles.cardImage} />
    
            <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
              {t(item.labelKey)}
            </Text>
            <Text style={[styles.cardHint, isSelected && styles.cardHintSelected]}>
              {t(item.hintKey)}
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
        {/* B-02: top "Group" entry removed to keep the main menu solo-only.
            Group sessions are reachable from the bottom navigation bar. */}
        <ProgressBar />
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          accessibilityLabel="Skip mood selection"
          accessibilityRole="button"
        >
          <Text style={styles.skipText}>{t('common.skip')}</Text>
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
        <View style={styles.gridContainer}>
          <Text style={styles.title}>{t('mood.title')}</Text>

          {(() => {
            // Create rows: pair items except last one
            const rows = [];
            const items = MOODS.slice(0, -1); // all except last
            for (let i = 0; i < items.length; i += 2) {
              rows.push([items[i], items[i + 1]].filter(Boolean));
            }
            rows.push([MOODS[MOODS.length - 1]]); // surprise as own row

            return rows.map((row, rowIndex) => {
              const isSurpriseRow = rowIndex === rows.length - 1;
              return (
                <View
                  key={rowIndex}
                  style={[styles.gridRow, !isSurpriseRow && styles.gridRowFlex]}
                >
                  {row.map((item) => (
                    <React.Fragment key={item.id}>
                      {renderMoodCard({ item, index: MOODS.indexOf(item) })}
                    </React.Fragment>
                  ))}
                </View>
              );
            });
          })()}
        </View>

        <View style={[styles.bottomContainer, { marginBottom: 64 + insets.bottom }]}>
          {/* TEST BUTTONS - Only visible in development */}
          {__DEV__ && showTestButtons && (
            <>
              <TouchableOpacity
                style={[styles.testButton]}
                onPress={() => onNavigate('result')}
              >
                <Text style={styles.testButtonText}>🧪 Test Result Screen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.testButton, { backgroundColor: '#059669' }]}
                onPress={() => onNavigate('onboarding')}
              >
                <Text style={styles.testButtonText}>👋 Show Onboarding</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.testButton, { backgroundColor: '#dc2626' }]}
                onPress={() => onNavigate('validate')}
              >
                <Text style={styles.testButtonText}>✅ Validate Screen</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.continueButton, !hasSelection && styles.continueButtonDisabled]}
            disabled={!hasSelection}
            activeOpacity={0.8}
            onPress={() => onContinue(selectedMoods)}
            accessibilityLabel="Continue with selected moods"
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasSelection }}
          >
            <Text style={styles.continueText}>{t('common.continue')}</Text>
          </TouchableOpacity>

          {/* Toggle test buttons with triple tap on title */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.testToggle}
              onPress={() => setShowTestButtons(!showTestButtons)}
            >
              <Text style={styles.testToggleText}>
                {showTestButtons ? '🧪 Hide Test' : 'Tap 3x for Test'}
              </Text>
            </TouchableOpacity>
          )}
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
    fontSize: sz(24, 20),
    fontWeight: "700",
    paddingHorizontal: 16,
    marginTop: sz(16, 8),
    marginBottom: sz(16, 8),
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  gridRowFlex: {
    flex: 1,
  },
  card: {
    flex: 1,
    justifyContent: "center",
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
    paddingVertical: sz(20, 12),
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
    flex: 1,
    width: "100%",
    minHeight: 32,
    maxHeight: CARD_IMAGE_HEIGHT,
    resizeMode: "contain",
    paddingHorizontal: 8,
    paddingTop: sz(8, 2),
  },
  cardImageSmall: {
    width: sz(70, 52),
    height: sz(70, 52),
    resizeMode: "contain",
  },
  cardLabel: {
    color: TEXT_PRIMARY,
    fontSize: sz(16, 14),
    fontWeight: "600",
    textAlign: "center",
    marginTop: sz(6, 2),
    paddingHorizontal: 6,
  },
  cardLabelSelected: {
    color: ACCENT,
  },
  cardHint: {
    color: "#888888",
    fontSize: sz(11, 10),
    textAlign: "center",
    marginTop: 2,
    marginBottom: sz(10, 4),
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
    // marginBottom set inline as 64 + insets.bottom to clear the absolute nav bar
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
  testButton: {
    backgroundColor: '#9333ea',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  testToggle: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  testToggleText: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    opacity: 0.5,
  },
});
