import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import AuthScreen from "./screens/AuthScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import MoodScreen from "./screens/MoodScreen";
import BudgetDistanceScreen from "./screens/BudgetDistanceScreen";
import SwipeScreen, { type Restaurant } from "./screens/SwipeScreen";
import RestaurantDetailScreen from "./screens/RestaurantDetailScreen";
import GroupScreen from "./screens/GroupScreen";
import WaitingRoomScreen from "./screens/WaitingRoomScreen";
import VotingScreen from "./screens/VotingScreen";
import ResultScreen from "./screens/ResultScreen";
import ProfileScreen from "./screens/ProfileScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import ValidateScreen from "./screens/ValidateScreen";
import SettingsScreen from "./screens/SettingsScreen";
import GroupLikedScreen from "./screens/GroupLikedScreen";
import { Colors } from "./theme/colors";

const ONBOARDED_KEY = "nomi_has_onboarded";

type VotingResult = {
  restaurant: any;
  totalVoters: number;
  likedBy: number;
  roomCode: string;
};

type Screen =
  | "onboarding"
  | "mood"
  | "budget"
  | "swipe"
  | "liked"
  | "detail"
  | "group"
  | "waitingRoom"
  | "voting"
  | "groupLiked"
  | "result"
  | "profile"
  | "leaderboard"
  | "validate"
  | "settings";

function AppNavigator() {
  const { user, loading, isGuest } = useAuth();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [previousScreen, setPreviousScreen] = useState<Screen>("mood");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const [detailRestaurant, setDetailRestaurant] = useState<Restaurant | null>(null);
  const [likedRestaurants, setLikedRestaurants] = useState<Restaurant[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [votingResult, setVotingResult] = useState<VotingResult | null>(null);
  const [groupVotes, setGroupVotes] = useState<Record<string, Record<string, string>>>({});
  const [groupRestaurants, setGroupRestaurants] = useState<Restaurant[]>([]);
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

  // Loading state while checking auth
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  // Show auth screen if not authenticated and not guest
  if (!user && !isGuest) {
    return <AuthScreen />;
  }

  // Loading state while checking AsyncStorage
  if (screen === null) {
    return <></>;
  }

  return (
    <>
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
      {screen === "swipe" && selectedBudget !== null && (
        <SwipeScreen
          selectedMoods={selectedMoods}
          budgetLevel={selectedBudget}
          onBack={() => setScreen("budget")}
          onChangePreferences={() => setScreen("mood")}
          onDetail={(restaurant) => {
            setDetailRestaurant(restaurant);
            setPreviousScreen("swipe");
            setScreen("detail");
          }}
          onShowLiked={(restaurants) => {
            setLikedRestaurants(restaurants);
            setScreen("liked");
          }}
        />
      )}
      {screen === "liked" && (
        <LikedScreen
          likedRestaurants={likedRestaurants}
          onSelect={(restaurant) => {
            setDetailRestaurant(restaurant);
            setPreviousScreen("liked");
            setScreen("detail");
          }}
          onStartOver={() => setScreen("mood")}
        />
      )}
      {screen === "detail" && detailRestaurant && (
        <RestaurantDetailScreen
          restaurant={detailRestaurant}
          previousScreen={previousScreen}
          onBack={() => setScreen(previousScreen)}
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
      {screen === "voting" && selectedBudget !== null && (
        <VotingScreen
          roomCode={roomCode}
          selectedMoods={selectedMoods}
          budgetLevel={selectedBudget}
          onVotingComplete={(restaurants, votes) => {
            setGroupRestaurants(restaurants);
            setGroupVotes(votes);
            setScreen("groupLiked");
          }}
          onBack={() => setScreen("waitingRoom")}
        />
      )}
      {screen === "groupLiked" && (
        <GroupLikedScreen
          restaurants={groupRestaurants}
          votes={groupVotes}
          totalVoters={Object.keys(groupVotes).length}
          onSelect={(restaurant) => {
            setDetailRestaurant(restaurant);
            setPreviousScreen("groupLiked");
            setScreen("detail");
          }}
          onStartOver={() => {
            setGroupRestaurants([]);
            setGroupVotes({});
            setSelectedMoods([]);
            setSelectedBudget(null);
            setSelectedDistance(null);
            setRoomCode("");
            setParticipants([]);
            setScreen("mood");
          }}
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
          onNavigate={(s) => {
            if (s === "detail" && votingResult.restaurant) {
              setDetailRestaurant(votingResult.restaurant as Restaurant);
              setPreviousScreen("result");
              setScreen("detail");
            } else {
              setScreen(s as Screen);
            }
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
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
