/**
 * Push notifications. Screens only use `pushService`; today it is a MOCK.
 *
 * TODO (real push — needs a development build and an EAS project id):
 *  - `npx expo install expo-notifications expo-device` and add "expo-notifications" to the
 *    plugins in app.config.ts (Android: google-services.json for FCM; iOS: APNs key in EAS).
 *  - getPermissionStatus / requestPermission → Notifications.getPermissionsAsync /
 *    requestPermissionsAsync (Android 13+ shows the POST_NOTIFICATIONS prompt).
 *  - getDeviceToken → Notifications.getExpoPushTokenAsync({ projectId }) or
 *    getDevicePushTokenAsync() for raw FCM / APNs tokens; then POST it to /me/devices
 *    (onboardingApi.savePermissions passes `pushToken`).
 *  - Handle taps with Notifications.addNotificationResponseReceivedListener → router.push(href).
 */
import { Platform } from "react-native"

export type PushPermission = "granted" | "denied" | "undetermined"

export interface PushService {
  getPermissionStatus(): Promise<PushPermission>
  /** Shows the operating-system prompt (only once per install on iOS). */
  requestPermission(): Promise<PushPermission>
  /** Token to register with the backend, or null when not allowed. */
  getDeviceToken(): Promise<string | null>
}

let status: PushPermission = "undetermined"
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const mockPushService: PushService = {
  async getPermissionStatus() {
    return status
  },
  async requestPermission() {
    await wait(500)
    status = "granted"
    return status
  },
  async getDeviceToken() {
    return status === "granted" ? `mock-${Platform.OS}-push-${Date.now().toString(36)}` : null
  },
}

export const pushService: PushService = mockPushService
