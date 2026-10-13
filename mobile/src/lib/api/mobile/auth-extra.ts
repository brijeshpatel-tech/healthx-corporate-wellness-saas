/**
 * MOBILE-ONLY services (not in web/src/lib yet). Same endpoint() pattern as the synced services.
 * If the web app adds an equivalent, delete this file and use the synced one.
 *
 * - register → POST /auth/register (SCR-M-006 "Create account"). The web employee app only signs in.
 */
import { ApiError, badRequest, endpoint } from "@/lib/api/core"
import { buildEmployeeSession } from "@/lib/api/auth"
import type { EmployeeSession } from "@/lib/auth/session"

export const mobileAuthApi = {
  register: endpoint<{ email: string; password: string; companyId?: string }, EmployeeSession, "employee">("employee", "POST", "/auth/register", ({ email, password }, { db, save }) => {
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
      throw badRequest("Use at least 8 characters with letters and numbers.", { password: "At least 8 characters with letters and numbers" })
    }
    const e = db.employees.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    if (!e) throw new ApiError("This email isn't on your company's list. Ask your HR team to invite you.", 403, "not_invited", { email: "Not invited by your company" })
    if (e.status === "deactivated") throw new ApiError("Your account has been deactivated by your company.", 403, "account_deactivated")
    if (e.status === "active") throw new ApiError("You already have an account. Sign in instead.", 409, "account_exists", { email: "Account already exists — sign in instead" })
    e.status = "registered"
    e.joinedAt = e.joinedAt ?? new Date().toISOString()
    e.lastActiveAt = new Date().toISOString()
    save()
    return { ...buildEmployeeSession(db, e), onboardingCompleted: false }
  }),
}
