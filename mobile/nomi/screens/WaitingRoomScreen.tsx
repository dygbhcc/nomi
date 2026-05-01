import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../theme/colors";

type Participant = {
  id: string;
  name: string;
  initials: string;
  ready: boolean;
  color: string;
};

const AVATAR_COLORS = ["#E06A4F", "#C25A41", "#FF8A3D", "#B54F3A"];

const INITIAL_PARTICIPANTS: Participant[] = [
  { id: "1", name: "You (host)", initials: "Y", ready: true, color: AVATAR_COLORS[0] },
  { id: "2", name: "Ana", initials: "A", ready: true, color: AVATAR_COLORS[1] },
  { id: "3", name: "Miguel", initials: "M", ready: false, color: AVATAR_COLORS[2] },
];

const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const GREEN = "#2ECC71";

type Props = {
  roomCode: string;
  onBack: () => void;
  onStartVoting: (participants: string[]) => void;
};

function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.pulsingDot, { opacity }]} />;
}

export default function WaitingRoomScreen({ roomCode, onBack, onStartVoting }: Props) {
  const [participants, setParticipants] = useState<Participant[]>(INITIAL_PARTICIPANTS);

  // Simulate participant becoming ready after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === "3" ? { ...p, ready: true } : p))
      );
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const readyCount = participants.filter((p) => p.ready).length;
  const canStart = readyCount >= 2;

  const handleShare = async () => {
    await Share.share({
      message: `Join my Nomi room! Code: ${roomCode}\nhttps://nomi.app/room/${roomCode}`,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Room code top section */}
      <View style={styles.codeSection}>
        <View style={styles.codeBox}>
          <Text style={styles.codeText} selectable>{roomCode}</Text>
        </View>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Title with pulsing dot */}
      <View style={styles.titleRow}>
        <PulsingDot />
        <Text style={styles.title}>Waiting for friends...</Text>
      </View>
      <Text style={styles.subtitle}>
        {readyCount}/{participants.length} ready
      </Text>

      {/* Participant list */}
      <View style={styles.participantList}>
        {participants.map((p) => (
          <View key={p.id} style={styles.participantRow}>
            <View style={[styles.avatar, { backgroundColor: p.color }]}>
              <Text style={styles.avatarText}>{p.initials}</Text>
            </View>
            <Text style={styles.participantName}>{p.name}</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: p.ready ? GREEN : TEXT_SECONDARY }]} />
              <Text style={[styles.statusText, { color: p.ready ? GREEN : TEXT_SECONDARY }]}>
                {p.ready ? "Ready" : "Waiting..."}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Bottom actions */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.startButton, !canStart && styles.startButtonDisabled]}
          disabled={!canStart}
          activeOpacity={0.8}
          onPress={() => onStartVoting(participants.map((p) => p.name))}
        >
          <Text style={styles.startButtonText}>
            {canStart ? 'Start Voting' : `Waiting for others... (${participants.length}/2)`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.leaveButton} onPress={onBack}>
          <Text style={styles.leaveText}>Leave room</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  codeSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  codeBox: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: ACCENT,
    paddingVertical: 14,
    alignItems: "center",
  },
  codeText: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 6,
  },
  shareButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  shareButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 32,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
    marginRight: 10,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 24,
  },
  participantList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  participantName: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  bottomContainer: {
    marginTop: "auto",
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  startButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "700",
  },
  leaveButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  leaveText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
});
