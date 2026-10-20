import AsyncStorage from '@react-native-async-storage/async-storage';

import type { User } from '@/types/models';

export const STORAGE_KEYS = {
  token: '@micromaster/auth/token',
  user: '@micromaster/auth/user',
  settings: '@micromaster/settings',
} as const;

function createStringStorage(key: string) {
  return {
    get: (): Promise<string | null> => AsyncStorage.getItem(key),
    set: (value: string): Promise<void> => AsyncStorage.setItem(key, value),
    clear: (): Promise<void> => AsyncStorage.removeItem(key),
  };
}

export const tokenStorage = createStringStorage(STORAGE_KEYS.token);

export const userStorage = {
  get: async (): Promise<User | null> => {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.user);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
  set: (user: User): Promise<void> => AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user)),
  clear: (): Promise<void> => AsyncStorage.removeItem(STORAGE_KEYS.user),
};

export async function clearSessionStorage(): Promise<void> {
  await Promise.all([tokenStorage.clear(), userStorage.clear()]);
}
