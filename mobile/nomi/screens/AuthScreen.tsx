import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  AccessibilityInfo,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Colors, Typography, Spacing, BorderRadius } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

type TabType = "signin" | "signup";

export default function AuthScreen() {
  const { signIn, signUp, continueAsGuest, resetPassword } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // Refs for keyboard navigation (FIX 2)
  const displayNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const cleanErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case "auth/user-not-found":
        return t('auth.errors.userNotFound');
      case "auth/wrong-password":
        return t('auth.errors.wrongPassword');
      case "auth/email-already-in-use":
        return t('auth.errors.emailInUse');
      case "auth/weak-password":
        return t('auth.errors.weakPassword');
      case "auth/invalid-email":
        return t('auth.errors.invalidEmail');
      case "auth/too-many-requests":
        return t('auth.errors.tooManyRequests');
      case "auth/operation-not-allowed":
      case "auth/admin-restricted-operation":
        return t('auth.errors.guestUnavailable');
      default:
        return t('auth.errors.default');
    }
  };

  // FIX 7 - Announce errors to screen readers
  const showError = (message: string) => {
    setInfo("");
    setError(message);
    AccessibilityInfo.announceForAccessibility(`Error: ${message}`);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      showError(t('auth.enterEmailFirst'));
      return;
    }
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await resetPassword(email);
      const msg = t('auth.resetSent', { email });
      setInfo(msg);
      AccessibilityInfo.announceForAccessibility(msg);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      showError(cleanErrorMessage(firebaseError.code ?? ""));
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      showError(t('auth.fillAllFields'));
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: unknown) {
      // FIX 8 - Proper TypeScript error handling
      const firebaseError = err as { code: string };
      showError(cleanErrorMessage(firebaseError.code));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !displayName) {
      showError(t('auth.fillAllFields'));
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signUp(email, password, displayName);
    } catch (err: unknown) {
      // FIX 8 - Proper TypeScript error handling
      const firebaseError = err as { code: string };
      showError(cleanErrorMessage(firebaseError.code));
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsGuest = async () => {
    setError("");
    setLoading(true);
    try {
      await continueAsGuest();
    } catch (err: unknown) {
      // Anonymous auth can be disabled in Firebase or fail offline. Surface it
      // instead of entering a broken guest session that loses saves silently.
      const firebaseError = err as { code?: string };
      showError(cleanErrorMessage(firebaseError.code ?? ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <Image
            source={require("../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* Tab Toggle */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "signin" && styles.activeTab]}
              onPress={() => {
                setActiveTab("signin");
                setError("");
                setInfo("");
              }}
              accessibilityLabel="Sign in tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "signin" }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "signin" && styles.activeTabText,
                ]}
              >
                {t('auth.signIn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "signup" && styles.activeTab]}
              onPress={() => {
                setActiveTab("signup");
                setError("");
                setInfo("");
              }}
              accessibilityLabel="Sign up tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "signup" }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "signup" && styles.activeTabText,
                ]}
              >
                {t('auth.signUp')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {activeTab === "signup" && (
              <TextInput
                ref={displayNameRef}
                style={styles.input}
                placeholder={t('auth.displayNamePlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                editable={!loading}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
                accessibilityLabel="Display name"
                accessibilityHint="Enter your full name"
              />
            )}
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
              accessibilityLabel="Email address"
              accessibilityHint="Enter your email"
            />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
              returnKeyType="go"
              onSubmitEditing={activeTab === "signin" ? handleSignIn : handleSignUp}
              accessibilityLabel="Password"
              accessibilityHint="Enter your password"
            />

            {/* Forgot password (sign-in only) */}
            {activeTab === "signin" && (
              <TouchableOpacity
                style={styles.forgotButton}
                onPress={handleForgotPassword}
                disabled={loading}
                accessibilityLabel="Reset your password"
                accessibilityRole="button"
              >
                <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
              </TouchableOpacity>
            )}

            {/* Error Message */}
            {error ? (
              <Text
                style={styles.errorText}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            ) : null}

            {/* Success / info Message */}
            {info ? (
              <Text
                style={styles.infoText}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {info}
              </Text>
            ) : null}

            {/* Main Action Button */}
            <TouchableOpacity
              style={[styles.mainButton, loading && styles.disabledButton]}
              onPress={activeTab === "signin" ? handleSignIn : handleSignUp}
              disabled={loading}
              accessibilityLabel={activeTab === "signin" ? "Sign in" : "Create account"}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textOnAccent} />
              ) : (
                <Text style={styles.mainButtonText}>
                  {activeTab === "signin" ? t('auth.signIn') : t('auth.createAccount')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Continue as Guest */}
            <TouchableOpacity
              style={styles.guestButton}
              onPress={handleContinueAsGuest}
              disabled={loading}
              accessibilityLabel="Continue as guest"
              accessibilityRole="button"
              accessibilityHint="Use the app without creating an account"
            >
              <Text style={styles.guestButtonText}>{t('auth.continueAsGuest')}</Text>
            </TouchableOpacity>

            {/* Guest Note */}
            <Text style={styles.guestNote}>
              {t('auth.guestNote')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.xxl,
  },
  logo: {
    width: 300,
    height: 105,
    alignSelf: "center",
    marginBottom: 48,
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 32,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "transparent",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    minHeight: 44, // FIX 6 - Touch target minimum
  },
  activeTab: {
    borderBottomColor: Colors.accent,
  },
  tabText: {
    fontSize: Typography.body,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.accent,
  },
  formContainer: {
    gap: Spacing.md,
  },
  input: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 16,
    fontSize: Typography.body,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorText: {
    color: Colors.error, // FIX - Use theme color instead of hardcoded
    fontSize: Typography.caption,
    marginTop: -4,
  },
  infoText: {
    color: Colors.accent,
    fontSize: Typography.caption,
    marginTop: -4,
  },
  forgotButton: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    minHeight: 32,
  },
  forgotText: {
    color: Colors.accent,
    fontSize: Typography.caption,
    fontWeight: Typography.semibold,
  },
  mainButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  disabledButton: {
    opacity: 0.6,
  },
  mainButtonText: {
    color: Colors.textOnAccent,
    fontSize: Typography.body,
    fontWeight: Typography.semibold,
  },
  guestButton: {
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 44, // FIX 6 - Touch target minimum
  },
  guestButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.body,
    fontWeight: Typography.semibold,
  },
  guestNote: {
    fontSize: Typography.caption,
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
