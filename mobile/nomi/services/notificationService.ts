import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// Show notifications even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    __DEV__ && console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    __DEV__ && console.log('Push notification permission not granted');
    return null;
  }

  // Set up Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return tokenData.data;
}

export async function savePushTokenToFirestore(uid: string, token: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    expo_push_token: token,
    push_token_updated_at: new Date().toISOString(),
  }, { merge: true });
}

export async function removePushTokenFromFirestore(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    expo_push_token: null,
    push_token_updated_at: new Date().toISOString(),
  }, { merge: true });
}

export type NotificationPreferences = {
  groupInvites: boolean;
  leaderboard: boolean;
  newRestaurants: boolean;
  validateReminders: boolean;
};

export async function syncNotificationPreferences(
  uid: string,
  prefs: NotificationPreferences
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    notification_preferences: prefs,
  }, { merge: true });
}
