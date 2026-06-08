import { useTranslation } from "react-i18next";
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { Colors } from "../theme/colors";
import SwipeVoteCard from "../components/SwipeVoteCard";
import BottomNavigationBar from "../components/BottomNavigationBar";
import { recordValidation } from "../services/swipeService";
import { useAuth } from "../context/AuthContext";

const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
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
  photo?: ImageSourcePropType;
};

const MOCK_VALIDATE_QUEUE: ValidateItem[] = [
  {
    id: "1",
    name: "Taberna da Rua das Flores",
    address: "Rua das Flores 103",
    mood: "romantic",
    photoColor: "#1A1A2E",
    photo: require("../assets/images/restaurants/taberna-rua-das-flores.jpg")
  },
  {
    id: "2",
    name: "ZeroZero",
    address: "Rua do Passadi\u00E7o 35",
    mood: "focus",
    photoColor: "#0D1A0D",
    photo: require("../assets/images/restaurants/zerozero.jpg")
  },
  {
    id: "3",
    name: "A Cevicheria",
    address: "Rua Dom Pedro V 129",
    mood: "energetic",
    photoColor: "#1A0D0D",
    photo: require("../assets/images/restaurants/cevicheria.jpg")
  },
  {
    id: "4",
    name: "Cantinho do Avillez",
    address: "Rua dos Duques de Bragan\u00E7a 7",
    mood: "explorer",
    photoColor: "#1A1A0D",
    photo: require("../assets/images/restaurants/catinho.jpg")
  },
  {
    id: "5",
    name: "Solar dos Presuntos",
    address: "Rua Portas de Santo Ant\u00E3o 150",
    mood: "chill",
    photoColor: "#0D0D1A",
    photo: require("../assets/images/restaurants/solar.jpg")
  },
];


type Props = {
  onDone: () => void;
  onSkip: () => void;
  onNavigate: (screen: string) => void;
};

export default function ValidateScreen({ onDone, onSkip, onNavigate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
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

  const handleAnswer = async (direction: "left" | "right") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const currentItem = MOCK_VALIDATE_QUEUE[currentIndex % MOCK_VALIDATE_QUEUE.length];

    // Record validation to Firestore
    if (user && currentItem) {
      await recordValidation(
        user.uid,
        currentItem.id,
        currentItem.mood,
        direction === "right"
      );
    }

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

  const allDone = validated >= DAILY_LIMIT;

  // --- Done State ---
  if (allDone) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>{"\u{1F525}"}</Text>
          <Text style={styles.doneTitle}>{t('validate.doneTitle')}</Text>
          <Text style={styles.doneSubtitle}>
            {t('validate.doneMessage')}
          </Text>
          <Text style={styles.donePoints}>
            {t('validate.earnedToday', { points: totalPoints })}
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={onDone}>
            <Text style={styles.doneButtonText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const item = MOCK_VALIDATE_QUEUE[currentIndex % MOCK_VALIDATE_QUEUE.length];
  const progress = validated / DAILY_LIMIT;

  // Pick one random question from the mood's question pool per card
  const currentQuestion = useMemo(() => {
    const questions = t(`validate.questions.${item.mood}`, { returnObjects: true }) as string[];
    if (Array.isArray(questions) && questions.length > 0) {
      return questions[Math.floor(Math.random() * questions.length)];
    }
    return t(`validate.moods.${item.mood}`) + '?';
  }, [currentIndex, t, item.mood]);

  const cardScale = slideIn.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* --- Header --- */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('validate.helpImprove')}</Text>
        </View>
        <Text style={styles.pointsTotal}>
          {"\u{2B50}"} {totalPoints} pts
        </Text>
      </View>

      <Text style={styles.subtitle}>
        {t(`validate.moods.${item.mood}`)}
      </Text>

      {/* --- Card --- */}
      <View style={styles.cardWrapper}>
        <SwipeVoteCard
          name={item.name}
          address={item.address}
          photo={item.photo}
          photoColor={item.photoColor}
          translateX={translateX}
          rotate={rotate}
          scale={cardScale}
          likeOpacity={yesOpacity}
          nopeOpacity={noOpacity}
          panHandlers={panResponder.panHandlers}
          likeLabel={t('common.yes').toUpperCase()}
          rejectLabel={t('common.no').toUpperCase()}
          rejectColor={RED}
        />

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
          <Text style={styles.pointsFlyupText}>{t('validate.earnedPoints', { points: 5 })}</Text>
        </Animated.View>
      </View>

      {/* --- Mood Question --- */}
      <Text style={styles.moodQuestion}>
        {currentQuestion}
      </Text>

      {/* --- Buttons --- */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.noButton}
          onPress={() => handleAnswer("left")}
        >
          <Text style={styles.noButtonIcon}>{"\u2715"}</Text>
          <Text style={styles.noButtonText}>{t('common.no')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.yesButton}
          onPress={() => handleAnswer("right")}
        >
          <Text style={styles.yesButtonIcon}>{"\u2713"}</Text>
          <Text style={styles.yesButtonText}>{t('common.yes')}</Text>
        </TouchableOpacity>
      </View>

      {/* --- Progress --- */}
      <View style={styles.progressSection}>
        <Text style={styles.progressText}>
          {t('validate.progressValue', { current: validated, total: DAILY_LIMIT })}
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
        <Text style={styles.skipText}>{t('mood.skipButton')}</Text>
      </TouchableOpacity>

      <BottomNavigationBar activeTab="validate" onNavigate={onNavigate} />
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
    backgroundColor: Colors.stepInactive,
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
    paddingBottom: 100,
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
