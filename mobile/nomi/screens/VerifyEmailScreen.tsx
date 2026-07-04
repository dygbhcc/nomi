import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Colors, Typography, Spacing, BorderRadius } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { user, signOut, resendVerification, refreshVerification } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState("");
  // Firebase rate-limits repeated verification emails (TOO_MANY_ATTEMPTS after
  // ~2 sends in a short window), so throttle the resend button client-side.
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  const handleCheck = async () => {
    setNotice("");
    setChecking(true);
    try {
      const verified = await refreshVerification();
      // If verified, the App gate re-renders into the main app automatically.
      if (!verified) setNotice(t("auth.verify.stillNotVerified"));
    } catch {
      setNotice(t("auth.errors.default"));
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setNotice("");
    setResending(true);
    try {
      await resendVerification();
      setNotice(t("auth.verify.resent"));
      setCooldown(60);
    } catch (e: any) {
      if (__DEV__) console.error("resendVerification failed:", e);
      if (e?.code === "auth/too-many-requests") {
        setNotice(t("auth.verify.tooMany"));
        setCooldown(60);
      } else {
        setNotice(t("auth.errors.default"));
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.emoji}>{"✉️"}</Text>
        <Text style={styles.title}>{t("auth.verify.title")}</Text>
        <Text style={styles.message}>
          {t("auth.verify.message", { email: user?.email ?? "" })}
        </Text>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleCheck}
          disabled={checking}
          accessibilityRole="button"
        >
          {checking ? (
            <ActivityIndicator color={Colors.textOnAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>{t("auth.verify.checkButton")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleResend}
          disabled={resending || cooldown > 0}
          accessibilityRole="button"
        >
          <Text style={[styles.secondaryButtonText, cooldown > 0 && styles.secondaryButtonTextDisabled]}>
            {resending
              ? "…"
              : cooldown > 0
                ? t("auth.verify.resendIn", { seconds: cooldown })
                : t("auth.verify.resend")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.textButton}
          onPress={() => signOut()}
          accessibilityRole="button"
        >
          <Text style={styles.textButtonText}>{t("auth.verify.signOut")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  notice: {
    fontSize: Typography.caption,
    color: Colors.accent,
    textAlign: "center",
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: "center",
    width: "100%",
    minHeight: 52,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: Colors.textOnAccent,
    fontSize: Typography.body,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 14,
    marginTop: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: Colors.accent,
    fontSize: Typography.body,
    fontWeight: "600",
  },
  secondaryButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  textButton: {
    paddingVertical: 12,
    marginTop: 4,
  },
  textButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption,
  },
});
