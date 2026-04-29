import React, { useState, useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OnboardingScreen from "./screens/OnboardingScreen";
import MoodScreen from "./screens/MoodScreen";
import BudgetDistanceScreen from "./screens/BudgetDistanceScreen";
import SwipeScreen, { type Restaurant } from "./screens/SwipeScreen";
import RestaurantDetailScreen from "./screens/RestaurantDetailScreen";
import GroupScreen from "./screens/GroupScreen";
import WaitingRoomScreen from "./screens/WaitingRoomScreen";
import VotingScreen, { type VotingResult } from "./screens/VotingScreen";
import ResultScreen from "./screens/ResultScreen";
import ProfileScreen from "./screens/ProfileScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import ValidateScreen from "./screens/ValidateScreen";
import SettingsScreen from "./screens/SettingsScreen";

const ONBOARDED_KEY = "nomi_has_onboarded";

type Screen =
  | "onboarding"
  | "mood"
  | "budget"
  | "swipe"
  | "detail"
  | "group"
  | "waitingRoom"
  | "voting"
  | "result"
  | "profile"
  | "leaderboard"
  | "validate"
  | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const [detailRestaurant, setDetailRestaurant] = useState<Restaurant | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [votingResult, setVotingResult] = useState<VotingResult | null>(null);
  const [returnScreen, setReturnScreen] = useState<Screen>("mood");

  // Check onboarding status on startup
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY).then((value) => {
      setScreen(value === "true" ? "mood" : "onboarding");
    });
  }, []);

  const handleOnboardingDone = async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, "true");
    setScreen("mood");
  };

  // Loading state while checking AsyncStorage
  if (screen === null) {
    return (
      <SafeAreaProvider>
        <></>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {screen === "onboarding" && (
        <OnboardingScreen onDone={handleOnboardingDone} />
      )}
      {screen === "mood" && (
        <MoodScreen
          onContinue={(moods) => {
            setSelectedMoods(moods);
            setScreen("budget");
          }}
          onSkip={() => setScreen("budget")}
          onGroup={() => setScreen("group")}
          onProfile={() => setScreen("profile")}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}
      {screen === "budget" && (
        <BudgetDistanceScreen
          selectedMoods={selectedMoods}
          onContinue={(budget, distance) => {
            setSelectedBudget(budget);
            setSelectedDistance(distance);
            setScreen("swipe");
          }}
          onBack={() => setScreen("mood")}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}
      {screen === "swipe" && (
        <SwipeScreen
          onBack={() => setScreen("budget")}
          onChangePreferences={() => setScreen("mood")}
          onDetail={(restaurant) => {
            setDetailRestaurant(restaurant);
            setScreen("detail");
          }}
        />
      )}
      {screen === "detail" && detailRestaurant && (
        <RestaurantDetailScreen
          restaurant={detailRestaurant}
          onBack={() => setScreen("swipe")}
        />
      )}
      {screen === "group" && (
        <GroupScreen
          onBack={() => setScreen("mood")}
          onJoinRoom={(code) => {
            setRoomCode(code);
            setScreen("waitingRoom");
          }}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}
      {screen === "waitingRoom" && (
        <WaitingRoomScreen
          roomCode={roomCode}
          onBack={() => setScreen("group")}
          onStartVoting={(names) => {
            setParticipants(names);
            setScreen("voting");
          }}
        />
      )}
      {screen === "voting" && (
        <VotingScreen
          roomCode={roomCode}
          participants={participants}
          onFinish={(result) => {
            setVotingResult(result);
            setScreen("result");
          }}
          onBack={() => setScreen("waitingRoom")}
        />
      )}
      {screen === "result" && votingResult && (
        <ResultScreen
          restaurant={votingResult.restaurant}
          totalVoters={votingResult.totalVoters}
          likedBy={votingResult.likedBy}
          isCurrentUserWinner={true}
          roomCode={votingResult.roomCode}
          onStartOver={() => {
            setVotingResult(null);
            setSelectedMoods([]);
            setSelectedBudget(null);
            setSelectedDistance(null);
            setRoomCode("");
            setParticipants([]);
            setScreen("mood");
          }}
        />
      )}
      {screen === "profile" && (
        <ProfileScreen
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}
      {screen === "leaderboard" && (
        <LeaderboardScreen
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}
      {screen === "validate" && (
        <ValidateScreen
          onDone={() => setScreen(returnScreen)}
          onSkip={() => setScreen(returnScreen)}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}
      {screen === "settings" && (
        <SettingsScreen
          onBack={() => setScreen("profile")}
        />
      )}
    </SafeAreaProvider>
  );
}
