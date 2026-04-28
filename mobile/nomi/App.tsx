import React, { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MoodScreen from "./screens/MoodScreen";
import BudgetScreen from "./screens/BudgetScreen";
import DistanceScreen from "./screens/DistanceScreen";
import SwipeScreen, { type Restaurant } from "./screens/SwipeScreen";
import RestaurantDetailScreen from "./screens/RestaurantDetailScreen";
import GroupScreen from "./screens/GroupScreen";
import WaitingRoomScreen from "./screens/WaitingRoomScreen";
import VotingScreen from "./screens/VotingScreen";
import ResultScreen from "./screens/ResultScreen";
import ProfileScreen from "./screens/ProfileScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import ValidateScreen from "./screens/ValidateScreen";

type Screen =
  | "mood"
  | "budget"
  | "distance"
  | "swipe"
  | "detail"
  | "group"
  | "waitingRoom"
  | "voting"
  | "result"
  | "profile"
  | "leaderboard"
  | "validate";

export default function App() {
  const [screen, setScreen] = useState<Screen>("mood");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [detailRestaurant, setDetailRestaurant] = useState<Restaurant | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [winnerName, setWinnerName] = useState("");
  // Track where to return after validate screen
  const [returnScreen, setReturnScreen] = useState<Screen>("mood");

  return (
    <SafeAreaProvider>
      {screen === "mood" && (
        <MoodScreen
          onContinue={(moods) => {
            setSelectedMoods(moods);
            setScreen("budget");
          }}
          onSkip={() => setScreen("budget")}
          onGroup={() => setScreen("group")}
          onProfile={() => setScreen("profile")}
        />
      )}
      {screen === "budget" && (
        <BudgetScreen
          selectedMoods={selectedMoods}
          onContinue={(budget) => {
            setSelectedBudget(budget);
            setScreen("distance");
          }}
          onBack={() => setScreen("mood")}
        />
      )}
      {screen === "distance" && (
        <DistanceScreen
          selectedMoods={selectedMoods}
          selectedBudget={selectedBudget}
          onContinue={() => setScreen("swipe")}
          onBack={() => setScreen("budget")}
        />
      )}
      {screen === "swipe" && (
        <SwipeScreen
          onBack={() => setScreen("distance")}
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
          onFinish={(winner) => {
            setWinnerName(winner);
            setScreen("result");
          }}
          onBack={() => setScreen("waitingRoom")}
        />
      )}
      {screen === "result" && (
        <ResultScreen
          winnerName={winnerName}
          onDone={() => setScreen("mood")}
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
        />
      )}
    </SafeAreaProvider>
  );
}
