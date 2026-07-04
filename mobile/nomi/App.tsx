import React, { useState, useEffect, useRef } from "react";
import { View, ActivityIndicator, Text, Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nextProvider, useTranslation } from "react-i18next";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import i18n, { initI18n } from "./i18n";
import AuthScreen from "./screens/AuthScreen";
import VerifyEmailScreen from "./screens/VerifyEmailScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import { applyVerificationCode } from "./services/authService";
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
import ValidateScreen from "./screens/ValidateScreen";
import SettingsScreen from "./screens/SettingsScreen";
import GroupLikedScreen from "./screens/GroupLikedScreen";
import GroupVoteScreen from "./screens/GroupVoteScreen";
import EventPlanScreen from "./screens/EventPlanScreen";
import { Colors } from "./theme/colors";
import { getRoomPreferences } from "./services/roomService";
import { notifyVotingStarted, notifyResultReady } from "./services/roomService";
import {
  registerForPushNotificationsAsync,
  savePushTokenToFirestore,
} from "./services/notificationService";
import { getUserCoords, type Coords } from "./services/locationService";

const ONBOARDED_KEY = "nomi_has_onboarded";

// Require email-account users to confirm their email before entering the app.
// Guests (anonymous) are exempt. Flip to false to disable enforcement.
const REQUIRE_EMAIL_VERIFICATION = true;

// Fallback restaurant for the result screen when opened via the dev test shortcut
const TEST_RESULT_RESTAURANT = {
  id: "test-1",
  name: "Taberna da Rua das Flores",
  distance: "5 min walk",
  budget: 2,
  moods: ["romantic", "chill"],
  reason: "Perfect cozy atmosphere for a relaxed evening with Portuguese charm",
  photo: require("./assets/images/restaurants/taberna-rua-das-flores.jpg"),
};

// Parse a Firebase auth-action deep link (nomi://auth-action?mode=...&oobCode=...)
// forwarded by the hosted redirect page. Returns null for any other URL.
function parseAuthActionUrl(url: string | null): { mode: string; oobCode: string } | null {
  if (!url || !url.includes("auth-action")) return null;
  const query = url.split("?")[1];
  if (!query) return null;
  const params: Record<string, string> = {};
  for (const pair of query.split("&")) {
    const [key, value] = pair.split("=");
    if (key && value) params[key] = decodeURIComponent(value);
  }
  if (!params.mode || !params.oobCode) return null;
  return { mode: params.mode, oobCode: params.oobCode };
}

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
  | "validate"
  | "settings";

function AppNavigator() {
  const { user, loading, isGuest, refreshVerification } = useAuth();
  const { t } = useTranslation();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [previousScreen, setPreviousScreen] = useState<Screen>("mood");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
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
  const [resetPasswordCode, setResetPasswordCode] = useState<string | null>(null);
  const consensusCalculatedRef = useRef(false);

  // Handle Firebase auth-action deep links (password reset / email verify)
  // arriving via the nomi:// scheme, both on cold start and while running.
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      const action = parseAuthActionUrl(url);
      if (!action) return;
      if (action.mode === "resetPassword") {
        setResetPasswordCode(action.oobCode);
      } else if (action.mode === "verifyEmail") {
        try {
          await applyVerificationCode(action.oobCode);
          await refreshVerification();
        } catch (e) {
          if (__DEV__) console.error("applyVerificationCode failed:", e);
        }
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // Check onboarding status on startup
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY).then((value) => {
      setScreen(value === "true" ? "mood" : "onboarding");
    });
  }, []);

  // Request location once on startup so recommendations use the user's real
  // position. Falls back to Lisbon (handled in SwipeScreen) if denied.
  useEffect(() => {
    getUserCoords().then((coords) => {
      if (coords) setUserCoords(coords);
    });
  }, []);

  // Register push notifications and set up listeners
  useEffect(() => {
    if (!user) return;

    // Register and save token
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        savePushTokenToFirestore(user.uid, token);
      }
    });

    // Foreground notification listener
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      __DEV__ && console.log('Notification received:', notification.request.content);
    });

    // Tap-to-navigate listener
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      __DEV__ && console.log('Notification tapped:', data);

      switch (data?.type) {
        case 'group_invite':
        case 'voting_started':
          if (data.roomCode) {
            setRoomCode(data.roomCode as string);
            setIsGroupMode(true);
            setScreen("waitingRoom");
          }
          break;
        case 'result_ready':
          if (data.roomCode) {
            setRoomCode(data.roomCode as string);
            setScreen("result");
          }
          break;
        case 'validate_reminder':
          setScreen("validate");
          break;
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [user]);

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

  // Password-reset deep link takes priority — it arrives signed-out.
  if (resetPasswordCode) {
    return (
      <ResetPasswordScreen
        oobCode={resetPasswordCode}
        onDone={() => setResetPasswordCode(null)}
      />
    );
  }

  // Show auth screen if not authenticated and not guest
  if (!user && !isGuest) {
    return <AuthScreen />;
  }

  // Gate email-account users behind email verification (guests are exempt).
  if (
    REQUIRE_EMAIL_VERIFICATION &&
    user &&
    !user.isAnonymous &&
    !!user.email &&
    !user.emailVerified &&
    !isGuest
  ) {
    return <VerifyEmailScreen />;
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
      {(screen === "swipe" || (screen === "detail" && previousScreen === "swipe")) && selectedBudget !== null && (
        <View style={screen === "swipe" ? { flex: 1 } : { display: 'none' }}>
          <SwipeScreen
            selectedMoods={selectedMoods}
            budgetLevel={selectedBudget}
            selectedDistance={selectedDistance}
            userLat={userCoords?.lat ?? null}
            userLng={userCoords?.lng ?? null}
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
        </View>
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
          selectedMoods={selectedMoods}
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

            // Notify participants that voting has started
            if (roomCode) {
              notifyVotingStarted(roomCode);
            }

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
            notifyResultReady(roomCode, restaurant.name);
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
          restaurant={votingResult?.restaurant || TEST_RESULT_RESTAURANT}
          totalVoters={votingResult?.totalVoters || 4}
          likedBy={votingResult?.likedBy || 3}
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
            if (s === "detail") {
              setDetailRestaurant((votingResult?.restaurant || TEST_RESULT_RESTAURANT) as Restaurant);
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
      {screen === "validate" && (
        <ValidateScreen
          selectedMoods={selectedMoods}
          userLat={userCoords?.lat ?? null}
          userLng={userCoords?.lng ?? null}
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
