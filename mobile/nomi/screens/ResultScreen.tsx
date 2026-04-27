import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const ACCENT = "#7F77DD";
const BG = "#0D0D0D";
const CARD_BG = "#1A1A1A";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#888888";

type Props = {
  winnerName: string;
  onDone: () => void;
};

export default function ResultScreen({ winnerName, onDone }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        <Text style={styles.emoji}>{"\u{1F389}"}</Text>
        <Text style={styles.title}>The group has decided!</Text>
        <Text style={styles.subtitle}>Everyone's heading to</Text>

        <View style={styles.winnerBox}>
          <Text style={styles.winnerName}>{winnerName}</Text>
        </View>

        <TouchableOpacity style={styles.doneButton} onPress={onDone}>
          <Text style={styles.doneButtonText}>Back to Home</Text>
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
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 16,
    marginBottom: 20,
  },
  winnerBox: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: ACCENT,
    paddingVertical: 20,
    paddingHorizontal: 32,
    marginBottom: 40,
  },
  winnerName: {
    color: ACCENT,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  doneButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  doneButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "700",
  },
});
