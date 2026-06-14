import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Restaurant, getPhotoUrl } from '../services/restaurantService';
import { setEventDetails } from '../services/roomService';

type AttendanceStatus = 'going' | 'not_going' | 'maybe';

type Props = {
  roomCode: string;
  restaurant: Restaurant;
  isOrganizer: boolean;
  currentUserId: string;
  onDone: () => void;
};

const TIME_SLOTS = [
  '12:00', '12:30', '13:00', '13:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
];

export default function EventPlanScreen({
  roomCode, restaurant, isOrganizer, currentUserId, onDone
}: Props) {
  const { t } = useTranslation();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceStatus>('going');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const photoUrl = getPhotoUrl(restaurant);

  const handleConfirm = async () => {
    if (!selectedTime) return;
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await setEventDetails(roomCode, {
      event_time: selectedTime,
      restaurant_id: restaurant.id,
      attendance: { [currentUserId]: attendance },
      note,
    });

    setSaving(false);
    onDone();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Restaurant mini card */}
        <View style={styles.restaurantCard}>
          {photoUrl && (
            <Image source={{ uri: photoUrl }} style={styles.restaurantPhoto} resizeMode="cover" />
          )}
          <View style={styles.restaurantInfo}>
            <Text style={styles.restaurantName} numberOfLines={1}>{restaurant.name}</Text>
            <Text style={styles.restaurantMeta}>{restaurant.address}</Text>
          </View>
        </View>

        {/* Time picker */}
        <Text style={styles.sectionTitle}>{t('eventPlan.timeLabel')}</Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map(time => (
            <TouchableOpacity
              key={time}
              style={[styles.timeSlot, selectedTime === time && styles.timeSlotSelected]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedTime(time);
              }}
              accessibilityLabel={`Select ${time}`}
              accessibilityRole="button"
            >
              <Text style={[
                styles.timeSlotText,
                selectedTime === time && styles.timeSlotTextSelected
              ]}>
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Attendance */}
        <Text style={styles.sectionTitle}>{t('eventPlan.attendanceLabel')}</Text>
        <View style={styles.attendanceRow}>
          {([
            { status: 'going', labelKey: "eventPlan.attendanceOptions.going" },
            { status: 'maybe', labelKey: "eventPlan.attendanceOptions.maybe" },
            { status: 'not_going', labelKey: "eventPlan.attendanceOptions.notGoing" },
          ] as { status: AttendanceStatus; labelKey: string }[]).map(({ status, labelKey }) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.attendanceButton,
                attendance === status && styles.attendanceButtonSelected,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAttendance(status);
              }}
              accessibilityLabel={t(labelKey)}
              accessibilityRole="button"
            >
              <Text style={[
                styles.attendanceText,
                attendance === status && styles.attendanceTextSelected,
              ]}>
                {t(labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Note */}
        <Text style={styles.sectionTitle}>{t('eventPlan.noteLabel')}</Text>
        <TextInput
          style={styles.noteInput}
          placeholder={t('eventPlan.notePlaceholder')}
          placeholderTextColor={Colors.textSecondary}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={120}
          accessibilityLabel="Add a note"
        />

        {/* Confirm */}
        <TouchableOpacity
          style={[styles.confirmButton, (!selectedTime || saving) && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!selectedTime || saving}
          accessibilityLabel="Confirm event details"
          accessibilityRole="button"
        >
          <Text style={styles.confirmButtonText}>
            {saving ? t('eventPlan.saving') : t('eventPlan.confirmButton')}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  restaurantCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  restaurantPhoto: {
    width: '100%',
    height: 100,
  },
  restaurantInfo: {
    padding: 12,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  restaurantMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  timeSlot: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    backgroundColor: Colors.cardBackground,
  },
  timeSlotSelected: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(224, 106, 79, 0.15)',
  },
  timeSlotText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  timeSlotTextSelected: {
    color: Colors.accent,
    fontWeight: '700',
  },
  attendanceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  attendanceButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
  },
  attendanceButtonSelected: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(224, 106, 79, 0.15)',
  },
  attendanceText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  attendanceTextSelected: {
    color: Colors.accent,
    fontWeight: '700',
  },
  noteInput: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  confirmButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
