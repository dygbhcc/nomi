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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors, Typography, Spacing, BorderRadius } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

type TabType = "signin" | "signup";

export default function AuthScreen() {
  const { signIn, signUp, continueAsGuest } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Refs for keyboard navigation (FIX 2)
  const displayNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const cleanErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case "auth/user-not-found":
        return "No account found with this email";
      case "auth/wrong-password":
        return "Incorrect password";
      case "auth/email-already-in-use":
        return "An account already exists with this email";
      case "auth/weak-password":
        return "Password must be at least 6 characters";
      case "auth/invalid-email":
        return "Please enter a valid email address";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later";
      default:
        return "An error occurred. Please try again";
    }
  };

  // FIX 7 - Announce errors to screen readers
  const showError = (message: string) => {
    setError(message);
    AccessibilityInfo.announceForAccessibility(`Error: ${message}`);
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      showError("Please fill in all fields");
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
      showError("Please fill in all fields");
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

  const handleContinueAsGuest = () => {
    continueAsGuest();
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
          <Text style={styles.logo}>nomi</Text>

          {/* Tab Toggle */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "signin" && styles.activeTab]}
              onPress={() => {
                setActiveTab("signin");
                setError("");
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
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "signup" && styles.activeTab]}
              onPress={() => {
                setActiveTab("signup");
                setError("");
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
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {activeTab === "signup" && (
              <TextInput
                ref={displayNameRef}
                style={styles.input}
                placeholder="Display name"
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
              placeholder="Email"
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
              placeholder="Password"
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
                  {activeTab === "signin" ? "Sign In" : "Create Account"}
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
              <Text style={styles.guestButtonText}>Continue as Guest</Text>
            </TouchableOpacity>

            {/* Guest Note */}
            <Text style={styles.guestNote}>
              Group rooms and points require an account
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
    fontSize: 40,
    fontWeight: Typography.bold,
    color: Colors.accent,
    textAlign: "center",
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
