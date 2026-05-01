import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  increment,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { ref, set, update, onValue, off } from 'firebase/database';
import { db, database } from './firebase';

export type Room = {
  code: string;
  organizer_uid: string;
  participants: Record<string, { name: string; joined_at: Timestamp }>;
  votes: Record<string, Record<string, 'like' | 'pass'>>;
  status: 'waiting' | 'voting' | 'decided';
  winner_id?: string;
  created_at: Timestamp;
};

export const createRoom = async (
  code: string,
  organizerUid: string,
  organizerName: string
): Promise<void> => {
  const roomRef = doc(db, 'rooms', code);
  await setDoc(roomRef, {
    code,
    organizer_uid: organizerUid,
    participants: {
      [organizerUid]: {
        name: organizerName,
        joined_at: Timestamp.now(),
      },
    },
    votes: {},
    status: 'waiting',
    created_at: Timestamp.now(),
  });
};

export const joinRoom = async (
  code: string,
  uid: string,
  name: string
): Promise<boolean> => {
  try {
    const roomRef = doc(db, 'rooms', code);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) return false;

    await updateDoc(roomRef, {
      [`participants.${uid}`]: {
        name,
        joined_at: Timestamp.now(),
      },
    });

    return true;
  } catch (error) {
    __DEV__ && console.error('joinRoom error:', error);
    return false;
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
  uid: string,
  restaurantId: string,
  vote: 'like' | 'pass'
): Promise<void> => {
  const roomRef = doc(db, 'rooms', roomCode);
  await updateDoc(roomRef, {
    [`votes.${uid}.${restaurantId}`]: vote,
  });
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
  organizerUid: string
): Promise<void> => {
  const roomRef = doc(db, 'rooms', roomCode);
  await updateDoc(roomRef, {
    winner_id: winnerId,
    status: 'decided',
  });

  // Award points to organizer
  const userRef = doc(db, 'users', organizerUid);
  await updateDoc(userRef, {
    points: increment(100),
  });
};

// Final vote functions (using Realtime Database for real-time updates)
export const recordFinalVote = async (
  roomCode: string,
  userId: string,
  restaurantId: string
): Promise<void> => {
  const votesRef = ref(database, `rooms/${roomCode}/final_votes/${userId}`);
  await set(votesRef, restaurantId);
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
  // Update Realtime Database for real-time sync
  const eventRef = ref(database, `rooms/${roomCode}/event`);
  await update(eventRef, details);

  // Also update Firestore for persistence
  const roomRef = doc(db, 'rooms', roomCode);
  await updateDoc(roomRef, {
    event_time: details.event_time,
    restaurant_id: details.restaurant_id,
    note: details.note,
  });
};

export const updateAttendance = async (
  roomCode: string,
  userId: string,
  status: 'going' | 'not_going' | 'maybe'
): Promise<void> => {
  const attendanceRef = ref(database, `rooms/${roomCode}/event/attendance/${userId}`);
  await set(attendanceRef, status);
};
