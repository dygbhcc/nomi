import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../theme/colors";

// Using central theme
const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  illustration: "problem" | "solo" | "group";
};

const SLIDES: Slide[] = [
  {
    id: "1",
    title: "Tired of \u2018where should we eat?\u2019",
    subtitle: "Stop arguing. Let Nomi decide.",
    illustration: "problem",
  },
  {
    id: "2",
    title: "Swipe. Match. Eat.",
    subtitle:
      "Tell us your mood and budget. We\u2019ll find the perfect spot in seconds.",
    illustration: "solo",
  },
  {
    id: "3",
    title: "No more group chat chaos",
    subtitle: "Everyone votes, Nomi decides. Fair, fast, fun.",
    illustration: "group",
  },
];

// --- Illustrations ---

function ProblemIllustration() {
  return (
    <View style={ilStyles.container}>
      <View style={ilStyles.gradientCircle}>
        <Text style={ilStyles.questionMark}>?</Text>
      </View>
    </View>
  );
}

function SoloIllustration() {
  return (
    <View style={ilStyles.container}>
      <View style={ilStyles.mockCard}>
        <View style={ilStyles.mockPhoto} />
        <View style={ilStyles.mockInfo}>
          <View style={ilStyles.mockBadge}>
            <Text style={ilStyles.mockBadgeText}>romantic</Text>
          </View>
          <View style={[ilStyles.mockBadge, { backgroundColor: "rgba(46,204,113,0.2)" }]}>
            <Text style={[ilStyles.mockBadgeText, { color: "#2ECC71" }]}>
              chill
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function GroupIllustration() {
  const avatarColors = ["#E74C3C", "#2ECC71", "#3498DB"];
  return (
    <View style={ilStyles.container}>
      <View style={ilStyles.groupRow}>
        {avatarColors.map((color, i) => (
          <View key={i} style={ilStyles.groupSlot}>
            <View style={[ilStyles.groupAvatar, { backgroundColor: color }]}>
              <Text style={ilStyles.groupAvatarText}>
                {["\u{1F464}", "\u{1F464}", "\u{1F464}"][i]}
              </Text>
            </View>
            <Text style={ilStyles.checkmark}>{"\u2713"}</Text>
          </View>
        ))}
      </View>
      <View style={ilStyles.convergeArrow}>
        <Text style={ilStyles.convergeText}>{"\u25BC"}</Text>
      </View>
      <View style={ilStyles.resultCard}>
        <Text style={ilStyles.resultEmoji}>{"\u{1F37D}"}</Text>
        <Text style={ilStyles.resultText}>Winner!</Text>
      </View>
    </View>
  );
}

const ilStyles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH - 80,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  // Problem
  gradientCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 10,
  },
  questionMark: {
    color: TEXT_PRIMARY,
    fontSize: 72,
    fontWeight: "800",
  },
  // Solo
  mockCard: {
    width: 180,
    height: 220,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#2A2A2A",
  },
  mockPhoto: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  mockInfo: {
    flexDirection: "row",
    gap: 6,
    padding: 12,
  },
  mockBadge: {
    backgroundColor: "rgba(127,119,221,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  mockBadgeText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "600",
  },
  // Group
  groupRow: {
    flexDirection: "row",
    gap: 28,
    marginBottom: 8,
  },
  groupSlot: {
    alignItems: "center",
  },
  groupAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarText: {
    fontSize: 22,
  },
  checkmark: {
    color: "#2ECC71",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  convergeArrow: {
    marginVertical: 6,
  },
  convergeText: {
    color: TEXT_SECONDARY,
    fontSize: 24,
  },
  resultCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  resultEmoji: {
    fontSize: 24,
  },
  resultText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: "700",
  },
});

// --- Main Component ---

type Props = {
  onDone: () => void;
};

export default function OnboardingScreen({ onDone }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const isLast = activeIndex === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      onDone();
    } else {
      const next = activeIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    }
  };

  const renderIllustration = (type: Slide["illustration"]) => {
    switch (type) {
      case "problem":
        return <ProblemIllustration />;
      case "solo":
        return <SoloIllustration />;
      case "group":
        return <GroupIllustration />;
    }
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      <View style={styles.illustrationWrapper}>
        {renderIllustration(item.illustration)}
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Skip */}
      <View style={styles.skipRow}>
        <TouchableOpacity onPress={onDone} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(
            e.nativeEvent.contentOffset.x / SCREEN_WIDTH
          );
          setActiveIndex(idx);
        }}
        bounces={false}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Next / Get Started */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.nextButton}
          activeOpacity={0.8}
          onPress={goNext}
        >
          <Text style={styles.nextText}>
            {isLast ? "Get Started" : "Next"}
          </Text>
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
  skipRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  skipButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    flex: 1,
  },
  illustrationWrapper: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2A2A2A",
  },
  dotActive: {
    backgroundColor: ACCENT,
    width: 24,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  nextButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  nextText: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "700",
  },
});
