/** App version / platform as sent to GET /app/config (SCR-M-001, SCR-M-002) and shown in Settings. */
import Constants from "expo-constants"
import { Platform } from "react-native"

export const APP_VERSION = Constants.expoConfig?.version ?? "2.4.0"
export const APP_PLATFORM = (Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web") as "ios" | "android" | "web"
