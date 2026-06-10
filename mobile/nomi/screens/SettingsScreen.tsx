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
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "../theme/colors";
import i18n, { changeLanguage } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { syncNotificationPreferences } from "../services/notificationService";

const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const RED = "#E74C3C";

// --- Storage Keys ---
const KEYS = {
  groupInvites: "notifications_group_invites",
  newRestaurants: "notifications_new_restaurants",
  validateReminders: "notifications_validate",
  defaultCity: "default_city",
  defaultBudget: "default_budget",
  defaultMood: "default_mood",
  defaultDistance: "default_distance",
};

const CITIES = [
  { label: "Lisbon \u{1F1F5}\u{1F1F9}", value: "Lisbon" },
  { label: "Porto \u{1F1F5}\u{1F1F9}", value: "Porto" },
  { label: "Algarve \u{1F1F5}\u{1F1F9}", value: "Algarve" },
];

const MOODS = [
  { id: 'romantic', labelKey: 'mood.moods.romantic.label' },
  { id: 'energetic', labelKey: 'mood.moods.energetic.label' },
  { id: 'chill', labelKey: 'mood.moods.chill.label' },
  { id: 'explorer', labelKey: 'mood.moods.explorer.label' },
  { id: 'focus', labelKey: 'mood.moods.focus.label' },
  { id: 'hungry_quick', labelKey: 'mood.moods.hungryQuick.label' },
];

const DISTANCES = [
  { id: 500, labelKey: 'budget.distanceOptions.500.title', subtitleKey: 'budget.distanceOptions.500.subtitle' },
  { id: 3500, labelKey: 'budget.distanceOptions.3500.title', subtitleKey: 'budget.distanceOptions.3500.subtitle' },
  { id: 10000, labelKey: 'budget.distanceOptions.10000.title', subtitleKey: 'budget.distanceOptions.10000.subtitle' },
];

type Props = {
  onBack: () => void;
};

export default function SettingsScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  // Account
  const [displayName, setDisplayName] = useState("Duygu B.");
  const [editingName, setEditingName] = useState(false);

  // Notifications
  const [groupInvites, setGroupInvites] = useState(true);
  const [newRestaurants, setNewRestaurants] = useState(false);
  const [validateReminders, setValidateReminders] = useState(true);

  // Preferences
  const [defaultCity, setDefaultCity] = useState("Lisbon");
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [defaultBudget, setDefaultBudget] = useState(2);
  const [defaultMood, setDefaultMood] = useState("chill");
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [defaultDistance, setDefaultDistance] = useState(3500);
  const [showDistancePicker, setShowDistancePicker] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      const [gi, nr, vr, city, budget, mood, distance] = await Promise.all([
        AsyncStorage.getItem(KEYS.groupInvites),
        AsyncStorage.getItem(KEYS.newRestaurants),
        AsyncStorage.getItem(KEYS.validateReminders),
        AsyncStorage.getItem(KEYS.defaultCity),
        AsyncStorage.getItem(KEYS.defaultBudget),
        AsyncStorage.getItem(KEYS.defaultMood),
        AsyncStorage.getItem(KEYS.defaultDistance),
      ]);
      if (gi !== null) setGroupInvites(gi === "true");
      if (nr !== null) setNewRestaurants(nr === "true");
      if (vr !== null) setValidateReminders(vr === "true");
      if (city !== null) setDefaultCity(city);
      if (budget !== null) setDefaultBudget(parseInt(budget, 10));
      if (mood !== null) setDefaultMood(mood);
      if (distance !== null) setDefaultDistance(parseInt(distance, 10));
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

    // Build current prefs with the new value applied
    const updatedPrefs = {
      groupInvites: key === KEYS.groupInvites ? value : groupInvites,
      newRestaurants: key === KEYS.newRestaurants ? value : newRestaurants,
      validateReminders: key === KEYS.validateReminders ? value : validateReminders,
    };
    if (user) {
      syncNotificationPreferences(user.uid, updatedPrefs);
    }
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

  const saveMoodAndClose = (mood: string) => {
    setDefaultMood(mood);
    setShowMoodPicker(false);
    AsyncStorage.setItem(KEYS.defaultMood, mood);
  };

  const saveDistanceAndClose = (distance: number) => {
    setDefaultDistance(distance);
    setShowDistancePicker(false);
    AsyncStorage.setItem(KEYS.defaultDistance, String(distance));
  };

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("");

  const cityLabel =
    CITIES.find((c) => c.value === defaultCity)?.label || defaultCity;
  const moodLabel =
    MOODS.find((m) => m.id === defaultMood)?.labelKey || "mood.moods.chill.label";
  const distanceLabel =
    DISTANCES.find((d) => d.id === defaultDistance)?.labelKey || "budget.distanceOptions.3500.title";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ====== Account ====== */}
        <Text style={styles.sectionLabel}>{t('settings.sections.account')}</Text>
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
        <Text style={styles.sectionLabel}>{t('settings.sections.notifications')}</Text>
        <View style={styles.section}>
          <ToggleRow
            label={t('settings.notifications.groupInvites')}
            value={groupInvites}
            onToggle={(v) => toggleAndSave(KEYS.groupInvites, v, setGroupInvites)}
          />
          <View style={styles.divider} />
          <ToggleRow
            label={t('settings.notifications.newRestaurants')}
            value={newRestaurants}
            onToggle={(v) => toggleAndSave(KEYS.newRestaurants, v, setNewRestaurants)}
          />
          <View style={styles.divider} />
          <ToggleRow
            label={t('settings.notifications.validateReminders')}
            value={validateReminders}
            onToggle={(v) => toggleAndSave(KEYS.validateReminders, v, setValidateReminders)}
          />
        </View>

        {/* ====== Preferences ====== */}
        <Text style={styles.sectionLabel}>{t('settings.sections.preferences')}</Text>
        <View style={styles.section}>
          <ToggleRow label={t('settings.preferences.darkMode')} value={true} onToggle={() => {}} disabled />
          <View style={styles.divider} />

          {/* Language */}
          <View style={styles.languageSection}>
            <Text style={styles.rowLabel}>{t('settings.preferences.language')}</Text>
            <View style={styles.languageRow}>
              <TouchableOpacity
                style={[styles.languageButton, currentLanguage === 'en' && styles.languageButtonSelected]}
                onPress={async () => {
                  await changeLanguage('en');
                  setCurrentLanguage('en');
                }}
              >
                <Text style={styles.languageFlag}>🇬🇧</Text>
                <Text style={[styles.languageText, currentLanguage === 'en' && styles.languageTextSelected]}>
                  {t('settings.languages.en')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.languageButton, currentLanguage === 'pt' && styles.languageButtonSelected]}
                onPress={async () => {
                  await changeLanguage('pt');
                  setCurrentLanguage('pt');
                }}
              >
                <Text style={styles.languageFlag}>🇵🇹</Text>
                <Text style={[styles.languageText, currentLanguage === 'pt' && styles.languageTextSelected]}>
                  {t('settings.languages.pt')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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

          {/* Default mood */}
          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowMoodPicker(!showMoodPicker)}
          >
            <Text style={styles.rowLabel}>{t('settings.preferences.defaultMood')}</Text>
            <Text style={styles.rowValue}>{t(moodLabel)}</Text>
          </TouchableOpacity>
          {showMoodPicker && (
            <View style={styles.pickerContainer}>
              {MOODS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.pickerOption,
                    defaultMood === m.id && styles.pickerOptionActive,
                  ]}
                  onPress={() => saveMoodAndClose(m.id)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      defaultMood === m.id && styles.pickerOptionTextActive,
                    ]}
                  >
                    {t(m.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.divider} />

          {/* Default budget */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('settings.preferences.defaultBudget')}</Text>
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
          <View style={styles.divider} />

          {/* Default distance */}
          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowDistancePicker(!showDistancePicker)}
          >
            <Text style={styles.rowLabel}>{t('settings.preferences.defaultDistance')}</Text>
            <Text style={styles.rowValue}>{t(distanceLabel)}</Text>
          </TouchableOpacity>
          {showDistancePicker && (
            <View style={styles.pickerContainer}>
              {DISTANCES.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.pickerOption,
                    defaultDistance === d.id && styles.pickerOptionActive,
                  ]}
                  onPress={() => saveDistanceAndClose(d.id)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      defaultDistance === d.id && styles.pickerOptionTextActive,
                    ]}
                  >
                    {t(d.labelKey)} • {t(d.subtitleKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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

  // --- Language Switcher ---
  languageSection: {
    paddingVertical: 12,
  },
  languageRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  languageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  languageButtonSelected: {
    borderColor: ACCENT,
    backgroundColor: Colors.badgeBackground,
  },
  languageFlag: {
    fontSize: 20,
  },
  languageText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: "600",
  },
  languageTextSelected: {
    color: ACCENT,
    fontWeight: "700",
  },
});
