import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Colors } from "../theme/colors";

const ACCENT = Colors.accent;
const TEXT = Colors.textPrimary;
const MUTED = "#8C6B55";
const WARM_BG = "#FFF4EE";

const TOTAL_SCREENS = 5;

// --- Floating Food Emojis (Splash) ---

const FOOD_ITEMS = [
  { emoji: "\u{1F355}", x: 12, y: 10, size: 76 },
  { emoji: "\u{1F35C}", x: 70, y: 10, size: 68 },
  { emoji: "\u{1F957}", x: 6, y: 68, size: 64 },
  { emoji: "\u{1F363}", x: 80, y: 62, size: 70 },
  { emoji: "\u{1F379}", x: 58, y: 30, size: 62 },
];

function FloatingFood() {
  const anims = useRef(FOOD_ITEMS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    anims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 2400 + i * 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 2400 + i * 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {FOOD_ITEMS.map((item, i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            left: `${item.x}%`,
            top: `${item.y}%`,
            fontSize: item.size,
            opacity: 0.85,
            transform: [
              {
                translateY: anims[i].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -14],
                }),
              },
            ],
          }}
        >
          {item.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

// --- Screen 0: Splash ---

function SplashSlide({ t }: { t: any }) {
  return (
    <View style={[slideStyles.container, { backgroundColor: WARM_BG }]}>
      {/* Decorative circles */}
      <View style={splashStyles.circleTopRight} />
      <View style={splashStyles.circleBottomLeft} />
      <FloatingFood />
      <View style={splashStyles.content}>
        <Image
          source={require("../assets/nomi-logo.png")}
          style={splashStyles.logo}
          resizeMode="contain"
        />
        <Text style={splashStyles.tagline}>
          {t("onboarding.splash.tagline1")}
          {"\n"}
          <Text style={splashStyles.taglineAccent}>
            {t("onboarding.splash.tagline2")}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  circleTopRight: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,138,61,0.10)",
  },
  circleBottomLeft: {
    position: "absolute",
    bottom: 120,
    left: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(224,106,79,0.08)",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 2,
  },
  logo: {
    width: 200,
    height: 70,
    marginBottom: 28,
  },
  tagline: {
    color: TEXT,
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  taglineAccent: {
    color: ACCENT,
  },
});

// --- Screen 1: Value1 (Where should we eat?) ---

function Value1Slide({ t }: { t: any }) {
  return (
    <View style={[slideStyles.container, { backgroundColor: WARM_BG }]}>
      <View style={value1Styles.content}>
        {/* Chat bubbles */}
        <View style={value1Styles.bubblesContainer}>
          {/* Left bubble */}
          <View style={[value1Styles.bubble, value1Styles.bubbleLeft]}>
            <Text style={value1Styles.bubbleTextDark}>
              {t("onboarding.value1.bubble1")} {"\u{1F363}"}
            </Text>
          </View>
          {/* Right bubble */}
          <View style={[value1Styles.bubble, value1Styles.bubbleRight]}>
            <Text style={value1Styles.bubbleTextAccent}>
              {t("onboarding.value1.bubble2")} {"\u{1F355}"}
            </Text>
          </View>
          {/* Center bottom bubble */}
          <View style={[value1Styles.bubble, value1Styles.bubbleCenter]}>
            <Text style={value1Styles.bubbleTextMuted}>
              {t("onboarding.value1.bubble3")} {"\u{1F937}"}
            </Text>
          </View>
        </View>

        <Text style={value1Styles.title}>
          {t("onboarding.value1.title1")}
          {"\n"}
          <Text style={value1Styles.titleAccent}>
            {t("onboarding.value1.title2")}
          </Text>
        </Text>
        <Text style={value1Styles.subtitle}>
          {t("onboarding.value1.subtitle")}
        </Text>
      </View>
    </View>
  );
}

const value1Styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  bubblesContainer: {
    width: 220,
    height: 130,
    marginBottom: 28,
    position: "relative",
  },
  bubble: {
    position: "absolute",
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  bubbleLeft: {
    left: 0,
    top: 24,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1.5,
    borderColor: "#F0E8E4",
  },
  bubbleRight: {
    right: 0,
    top: 0,
    backgroundColor: "rgba(224,106,79,0.08)",
    borderRadius: 18,
    borderBottomRightRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(224,106,79,0.2)",
  },
  bubbleCenter: {
    left: "50%",
    bottom: 0,
    transform: [{ translateX: -65 }],
    backgroundColor: "#fff",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1.5,
    borderColor: "#F0E8E4",
  },
  bubbleTextDark: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT,
  },
  bubbleTextAccent: {
    fontSize: 14,
    fontWeight: "600",
    color: ACCENT,
  },
  bubbleTextMuted: {
    fontSize: 14,
    fontWeight: "600",
    color: MUTED,
  },
  title: {
    color: TEXT,
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 42,
    marginBottom: 16,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  titleAccent: {
    color: ACCENT,
  },
  subtitle: {
    color: MUTED,
    fontSize: 17,
    textAlign: "center",
    lineHeight: 26,
  },
});

// --- Screen 2: Swipe Match ---

function SwipeSlide({ t }: { t: any }) {
  return (
    <View style={[slideStyles.container, { backgroundColor: "#fff", justifyContent: "center" }]}>
      <View style={swipeStyles.topSection}>
        {/* Card stack */}
        <View style={swipeStyles.cardStack}>
          {/* Back card */}
          <View style={[swipeStyles.card, swipeStyles.cardBack]}>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80" }}
              style={swipeStyles.cardImage}
            />
            <View style={swipeStyles.cardInfo}>
              <Text style={swipeStyles.cardName}>{t("onboarding.swipe.card2")}</Text>
              <Text style={swipeStyles.cardPrice}>{t("onboarding.swipe.card2Price")}</Text>
            </View>
          </View>
          {/* Front card */}
          <View style={[swipeStyles.card, swipeStyles.cardFront]}>
            {/* LIKE stamp */}
            <View style={swipeStyles.likeStamp}>
              <Text style={swipeStyles.likeStampText}>LIKE</Text>
            </View>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80" }}
              style={swipeStyles.cardImage}
            />
            <View style={swipeStyles.cardInfo}>
              <Text style={swipeStyles.cardName}>{t("onboarding.swipe.card1")}</Text>
              <Text style={swipeStyles.cardPrice}>{t("onboarding.swipe.card1Price")}</Text>
            </View>
            <View style={swipeStyles.whyBox}>
              <Text style={swipeStyles.whyLabel}>WHY FOR YOU?</Text>
              <Text style={swipeStyles.whyText}>{t("onboarding.swipe.card1Why")}</Text>
            </View>
          </View>
        </View>

        {/* Swipe buttons */}
        <View style={swipeStyles.buttonsRow}>
          <View style={swipeStyles.nopeButton}>
            <Text style={swipeStyles.nopeButtonText}>{"\u2715"}</Text>
          </View>
          <View style={swipeStyles.likeButton}>
            <Text style={swipeStyles.likeButtonText}>{"\u2665"}</Text>
          </View>
        </View>

        {/* Slogan — directly below buttons */}
        <Text style={swipeStyles.slogan}>
          {t("onboarding.swipe.title1")}{" "}
          <Text style={swipeStyles.sloganAccent}>{t("onboarding.swipe.title2")}</Text>
        </Text>
      </View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  topSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  cardStack: {
    height: 320,
    position: "relative",
  },
  card: {
    position: "absolute",
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 32,
    elevation: 8,
  },
  cardBack: {
    top: 7,
    transform: [{ scale: 0.965 }],
    zIndex: 1,
  },
  cardFront: {
    top: 0,
    zIndex: 2,
  },
  likeStamp: {
    position: "absolute",
    top: 24,
    left: 16,
    zIndex: 10,
    borderWidth: 3,
    borderColor: "#3aaa72",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    transform: [{ rotate: "-15deg" }],
  },
  likeStampText: {
    color: "#3aaa72",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2,
  },
  cardImage: {
    height: 180,
    width: "100%",
    backgroundColor: "#F0E8E4",
  },
  cardInfo: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  cardName: {
    fontWeight: "700",
    fontSize: 18,
    color: TEXT,
    marginBottom: 2,
  },
  cardPrice: {
    fontSize: 14,
    color: MUTED,
  },
  whyBox: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(224,106,79,0.07)",
    borderRadius: 12,
  },
  whyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  whyText: {
    fontSize: 13,
    color: TEXT,
    lineHeight: 18,
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
  },
  nopeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  nopeButtonText: {
    fontSize: 18,
    color: ACCENT,
  },
  likeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  likeButtonText: {
    fontSize: 18,
    color: "#fff",
  },
  slogan: {
    marginTop: 20,
    color: TEXT,
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 30,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  sloganAccent: {
    color: ACCENT,
  },
});

// --- Screen 3: Group Decision ---

const AVATARS = [
  { initials: "Y", x: 10, y: 10, color: ACCENT },
  { initials: "M", x: 170, y: 8, color: "#3aaa72" },
  { initials: "J", x: 0, y: 100, color: ACCENT },
  { initials: "K", x: 190, y: 105, color: ACCENT },
];

function GroupSlide({ t }: { t: any }) {
  return (
    <View style={[slideStyles.container, { backgroundColor: WARM_BG }]}>
      <View style={groupStyles.content}>
        {/* Group voting visual */}
        <View style={groupStyles.visualContainer}>
          {/* Central winner card */}
          <View style={groupStyles.winnerCard}>
            <Text style={groupStyles.trophy}>{"\u{1F3C6}"}</Text>
            <Text style={groupStyles.winnerName}>{t("onboarding.group.winner")}</Text>
            <Text style={groupStyles.winnerVotes}>
              {t("onboarding.group.votes")} {"\u2713"}
            </Text>
          </View>
          {/* Avatar circles */}
          {AVATARS.map((a, i) => (
            <View
              key={i}
              style={[
                groupStyles.avatar,
                {
                  left: a.x,
                  top: a.y,
                  backgroundColor: a.color,
                },
              ]}
            >
              <Text style={groupStyles.avatarText}>{a.initials}</Text>
              <View style={groupStyles.avatarBadge}>
                <Text style={groupStyles.avatarBadgeText}>
                  {i === 1 ? "\u2B06" : "\u2665"}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={groupStyles.title}>
          {t("onboarding.group.title1")}
          {"\n"}
          <Text style={groupStyles.titleAccent}>
            {t("onboarding.group.title2")}
          </Text>
        </Text>
        <Text style={groupStyles.subtitle}>
          {t("onboarding.group.subtitle")}
        </Text>
      </View>
    </View>
  );
}

const groupStyles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  visualContainer: {
    width: 240,
    height: 160,
    marginBottom: 36,
    position: "relative",
  },
  winnerCard: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: [{ translateX: -70 }, { translateY: -40 }],
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 8,
    zIndex: 2,
  },
  trophy: {
    fontSize: 24,
    marginBottom: 4,
  },
  winnerName: {
    fontWeight: "800",
    fontSize: 13,
    color: TEXT,
  },
  winnerVotes: {
    fontSize: 11,
    color: ACCENT,
    fontWeight: "600",
  },
  avatar: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeText: {
    fontSize: 8,
  },
  title: {
    color: TEXT,
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 40,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  titleAccent: {
    color: ACCENT,
  },
  subtitle: {
    color: MUTED,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
});

// --- Screen 4: CTA ---

function CTASlide({ t }: { t: any }) {
  return (
    <View style={[slideStyles.container, { backgroundColor: WARM_BG }]}>
      <View style={ctaStyles.content}>
        <Text style={ctaStyles.title}>
          {t("onboarding.cta.title1")}
          {"\n"}
          <Text style={ctaStyles.titleAccent}>
            {t("onboarding.cta.title2")}
          </Text>
        </Text>
      </View>
      <View style={ctaStyles.footer}>
        <Text style={ctaStyles.terms}>{t("onboarding.termsNotice")}</Text>
      </View>
    </View>
  );
}

const ctaStyles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  title: {
    color: TEXT,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  titleAccent: {
    color: ACCENT,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 16,
  },
  terms: {
    textAlign: "center",
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
  },
});

// --- Navigation Row ---

function NavRow({
  onBack,
  onNext,
  step,
}: {
  onBack: () => void;
  onNext: () => void;
  step: number;
  t: any;
}) {
  const { t } = useTranslation();
  return (
    <View style={navStyles.container}>
      <TouchableOpacity onPress={onBack} style={navStyles.backButton}>
        <Text style={navStyles.backText}>
          {"\u2190"} {t("onboarding.back")}
        </Text>
      </TouchableOpacity>
      <View style={navStyles.dots}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              navStyles.dot,
              i === step && navStyles.dotActive,
            ]}
          />
        ))}
      </View>
      <TouchableOpacity onPress={onNext} style={navStyles.nextButton}>
        <Text style={navStyles.nextText}>
          {t("onboarding.next")} {"\u2192"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const navStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 28,
    paddingBottom: 28,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    paddingVertical: 10,
  },
  backText: {
    color: MUTED,
    fontSize: 15,
    fontWeight: "600",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E0D0CC",
  },
  dotActive: {
    width: 20,
    backgroundColor: ACCENT,
  },
  nextButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
  },
  nextText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

// --- Main Component ---

type Props = {
  onDone: () => void;
};

export default function OnboardingScreen({ onDone }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (newStep: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setStep(newStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const goNext = () => {
    if (step < TOTAL_SCREENS - 1) {
      animateTransition(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      animateTransition(step - 1);
    }
  };

  const isSplash = step === 0;
  const isCTA = step === TOTAL_SCREENS - 1;
  // NavRow step maps to middle 3 screens (1,2,3) → dots (0,1,2)
  const navStep = step - 1;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Skip button (shown on all except CTA) */}
      {!isCTA && (
        <View style={styles.skipRow}>
          <TouchableOpacity onPress={onDone} style={styles.skipButton}>
            <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Screen content */}
      <Animated.View style={[styles.screenContent, { opacity: fadeAnim }]}>
        {step === 0 && <SplashSlide t={t} />}
        {step === 1 && <Value1Slide t={t} />}
        {step === 2 && <SwipeSlide t={t} />}
        {step === 3 && <GroupSlide t={t} />}
        {step === 4 && <CTASlide t={t} />}
      </Animated.View>

      {/* Bottom navigation */}
      {isSplash && (
        <View style={styles.splashBottom}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={goNext}
          >
            <Text style={styles.primaryButtonText}>
              {t("onboarding.decideForMe")} {"\u2192"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!isSplash && !isCTA && (
        <NavRow onBack={goBack} onNext={goNext} step={navStep} t={t} />
      )}

      {isCTA && (
        <View style={styles.ctaBottom}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={onDone}
          >
            <Text style={styles.primaryButtonText}>
              {t("onboarding.letsEat")} {"\u2192"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}

// --- Shared styles ---

const slideStyles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WARM_BG,
  },
  skipRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 4,
    zIndex: 10,
  },
  skipButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipText: {
    color: MUTED,
    fontSize: 15,
    fontWeight: "500",
  },
  screenContent: {
    flex: 1,
  },
  splashBottom: {
    paddingHorizontal: 28,
    paddingBottom: 8,
    zIndex: 2,
  },
  ctaBottom: {
    paddingHorizontal: 28,
    paddingBottom: 8,
  },
  primaryButton: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 50,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
