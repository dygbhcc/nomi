import React, { useState, useEffect, useRef } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nextProvider, useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import i18n, { initI18n } from "./i18n";
import AuthScreen from "./screens/AuthScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import MoodScreen from "./screens/MoodScreen";
import BudgetDistanceScreen from "./screens/BudgetDistanceScreen";
import SwipeScreen, { type Restaurant } from "./screens/SwipeScreen";
import LikedScreen from "./screens/LikedScreen";
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
import GroupVoteScreen from "./screens/GroupVoteScreen";
import EventPlanScreen from "./screens/EventPlanScreen";
import { Colors } from "./theme/colors";
import { getRoomPreferences } from "./services/roomService";

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
  | "groupVote"
  | "eventPlan"
  | "result"
  | "profile"
  | "leaderboard"
  | "validate"
  | "settings";

function AppNavigator() {
  const { user, loading, isGuest } = useAuth();
  const { t } = useTranslation();
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
  const [likedGroupRestaurants, setLikedGroupRestaurants] = useState<Restaurant[]>([]);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [returnScreen, setReturnScreen] = useState<Screen>("mood");
  const consensusCalculatedRef = useRef(false);

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
          onGroup={() => {
            setIsGroupMode(true);
            setScreen("group");
          }}
          onProfile={() => setScreen("profile")}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}
      {screen === "budget" && (
        <BudgetDistanceScreen
          selectedMoods={selectedMoods}
          isGroupMode={isGroupMode}
          isHost={isHost}
          roomCode={roomCode}
          onContinue={(budget, distance) => {
            setSelectedBudget(budget);
            setSelectedDistance(distance);
            setScreen(isGroupMode ? "waitingRoom" : "swipe");
          }}
          onBack={() => {
            setIsGroupMode(false);
            setIsHost(false);
            setScreen("mood");
          }}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}
      {screen === "swipe" && selectedBudget !== null && (
        <SwipeScreen
          selectedMoods={selectedMoods}
          budgetLevel={selectedBudget}
          selectedDistance={selectedDistance}
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
          onStartOver={() => {
            __DEV__ && console.log('Start Over clicked - resetting state');
            setLikedRestaurants([]);
            setSelectedMoods([]);
            setSelectedBudget(null);
            setSelectedDistance(null);
            setIsGroupMode(false);
            setIsHost(false);
            setRoomCode("");
            setParticipants([]);
            __DEV__ && console.log('Navigating to mood screen');
            setScreen("mood");
          }}
        />
      )}
      {screen === "detail" && detailRestaurant && (
        <RestaurantDetailScreen
          restaurant={detailRestaurant}
          previousScreen={previousScreen}
          onBack={() => {
            // Go back to previous screen (swipe, liked, groupLiked, etc.)
            setScreen(previousScreen);
          }}
        />
      )}
      {screen === "group" && (
        <GroupScreen
          onBack={() => setScreen("mood")}
          onStartVoting={(code, moods, budget, distanceMeters) => {
            setRoomCode(code);
            setIsGroupMode(true);
            setIsHost(true);
            setSelectedMoods(moods);
            setSelectedBudget(budget);
            setSelectedDistance(distanceMeters);
            setScreen("waitingRoom");
          }}
          onJoinRoom={(code) => {
            setRoomCode(code);
            setIsGroupMode(true);
            setIsHost(false);
            setScreen("waitingRoom");
          }}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}
      {screen === "waitingRoom" && (
        <WaitingRoomScreen
          roomCode={roomCode}
          onBack={() => setScreen("group")}
          onStartVoting={async (names) => {
            setParticipants(names);

            // If in group mode, load host's preferences from room
            if (isGroupMode && roomCode) {
              try {
                const preferences = await getRoomPreferences(roomCode);
                if (preferences) {
                  __DEV__ && console.log('Loaded room preferences:', preferences);
                  setSelectedMoods(preferences.moods);
                  setSelectedBudget(preferences.budget);
                  setSelectedDistance(preferences.distance * 1000); // Convert km to meters
                  setScreen("voting");
                } else {
                  __DEV__ && console.warn('No preferences found in room');
                  setScreen("voting");
                }
              } catch (error) {
                __DEV__ && console.error('Error loading room preferences:', error);
                setScreen("voting");
              }
            } else {
              setScreen("mood");
            }
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
          onDetail={(restaurant) => {
            setDetailRestaurant(restaurant);
            setPreviousScreen("voting");
            setScreen("detail");
          }}
        />
      )}
      {screen === "voting" && selectedBudget === null && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background }}>
          <Text style={{ color: Colors.textPrimary, fontSize: 18 }}>{t('common.loadingPreferences')}</Text>
        </View>
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
          onFinalVote={() => {
            // Calculate liked restaurants before going to vote screen
            const getLikeCount = (restaurantId: string): number => {
              return Object.values(groupVotes).filter(
                userVotes => userVotes[restaurantId] === 'like'
              ).length;
            };
            const liked = groupRestaurants
              .map(r => ({ ...r, likeCount: getLikeCount(r.id) }))
              .filter(r => r.likeCount > 0)
              .sort((a, b) => b.likeCount - a.likeCount);
            setLikedGroupRestaurants(liked);
            setScreen("groupVote");
          }}
          onStartOver={() => {
            setGroupRestaurants([]);
            setGroupVotes({});
            setLikedGroupRestaurants([]);
            setIsGroupMode(false);
            setIsHost(false);
            setSelectedMoods([]);
            setSelectedBudget(null);
            setSelectedDistance(null);
            setRoomCode("");
            setParticipants([]);
            setScreen("mood");
          }}
        />
      )}
      {screen === "groupVote" && likedGroupRestaurants.length > 0 && (
        <GroupVoteScreen
          roomCode={roomCode}
          restaurants={likedGroupRestaurants}
          totalParticipants={Object.keys(groupVotes).length}
          onWinner={(restaurant) => {
            setDetailRestaurant(restaurant);
            setScreen("eventPlan");
          }}
          onStartOver={() => {
            setGroupRestaurants([]);
            setGroupVotes({});
            setLikedGroupRestaurants([]);
            setIsGroupMode(false);
            setIsHost(false);
            setSelectedMoods([]);
            setSelectedBudget(null);
            setSelectedDistance(null);
            setRoomCode("");
            setParticipants([]);
            setScreen("mood");
          }}
        />
      )}
      {screen === "eventPlan" && detailRestaurant && user && (
        <EventPlanScreen
          roomCode={roomCode}
          restaurant={detailRestaurant}
          isOrganizer={true}
          currentUserId={user.uid}
          onDone={() => {
            // Navigate to event summary (Task 5.5-5.6)
            setScreen("mood"); // For now, go back to mood
          }}
        />
      )}
      {screen === "result" && (
        <ResultScreen
          restaurant={votingResult?.restaurant || {
            id: "test-1",
            name: "Taberna da Rua das Flores",
            distance: "5 min walk",
            budget: 2,
            moods: ["romantic", "chill"],
            reason: "Perfect cozy atmosphere for a relaxed evening with Portuguese charm",
            photo: require("./assets/images/restaurants/taberna-rua-das-flores.jpg")
          }}
          totalVoters={votingResult?.totalVoters || 4}
          likedBy={votingResult?.likedBy || 3}
          isCurrentUserWinner={true}
          roomCode={votingResult?.roomCode || "TEST123"}
          onStartOver={() => {
            setVotingResult(null);
            setIsGroupMode(false);
            setIsHost(false);
            setSelectedMoods([]);
            setSelectedBudget(null);
            setSelectedDistance(null);
            setRoomCode("");
            setParticipants([]);
            setScreen("mood");
          }}
          onNavigate={(s) => {
            if (s === "detail" && votingResult?.restaurant) {
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
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => {
      setI18nReady(true);
    });
  }, []);

  if (!i18nReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
