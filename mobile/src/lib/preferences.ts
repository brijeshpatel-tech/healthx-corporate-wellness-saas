/**
 * Device-level app preferences (not synced to the server): theme override.
 * Persisted in AsyncStorage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type ThemePreference = "system" | "light" | "dark"

interface PreferencesState {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "healthx.preferences", storage: createJSONStorage(() => AsyncStorage) },
  ),
)
