import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const ACCENT = "#7F77DD";
const BG = "#0D0D0D";
const CARD_BG = "#1A1A1A";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#888888";
const GREEN = "#2ECC71";
const RED = "#E74C3C";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = 100;
const DAILY_LIMIT = 10;

type ValidateItem = {
  id: string;
  name: string;
  address: string;
  mood: string;
  photoColor: string;
};

const MOCK_VALIDATE_QUEUE: ValidateItem[] = [
  { id: "1", name: "Taberna da Rua das Flores", address: "Rua das Flores 103", mood: "romantic", photoColor: "#1A1A2E" },
  { id: "2", name: "ZeroZero", address: "Rua do Passadi\u00E7o 35", mood: "fresh", photoColor: "#0D1A0D" },
  { id: "3", name: "A Cevicheria", address: "Rua Dom Pedro V 129", mood: "energetic", photoColor: "#1A0D0D" },
  { id: "4", name: "Cantinho do Avillez", address: "Rua dos Duques de Bragan\u00E7a 7", mood: "hidden_gem", photoColor: "#1A1A0D" },
  { id: "5", name: "Solar dos Presuntos", address: "Rua Portas de Santo Ant\u00E3o 150", mood: "cozy", photoColor: "#0D0D1A" },
];

function moodLabel(mood: string): string {
  const map: Record<string, string> = {
    romantic: "Romantic",
    fresh: "Fresh",
    energetic: "Energetic",
    hidden_gem: "Hidden Gem",
    cozy: "Cozy",
  };
  return map[mood] || mood;
}

type Props = {
  onDone: () => void;
  onSkip: () => void;
};

export default function ValidateScreen({ onDone, onSkip }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [validated, setValidated] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);

  // Card animation
  const translateX = useRef(new Animated.Value(0)).current;
  const slideIn = useRef(new Animated.Value(0)).current;

  // Points fly-up animation
  const pointsOpacity = useRef(new Animated.Value(0)).current;
  const pointsTranslateY = useRef(new Animated.Value(0)).current;

  // YES / NO overlay opacity
  const yesOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const noOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const rotate = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-12deg", "0deg", "12deg"],
  });

  useEffect(() => {
    Animated.spring(slideIn, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [currentIndex]);

  const showPointsAnimation = () => {
    pointsOpacity.setValue(1);
    pointsTranslateY.setValue(0);
    Animated.parallel([
      Animated.timing(pointsOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(pointsTranslateY, {
        toValue: -60,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleAnswer = (direction: "left" | "right") => {
    const toValue = direction === "right" ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    Animated.timing(translateX, {
      toValue,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      slideIn.setValue(0);
      setValidated((v) => v + 1);
      setTotalPoints((p) => p + 5);
      showPointsAnimation();
      setCurrentIndex((i) => i + 1);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) {
          handleAnswer("right");
        } else if (g.dx < -SWIPE_THRESHOLD) {
          handleAnswer("left");
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const allDone = validated >= DAILY_LIMIT || currentIndex >= MOCK_VALIDATE_QUEUE.length;

  // --- Done State ---
  if (allDone) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>{"\u{1F525}"}</Text>
          <Text style={styles.doneTitle}>You're on fire!</Text>
          <Text style={styles.doneSubtitle}>
            Come back tomorrow for more validations.
          </Text>
          <Text style={styles.donePoints}>
            +{totalPoints} pts earned today
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={onDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const item = MOCK_VALIDATE_QUEUE[currentIndex % MOCK_VALIDATE_QUEUE.length];
  const progress = validated / DAILY_LIMIT;

  const cardScale = slideIn.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* --- Header --- */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Help us improve!</Text>
        </View>
        <Text style={styles.pointsTotal}>
          {"\u{2B50}"} {totalPoints} pts
        </Text>
      </View>

      <Text style={styles.subtitle}>
        Is this place {moodLabel(item.mood).toLowerCase()}? Swipe to validate and earn points
      </Text>

      {/* --- Card --- */}
      <View style={styles.cardWrapper}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX },
                { rotate },
                { scale: cardScale },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* YES overlay */}
          <Animated.View style={[styles.swipeOverlay, styles.yesOverlay, { opacity: yesOpacity }]}>
            <Text style={styles.swipeOverlayText}>YES</Text>
          </Animated.View>
          {/* NO overlay */}
          <Animated.View style={[styles.swipeOverlay, styles.noOverlay, { opacity: noOpacity }]}>
            <Text style={[styles.swipeOverlayText, { color: RED }]}>NO</Text>
          </Animated.View>

          {/* Photo placeholder */}
          <View style={[styles.photoPlaceholder, { backgroundColor: item.photoColor }]}>
            <Text style={styles.photoInitial}>{item.name.charAt(0)}</Text>
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardAddress}>{item.address}</Text>
          </View>
        </Animated.View>

        {/* Points fly-up */}
        <Animated.View
          style={[
            styles.pointsFlyup,
            {
              opacity: pointsOpacity,
              transform: [{ translateY: pointsTranslateY }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.pointsFlyupText}>+5 pts</Text>
        </Animated.View>
      </View>

      {/* --- Mood Question --- */}
      <Text style={styles.moodQuestion}>
        Is this <Text style={styles.moodHighlight}>{moodLabel(item.mood)}</Text>?
      </Text>

      {/* --- Buttons --- */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.noButton}
          onPress={() => handleAnswer("left")}
        >
          <Text style={styles.noButtonIcon}>{"\u2715"}</Text>
          <Text style={styles.noButtonText}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.yesButton}
          onPress={() => handleAnswer("right")}
        >
          <Text style={styles.yesButtonIcon}>{"\u2713"}</Text>
          <Text style={styles.yesButtonText}>Yes</Text>
        </TouchableOpacity>
      </View>

      {/* --- Progress --- */}
      <View style={styles.progressSection}>
        <Text style={styles.progressText}>
          {validated} of {DAILY_LIMIT} validated today
        </Text>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(progress * 100, 100)}%` },
            ]}
          />
        </View>
      </View>

      {/* --- Skip --- */}
      <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // --- Header ---
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "700",
  },
  pointsTotal: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: "700",
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
  },

  // --- Card ---
  cardWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    overflow: "hidden",
  },
  swipeOverlay: {
    position: "absolute",
    top: 30,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 3,
  },
  yesOverlay: {
    left: 20,
    borderColor: GREEN,
  },
  noOverlay: {
    right: 20,
    borderColor: RED,
  },
  swipeOverlayText: {
    fontSize: 26,
    fontWeight: "800",
    color: GREEN,
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  photoInitial: {
    color: ACCENT,
    fontSize: 56,
    fontWeight: "700",
    opacity: 0.3,
  },
  cardInfo: {
    padding: 16,
  },
  cardName: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "700",
  },
  cardAddress: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    marginTop: 4,
  },

  // --- Points fly-up ---
  pointsFlyup: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    zIndex: 20,
  },
  pointsFlyupText: {
    color: GREEN,
    fontSize: 28,
    fontWeight: "800",
  },

  // --- Mood Question ---
  moodQuestion: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  moodHighlight: {
    color: ACCENT,
  },

  // --- Buttons ---
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 40,
    marginBottom: 16,
  },
  noButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(231, 76, 60, 0.15)",
    borderWidth: 2,
    borderColor: RED,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  noButtonIcon: {
    color: RED,
    fontSize: 20,
    fontWeight: "700",
  },
  noButtonText: {
    color: RED,
    fontSize: 17,
    fontWeight: "700",
  },
  yesButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46, 204, 113, 0.15)",
    borderWidth: 2,
    borderColor: GREEN,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  yesButtonIcon: {
    color: GREEN,
    fontSize: 20,
    fontWeight: "700",
  },
  yesButtonText: {
    color: GREEN,
    fontSize: 17,
    fontWeight: "700",
  },

  // --- Progress ---
  progressSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  progressText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    marginBottom: 6,
    textAlign: "center",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#2A2A2A",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    backgroundColor: ACCENT,
    borderRadius: 3,
  },

  // --- Skip ---
  skipButton: {
    alignItems: "center",
    paddingVertical: 14,
    paddingBottom: 28,
  },
  skipText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },

  // --- Done ---
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  doneEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  doneTitle: {
    color: TEXT_PRIMARY,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
  },
  doneSubtitle: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    textAlign: "center",
    marginBottom: 16,
  },
  donePoints: {
    color: GREEN,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 32,
  },
  doneButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  doneButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
});
