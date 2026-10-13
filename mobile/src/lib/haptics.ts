/** Haptic feedback for key actions. No-ops on web and when the device has no haptics. */
import * as Haptics from "expo-haptics"
import { Platform } from "react-native"

const enabled = Platform.OS === "ios" || Platform.OS === "android"
const run = (fn: () => Promise<void>) => {
  if (enabled) fn().catch(() => undefined)
}

export const haptic = {
  /** Light tap — buttons, chips, toggles. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Selection change — segmented controls, pickers. */
  select: () => run(() => Haptics.selectionAsync()),
  /** Something was saved / goal reached. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Validation or API error. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
}
