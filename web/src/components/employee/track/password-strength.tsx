import { cn } from "@/lib/utils"

/** 0–4 score: length, letters + numbers, mixed case, symbol. */
export function passwordScore(pw: string) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++
  return s
}

const LABEL = ["Too short", "Weak", "Fair", "Good", "Strong"]
const COLOR = ["bg-rose-500", "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"]

export function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password)
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors", password && i < Math.max(1, score) && COLOR[score])} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {password ? <span className="font-medium text-foreground">{LABEL[score]}</span> : "Use at least 8 characters with letters and numbers"}
        {password && score < 3 ? " · add numbers, capitals or a symbol" : ""}
      </p>
    </div>
  )
}

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
