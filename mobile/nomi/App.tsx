import React, { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MoodScreen from "./screens/MoodScreen";
import BudgetScreen from "./screens/BudgetScreen";
import DistanceScreen from "./screens/DistanceScreen";
import SwipeScreen, { type Restaurant } from "./screens/SwipeScreen";
import RestaurantDetailScreen from "./screens/RestaurantDetailScreen";
import GroupScreen from "./screens/GroupScreen";
import WaitingRoomScreen from "./screens/WaitingRoomScreen";

type Screen = "mood" | "budget" | "distance" | "swipe" | "detail" | "group" | "waitingRoom";

export default function App() {
  const [screen, setScreen] = useState<Screen>("mood");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [detailRestaurant, setDetailRestaurant] = useState<Restaurant | null>(null);
  const [roomCode, setRoomCode] = useState("");

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
        />
      )}
    </SafeAreaProvider>
  );
}
