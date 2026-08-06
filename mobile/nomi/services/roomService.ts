import { doc, onSnapshot, Timestamp, Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, onValue } from 'firebase/database';
import { db, database, functions } from './firebase';
import { callRoomApi } from './api';

// All writes go through the roomApi callable — the backend derives the acting
// user from request.auth. Only read-only realtime listeners talk to the
// database directly (enforced by security rules).

export type Room = {
  code: string;
  organizer_uid: string;
  participants: Record<string, { name: string; joined_at: Timestamp }>;
  votes: Record<string, Record<string, 'like' | 'pass'>>;
  status: 'waiting' | 'voting' | 'decided';
  winner_id?: string;
  created_at: Timestamp;
  preferences?: {
    moods: string[];
    budget: number;
    distance: number;
  };
};

export const createRoom = async (
  code: string,
  _organizerUid: string,
  organizerName: string,
  preferences?: { moods: string[]; budget: number; distance: number }
): Promise<void> => {
  await callRoomApi('create', { code, name: organizerName, preferences });
};

export const setRoomPreferences = async (
  code: string,
  preferences: { moods: string[]; budget: number; distance: number }
): Promise<void> => {
  await callRoomApi('setPreferences', { code, preferences });
};

export const getRoomPreferences = async (
  code: string
): Promise<{ moods: string[]; budget: number; distance: number } | null> => {
  try {
    const result = await callRoomApi<{ preferences: { moods: string[]; budget: number; distance: number } | null }>(
      'getPreferences',
      { code }
    );
    return result.preferences;
  } catch (error) {
    __DEV__ && console.error('getRoomPreferences error:', error);
    return null;
  }
};

export const joinRoom = async (
  code: string,
  _uid: string,
  name: string
): Promise<boolean> => {
  try {
    const result = await callRoomApi<{ ok: boolean }>('join', { code, name });
    return result.ok;
  } catch (error) {
    __DEV__ && console.error('joinRoom error:', error);
    return false;
  }
};

export const leaveRoom = async (code: string): Promise<void> => {
  try {
    await callRoomApi('leave', { code });
  } catch (error) {
    __DEV__ && console.error('leaveRoom error:', error);
  }
};

export const listenToRoom = (
  code: string,
  callback: (room: Room | null) => void
): Unsubscribe => {
  const roomRef = doc(db, 'rooms', code);
  return onSnapshot(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(snapshot.data() as Room);
  });
};

export const recordVote = async (
  roomCode: string,
  _uid: string,
  restaurantId: string,
  vote: 'like' | 'pass'
): Promise<void> => {
  await callRoomApi('recordVote', { code: roomCode, restaurantId, vote });
};

export const calculateWinner = (
  votes: Record<string, Record<string, 'like' | 'pass'>>,
  restaurantIds: string[]
): string | null => {
  const likeCounts: Record<string, number> = {};

  // Count likes for each restaurant
  for (const uid in votes) {
    const userVotes = votes[uid];
    for (const restaurantId in userVotes) {
      if (userVotes[restaurantId] === 'like') {
        likeCounts[restaurantId] = (likeCounts[restaurantId] || 0) + 1;
      }
    }
  }

  // Find restaurant with most likes
  let winnerId: string | null = null;
  let maxLikes = 0;

  for (const restaurantId of restaurantIds) {
    const likes = likeCounts[restaurantId] || 0;
    if (likes > maxLikes) {
      maxLikes = likes;
      winnerId = restaurantId;
    }
  }

  return winnerId;
};

export const declareWinner = async (
  roomCode: string,
  winnerId: string,
  _organizerUid: string
): Promise<void> => {
  await callRoomApi('declareWinner', { code: roomCode, winnerId });
};

// Final vote functions (Realtime Database listeners for real-time updates)
export const recordFinalVote = async (
  roomCode: string,
  _userId: string,
  restaurantId: string
): Promise<void> => {
  await callRoomApi('recordFinalVote', { code: roomCode, restaurantId });
};

export const listenToFinalVotes = (
  roomCode: string,
  callback: (votes: Record<string, string>) => void
): (() => void) => {
  const votesRef = ref(database, `rooms/${roomCode}/final_votes`);
  const unsubscribe = onValue(votesRef, (snap) => {
    callback(snap.exists() ? snap.val() : {});
  }, (error) => {
    __DEV__ && console.error('Error listening to final votes:', error);
  });
  return unsubscribe;
};

// Event details functions
type EventDetails = {
  event_time: string;
  restaurant_id: string;
  attendance: Record<string, string>;
  note: string;
};

export const setEventDetails = async (
  roomCode: string,
  details: EventDetails
): Promise<void> => {
  await callRoomApi('setEventDetails', { code: roomCode, details });
};

export const updateAttendance = async (
  roomCode: string,
  _userId: string,
  status: 'going' | 'not_going' | 'maybe'
): Promise<void> => {
  await callRoomApi('updateAttendance', { code: roomCode, status });
};

// Preference voting functions
export type PreferenceVote = {
  moods: string[];
  budget: number;
  distance: number;
};

export const recordPreferenceVote = async (
  roomCode: string,
  _userId: string,
  preferences: PreferenceVote
): Promise<void> => {
  await callRoomApi('recordPreferenceVote', { code: roomCode, preferences });
};

export const listenToPreferenceVotes = (
  roomCode: string,
  callback: (votes: Record<string, PreferenceVote>) => void
): (() => void) => {
  const votesRef = ref(database, `rooms/${roomCode}/preference_votes`);
  const unsubscribe = onValue(votesRef, (snap) => {
    callback(snap.exists() ? snap.val() : {});
  }, (error) => {
    __DEV__ && console.error('Error listening to preference votes:', error);
  });
  return unsubscribe;
};

export const calculateConsensus = (
  votes: Record<string, PreferenceVote>
): { moods: string[], budget: number, distance: number } => {
  const voteArray = Object.values(votes);

  if (voteArray.length === 0) {
    return { moods: [], budget: 2, distance: 5 };
  }

  // Calculate mood consensus - moods that appear in majority of votes
  const moodCounts: Record<string, number> = {};
  voteArray.forEach(vote => {
    vote.moods.forEach(mood => {
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });
  });

  const threshold = Math.ceil(voteArray.length / 2);
  const consensusMoods = Object.entries(moodCounts)
    .filter(([_, count]) => count >= threshold)
    .map(([mood]) => mood);

  // Calculate budget - round average
  const avgBudget = voteArray.reduce((sum, vote) => sum + vote.budget, 0) / voteArray.length;
  const consensusBudget = Math.round(avgBudget);

  // Calculate distance - round average
  const avgDistance = voteArray.reduce((sum, vote) => sum + vote.distance, 0) / voteArray.length;
  const consensusDistance = Math.round(avgDistance);

  return {
    moods: consensusMoods,
    budget: consensusBudget,
    distance: consensusDistance,
  };
};

// --- Push Notification Triggers (fire-and-forget) ---

export const notifyGroupJoin = (roomCode: string, inviterName: string): void => {
  const callable = httpsCallable(functions, 'notifyGroupInvite');
  callable({ roomCode, inviterName }).catch((err) => {
    __DEV__ && console.error('notifyGroupJoin error:', err);
  });
};

export const notifyVotingStarted = (roomCode: string): void => {
  const callable = httpsCallable(functions, 'notifyVotingStarted');
  callable({ roomCode }).catch((err) => {
    __DEV__ && console.error('notifyVotingStarted error:', err);
  });
};

export const notifyResultReady = (roomCode: string, restaurantName?: string): void => {
  const callable = httpsCallable(functions, 'notifyResultReady');
  callable({ roomCode, restaurantName }).catch((err) => {
    __DEV__ && console.error('notifyResultReady error:', err);
  });
};
