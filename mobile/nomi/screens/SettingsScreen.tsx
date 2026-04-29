import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../theme/colors";

const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const RED = "#E74C3C";

// --- Storage Keys ---
const KEYS = {
  groupInvites: "notifications_group_invites",
  leaderboard: "notifications_leaderboard",
  newRestaurants: "notifications_new_restaurants",
  validateReminders: "notifications_validate",
  defaultCity: "default_city",
  defaultBudget: "default_budget",
};

const CITIES = [
  { label: "Lisbon \u{1F1F5}\u{1F1F9}", value: "Lisbon" },
  { label: "Porto \u{1F1F5}\u{1F1F9}", value: "Porto" },
  { label: "Algarve \u{1F1F5}\u{1F1F9}", value: "Algarve" },
];

type Props = {
  onBack: () => void;
};

export default function SettingsScreen({ onBack }: Props) {
  // Account
  const [displayName, setDisplayName] = useState("Duygu B.");
  const [editingName, setEditingName] = useState(false);

  // Notifications
  const [groupInvites, setGroupInvites] = useState(true);
  const [leaderboard, setLeaderboard] = useState(true);
  const [newRestaurants, setNewRestaurants] = useState(false);
  const [validateReminders, setValidateReminders] = useState(true);

  // Preferences
  const [defaultCity, setDefaultCity] = useState("Lisbon");
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [defaultBudget, setDefaultBudget] = useState(2);

  // Load from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      const [gi, lb, nr, vr, city, budget] = await Promise.all([
        AsyncStorage.getItem(KEYS.groupInvites),
        AsyncStorage.getItem(KEYS.leaderboard),
        AsyncStorage.getItem(KEYS.newRestaurants),
        AsyncStorage.getItem(KEYS.validateReminders),
        AsyncStorage.getItem(KEYS.defaultCity),
        AsyncStorage.getItem(KEYS.defaultBudget),
      ]);
      if (gi !== null) setGroupInvites(gi === "true");
      if (lb !== null) setLeaderboard(lb === "true");
      if (nr !== null) setNewRestaurants(nr === "true");
      if (vr !== null) setValidateReminders(vr === "true");
      if (city !== null) setDefaultCity(city);
      if (budget !== null) setDefaultBudget(parseInt(budget, 10));
    })();
  }, []);

  // Persist helpers
  const toggleAndSave = (
    key: string,
    value: boolean,
    setter: (v: boolean) => void
  ) => {
    setter(value);
    AsyncStorage.setItem(key, String(value));
  };

  const saveCityAndClose = (city: string) => {
    setDefaultCity(city);
    setShowCityPicker(false);
    AsyncStorage.setItem(KEYS.defaultCity, city);
  };

  const selectBudget = (level: number) => {
    setDefaultBudget(level);
    AsyncStorage.setItem(KEYS.defaultBudget, String(level));
  };

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("");

  const cityLabel =
    CITIES.find((c) => c.value === defaultCity)?.label || defaultCity;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ====== Account ====== */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.section}>
          {/* Avatar + name + email */}
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{displayName}</Text>
              <Text style={styles.accountEmail}>duygu@nomi.app</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Change display name */}
          <TouchableOpacity
            style={styles.row}
            onPress={() => setEditingName(!editingName)}
          >
            <Text style={styles.rowLabel}>Change display name</Text>
            <Text style={styles.rowChevron}>{editingName ? "\u25B2" : "\u25BC"}</Text>
          </TouchableOpacity>
          {editingName && (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholderTextColor={TEXT_SECONDARY}
                autoFocus
              />
            </View>
          )}

          <View style={styles.divider} />

          {/* Sign out */}
          <TouchableOpacity style={styles.row}>
            <Text style={[styles.rowLabel, { color: RED }]}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* ====== Notifications ====== */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.section}>
          <ToggleRow
            label="Group room invites"
            value={groupInvites}
            onToggle={(v) => toggleAndSave(KEYS.groupInvites, v, setGroupInvites)}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Weekly leaderboard results"
            value={leaderboard}
            onToggle={(v) => toggleAndSave(KEYS.leaderboard, v, setLeaderboard)}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="New restaurants in your area"
            value={newRestaurants}
            onToggle={(v) => toggleAndSave(KEYS.newRestaurants, v, setNewRestaurants)}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Validate reminders"
            value={validateReminders}
            onToggle={(v) => toggleAndSave(KEYS.validateReminders, v, setValidateReminders)}
          />
        </View>

        {/* ====== Preferences ====== */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.section}>
          <ToggleRow label="Dark mode" value={true} onToggle={() => {}} disabled />
          <View style={styles.divider} />

          {/* Default city */}
          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowCityPicker(!showCityPicker)}
          >
            <Text style={styles.rowLabel}>Default city</Text>
            <Text style={styles.rowValue}>{cityLabel}</Text>
          </TouchableOpacity>
          {showCityPicker && (
            <View style={styles.pickerContainer}>
              {CITIES.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[
                    styles.pickerOption,
                    defaultCity === c.value && styles.pickerOptionActive,
                  ]}
                  onPress={() => saveCityAndClose(c.value)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      defaultCity === c.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.divider} />

          {/* Default budget */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Default budget</Text>
            <View style={styles.budgetSelector}>
              {[1, 2, 3].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.budgetOption,
                    defaultBudget === level && styles.budgetOptionActive,
                  ]}
                  onPress={() => selectBudget(level)}
                >
                  <Text
                    style={[
                      styles.budgetOptionText,
                      defaultBudget === level && styles.budgetOptionTextActive,
                    ]}
                  >
                    {"\u20AC".repeat(level)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ====== About ====== */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL("https://nomi.app/privacy")}
          >
            <Text style={styles.rowLabel}>Privacy Policy</Text>
            <Text style={styles.rowChevron}>{"\u203A"}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL("https://nomi.app/terms")}
          >
            <Text style={styles.rowLabel}>Terms of Service</Text>
            <Text style={styles.rowChevron}>{"\u203A"}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL("https://apps.apple.com")}
          >
            <Text style={styles.rowLabel}>Rate Nomi</Text>
            <Text style={styles.rowChevron}>{"\u203A"}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>Nomi v0.1.0 — MVP Beta</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Toggle Row Component ---
function ToggleRow({
  label,
  value,
  onToggle,
  disabled,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, disabled && { color: TEXT_SECONDARY }]}>
        {label}
        {disabled ? " (locked)" : ""}
      </Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: Colors.stepInactive, true: ACCENT }}
        thumbColor={TEXT_PRIMARY}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    width: 60,
  },
  headerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  // --- Sections ---
  sectionLabel: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.stepInactive,
    marginHorizontal: 16,
  },

  // --- Rows ---
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  rowLabel: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    flex: 1,
  },
  rowValue: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  rowChevron: {
    color: TEXT_SECONDARY,
    fontSize: 16,
  },

  // --- Account ---
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "700",
  },
  accountEmail: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    marginTop: 2,
  },

  // --- Input ---
  inputRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  textInput: {
    backgroundColor: Colors.stepInactive,
    color: TEXT_PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },

  // --- City Picker ---
  pickerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  pickerOption: {
    backgroundColor: Colors.stepInactive,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  pickerOptionActive: {
    backgroundColor: ACCENT,
  },
  pickerOptionText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  pickerOptionTextActive: {
    color: TEXT_PRIMARY,
    fontWeight: "600",
  },

  // --- Budget Selector ---
  budgetSelector: {
    flexDirection: "row",
    gap: 8,
  },
  budgetOption: {
    backgroundColor: Colors.stepInactive,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  budgetOptionActive: {
    backgroundColor: ACCENT,
  },
  budgetOptionText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "600",
  },
  budgetOptionTextActive: {
    color: TEXT_PRIMARY,
  },
});
