import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Colors, Typography, Spacing, BorderRadius } from "../theme/colors";
import { verifyResetCode, completePasswordReset } from "../services/authService";

type Props = {
  oobCode: string;
  // Called when the flow ends (success or unrecoverable code error) so the
  // app can return to the sign-in screen.
  onDone: () => void;
};

export default function ResetPasswordScreen({ oobCode, onDone }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Validate the code up front so an expired link fails fast with a clear
  // message instead of after the user has typed a new password. State is
  // reset first so a fresh link recovers from a previous failed one.
  useEffect(() => {
    setCodeError(false);
    setEmail(null);
    verifyResetCode(oobCode)
      .then(setEmail)
      .catch((e) => {
        if (__DEV__) console.error("verifyResetCode failed:", e);
        setCodeError(true);
      });
  }, [oobCode]);

  const handleSave = async () => {
    setError("");
    if (password.length < 6) {
      setError(t("auth.errors.weakPassword"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.reset.mismatch"));
      return;
    }
    setSaving(true);
    try {
      await completePasswordReset(oobCode, password);
      setDone(true);
    } catch (e: any) {
      if (__DEV__) console.error("confirmPasswordReset failed:", e);
      if (e?.code === "auth/expired-action-code" || e?.code === "auth/invalid-action-code") {
        setCodeError(true);
      } else if (e?.code === "auth/weak-password") {
        setError(t("auth.errors.weakPassword"));
      } else {
        setError(t("auth.errors.default"));
      }
    } finally {
      setSaving(false);
    }
  };

  const renderBody = () => {
    if (codeError) {
      return (
        <>
          <Text style={styles.emoji}>{"⚠️"}</Text>
          <Text style={styles.title}>{t("auth.reset.invalidTitle")}</Text>
          <Text style={styles.message}>{t("auth.reset.invalidMessage")}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onDone} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>{t("auth.reset.backToSignIn")}</Text>
          </TouchableOpacity>
        </>
      );
    }
    if (done) {
      return (
        <>
          <Text style={styles.emoji}>{"✅"}</Text>
          <Text style={styles.title}>{t("auth.reset.doneTitle")}</Text>
          <Text style={styles.message}>{t("auth.reset.doneMessage")}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onDone} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>{t("auth.reset.backToSignIn")}</Text>
          </TouchableOpacity>
        </>
      );
    }
    if (!email) {
      return <ActivityIndicator size="large" color={Colors.accent} />;
    }
    return (
      <>
        <Text style={styles.emoji}>{"🔑"}</Text>
        <Text style={styles.title}>{t("auth.reset.title")}</Text>
        <Text style={styles.message}>{t("auth.reset.message", { email })}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder={t("auth.reset.newPasswordPlaceholder")}
          placeholderTextColor={Colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!saving}
        />
        <TextInput
          style={styles.input}
          placeholder={t("auth.reset.confirmPasswordPlaceholder")}
          placeholderTextColor={Colors.textTertiary}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          editable={!saving}
          onSubmitEditing={handleSave}
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={Colors.textOnAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>{t("auth.reset.saveButton")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.textButton} onPress={onDone} accessibilityRole="button">
          <Text style={styles.textButtonText}>{t("auth.reset.cancel")}</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>{renderBody()}</View>
      </KeyboardAvoidingView>
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
  },
  inner: {
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
  errorText: {
    fontSize: Typography.caption,
    color: Colors.error,
    textAlign: "center",
    marginBottom: 12,
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
    width: "100%",
    marginBottom: 12,
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
    marginTop: 8,
  },
  primaryButtonText: {
    color: Colors.textOnAccent,
    fontSize: Typography.body,
    fontWeight: "700",
  },
  textButton: {
    paddingVertical: 12,
    marginTop: 8,
  },
  textButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption,
  },
});
