import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";

const ACCENT = Colors.accent;
const TEXT_SECONDARY = Colors.textSecondary;

type Tab = "home" | "validate" | "group" | "ranking" | "profile";

type Props = {
  activeTab: Tab;
  onNavigate: (screen: string) => void;
};

export default function BottomNavigationBar({ activeTab, onNavigate }: Props) {
  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={styles.tab}
        onPress={() => onNavigate("mood")}
      >
        <Text style={[styles.tabIcon, activeTab === "home" && styles.tabActive]}>
          {"\u{1F3E0}"}
        </Text>
        <Text style={[styles.tabLabel, activeTab === "home" && styles.tabActive]}>
          Home
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={() => onNavigate("validate")}
      >
        <Text style={[styles.tabIcon, activeTab === "validate" && styles.tabActive]}>
          {"\u{1F50D}"}
        </Text>
        <Text style={[styles.tabLabel, activeTab === "validate" && styles.tabActive]}>
          Validate
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={() => onNavigate("group")}
      >
        <Text style={[styles.tabIcon, activeTab === "group" && styles.tabActive]}>
          {"\u{1F465}"}
        </Text>
        <Text style={[styles.tabLabel, activeTab === "group" && styles.tabActive]}>
          Group
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={() => onNavigate("leaderboard")}
      >
        <Text style={[styles.tabIcon, activeTab === "ranking" && styles.tabActive]}>
          {"\u{1F3C6}"}
        </Text>
        <Text style={[styles.tabLabel, activeTab === "ranking" && styles.tabActive]}>
          Ranking
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={() => onNavigate("profile")}
      >
        <Text style={[styles.tabIcon, activeTab === "profile" && styles.tabActive]}>
          {"\u{1F464}"}
        </Text>
        <Text style={[styles.tabLabel, activeTab === "profile" && styles.tabActive]}>
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingBottom: 20,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 1,
  },
  tabLabel: {
    color: TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "500",
  },
  tabActive: {
    color: ACCENT,
  },
});
