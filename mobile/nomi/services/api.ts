import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/**
 * Thin wrappers around the three multiplexed backend callables. All
 * Firestore/RTDB access goes through these — the client never touches the
 * database directly (the only exceptions are realtime listeners, which are
 * read-only and enforced by security rules).
 */
const call = async <T>(
  fn: 'userApi' | 'roomApi' | 'restaurantApi',
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> => {
  const callable = httpsCallable(functions, fn);
  const result = await callable({ action, ...payload });
  return result.data as T;
};

export const callUserApi = <T = unknown>(
  action: string,
  payload?: Record<string, unknown>
): Promise<T> => call<T>('userApi', action, payload);

export const callRoomApi = <T = unknown>(
  action: string,
  payload?: Record<string, unknown>
): Promise<T> => call<T>('roomApi', action, payload);

export const callRestaurantApi = <T = unknown>(
  action: string,
  payload?: Record<string, unknown>
): Promise<T> => call<T>('restaurantApi', action, payload);
