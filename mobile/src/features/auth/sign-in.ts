/**
 * What happens after any successful sign-in (email, phone, magic link, Google/Microsoft, invitation):
 * save the session, then
 *   - first sign-in / onboarding not finished → Terms (SCR-M-012) → onboarding
 *   - new Terms / Privacy version not accepted yet → Terms → Home
 *   - otherwise → Home
 */
import { router } from "expo-router"
import { legalApi } from "@/lib/api/employee/onboarding"
import { useAuthStore, type EmployeeSession } from "@/lib/auth/session"

export async function completeSignIn(session: EmployeeSession) {
  useAuthStore.getState().setSession("employee", session)
  if (!session.onboardingCompleted) {
    router.replace("/terms")
    return
  }
  try {
    const legal = await legalApi.current()
    if (legal.acceptedVersion !== legal.version) {
      router.replace("/terms")
      return
    }
  } catch {
    // Terms check failed (offline) — continue; it runs again on the next sign-in.
  }
  router.replace("/home")
}

/** "pr•••@nimbustech.in" */
export const maskEmail = (email: string) => email.replace(/^(.{2}).*(@.*)$/, "$1•••$2")

/** Password policy (ASSUMPTION): at least 8 characters with letters and numbers. */
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"]
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score]! }
}
