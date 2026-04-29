import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Share,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../theme/colors";
import BottomNavigationBar from "../components/BottomNavigationBar";
import { useAuth } from "../context/AuthContext";

const ACCENT = Colors.accent;
const BG = Colors.background;
const CARD_BG = Colors.cardBackground;
const TEXT_PRIMARY = Colors.textPrimary;
const TEXT_SECONDARY = Colors.textSecondary;
const INPUT_BG = Colors.cardBackground;

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

type Props = {
  onBack: () => void;
  onJoinRoom: (code: string) => void;
  onNavigate: (screen: string) => void;
};

export default function GroupScreen({ onBack, onJoinRoom, onNavigate }: Props) {
  const { isGuest, signOut } = useAuth();
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");

  const handleCreate = () => {
    if (isGuest) {
      Alert.alert(
        'Account required',
        'Create a free account to use group rooms and earn points.',
        [
          { text: 'Maybe later', style: 'cancel' },
          { text: 'Sign up', onPress: () => signOut() },
        ]
      );
      return;
    }
    const code = generateRoomCode();
    setRoomCode(code);
  };

  const handleShare = async () => {
    if (!roomCode) return;
    await Share.share({
      message: `Join my Nomi room! Code: ${roomCode}\nhttps://nomi.app/room/${roomCode}`,
    });
  };

  const handleJoin = () => {
    if (isGuest) {
      Alert.alert(
        'Account required',
        'Create a free account to use group rooms and earn points.',
        [
          { text: 'Maybe later', style: 'cancel' },
          { text: 'Sign up', onPress: () => signOut() },
        ]
      );
      return;
    }
    if (joinInput.length === 6) {
      onJoinRoom(joinInput.toUpperCase());
    }
  };

  const joinValid = joinInput.length === 6;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Decide together</Text>
        <Text style={styles.subtitle}>Create a room and invite your friends</Text>

        {/* Created room code display */}
        {roomCode ? (
          <View style={styles.codeSection}>
            <Text style={styles.codeLabel}>Your room code</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText} selectable>{roomCode}</Text>
            </View>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Text style={styles.shareButtonText}>Share Room Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.enterRoomButton}
              onPress={() => onJoinRoom(roomCode)}
            >
              <Text style={styles.enterRoomText}>Enter Room</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
            <Text style={styles.createButtonText}>Create Room</Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        {!roomCode && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Join input */}
            <View style={styles.joinRow}>
              <TextInput
                style={styles.joinInput}
                placeholder="Enter room code"
                placeholderTextColor={Colors.textSecondary}
                value={joinInput}
                onChangeText={(text) => setJoinInput(text.toUpperCase().slice(0, 6))}
                autoCapitalize="characters"
                maxLength={6}
              />
              <TouchableOpacity
                style={[styles.joinButton, !joinValid && styles.joinButtonDisabled]}
                disabled={!joinValid}
                onPress={handleJoin}
              >
                <Text style={styles.joinButtonText}>Join</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* How it works */}
        <View style={styles.stepsSection}>
          <Text style={styles.stepsTitle}>How it works</Text>
          <View style={styles.stepsRow}>
            <View style={styles.step}>
              <Text style={styles.stepEmoji}>{"\u{1F3E0}"}</Text>
              <Text style={styles.stepLabel}>Create room</Text>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.step}>
              <Text style={styles.stepEmoji}>{"\u{1F44D}"}</Text>
              <Text style={styles.stepLabel}>Friends join & vote</Text>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.step}>
              <Text style={styles.stepEmoji}>{"\u{2728}"}</Text>
              <Text style={styles.stepLabel}>App decides</Text>
            </View>
          </View>
        </View>
      </View>

      <BottomNavigationBar activeTab="group" onNavigate={onNavigate} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  backText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 16,
    marginBottom: 32,
  },
  createButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  createButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "700",
  },
  codeSection: {
    alignItems: "center",
    gap: 14,
  },
  codeLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  codeBox: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: ACCENT,
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  codeText: {
    color: TEXT_PRIMARY,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 6,
  },
  shareButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  shareButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  enterRoomButton: {
    borderWidth: 2,
    borderColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  enterRoomText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.stepInactive,
  },
  dividerText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginHorizontal: 16,
  },
  joinRow: {
    flexDirection: "row",
    gap: 12,
  },
  joinInput: {
    flex: 1,
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TEXT_PRIMARY,
    fontSize: 16,
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  joinButtonDisabled: {
    opacity: 0.4,
  },
  joinButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  stepsSection: {
    marginTop: "auto",
    marginBottom: 100,
  },
  stepsTitle: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 16,
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  step: {
    alignItems: "center",
    width: 90,
  },
  stepEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  stepLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    textAlign: "center",
  },
  stepConnector: {
    width: 20,
    height: 1,
    backgroundColor: Colors.stepInactive,
    marginHorizontal: 4,
  },
});
