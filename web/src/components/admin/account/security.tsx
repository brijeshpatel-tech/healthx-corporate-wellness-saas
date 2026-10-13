"use client"

import { Check, Copy, Download, KeyRound, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { useApiMutation } from "@/lib/api/hooks"
import { accountApi } from "@/lib/api/platform/account"
import { downloadText } from "@/lib/download"
import { cn } from "@/lib/utils"

// ─── Password strength ──────────────────────────────────────────────────

export function passwordScore(pw: string, min = 10) {
  let score = 0
  if (pw.length >= min) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (pw.length >= min + 4) score++
  return Math.min(4, score)
}

const LEVELS = [
  { label: "Too weak", className: "bg-rose-500" },
  { label: "Weak", className: "bg-rose-500" },
  { label: "Fair", className: "bg-amber-500" },
  { label: "Good", className: "bg-emerald-500" },
  { label: "Strong", className: "bg-emerald-600" },
]

/** Four-segment strength meter with the requirements checklist. */
export function PasswordStrength({ password, min = 10 }: { password: string; min?: number }) {
  const score = passwordScore(password, min)
  const rules = [
    { ok: password.length >= min, label: `At least ${min} characters` },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), label: "Letters and a number" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "A symbol (recommended)" },
  ]
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-4 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("h-1.5 rounded-full bg-muted transition-colors", password && i < Math.max(1, score) && LEVELS[score]!.className)} />
          ))}
        </div>
        <span className="w-16 text-right text-xs font-medium text-muted-foreground">{password ? LEVELS[score]!.label : ""}</span>
      </div>
      <ul className="space-y-1">
        {rules.map((r) => (
          <li key={r.label} className={cn("flex items-center gap-1.5 text-xs", r.ok ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
            <Check className={cn("size-3.5", !r.ok && "opacity-30")} /> {r.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── OTP input ──────────────────────────────────────────────────────────

export function CodeInput({ value, onChange, disabled, onComplete }: { value: string; onChange: (v: string) => void; disabled?: boolean; onComplete?: (v: string) => void }) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={(v) => {
        onChange(v)
        if (v.length === 6) onComplete?.(v)
      }}
      disabled={disabled}
      autoFocus
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} className="size-10 text-base" />
        <InputOTPSlot index={1} className="size-10 text-base" />
        <InputOTPSlot index={2} className="size-10 text-base" />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} className="size-10 text-base" />
        <InputOTPSlot index={4} className="size-10 text-base" />
        <InputOTPSlot index={5} className="size-10 text-base" />
      </InputOTPGroup>
    </InputOTP>
  )
}

const DemoHint = () => (env.useMock ? <p className="text-xs text-muted-foreground">Demo: any 6 digits work (000000 simulates a wrong code).</p> : null)

// ─── Backup codes ───────────────────────────────────────────────────────

export function BackupCodesList({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-3 font-mono text-sm">
        {codes.map((c) => (
          <span key={c} className="rounded-md bg-background px-2 py-1 text-center tabular-nums">
            {c}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(codes.join("\n"))
              setCopied(true)
              toast.success("Backup codes copied")
            } catch {
              toast.error("Couldn't copy — select the codes and copy them manually.")
            }
          }}
        >
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />} Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => downloadText("healthx-admin-backup-codes.txt", `HealthX Platform Admin — backup codes\nEach code works once.\n\n${codes.join("\n")}\n`, "text/plain;charset=utf-8")}>
          <Download data-icon="inline-start" /> Download
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Store these somewhere safe. Each code can be used once if you lose access to your authenticator app.</p>
    </div>
  )
}

// ─── Authenticator setup ────────────────────────────────────────────────

/** Decorative QR-style pattern generated from the secret (the real app renders the otpauth URL as a QR code). */
function SecretPattern({ secret }: { secret: string }) {
  const size = 21
  const cells: boolean[] = []
  let h = 0
  for (let i = 0; i < size * size; i++) {
    h = (h * 31 + secret.charCodeAt(i % secret.length) + i) % 9973
    cells.push(h % 3 === 0)
  }
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7
    const ring = (ox: number, oy: number) => inBox(ox, oy) && (x === ox || x === ox + 6 || y === oy || y === oy + 6 || (x >= ox + 2 && x <= ox + 4 && y >= oy + 2 && y <= oy + 4))
    if (inBox(0, 0) || inBox(size - 7, 0) || inBox(0, size - 7)) return ring(0, 0) || ring(size - 7, 0) || ring(0, size - 7)
    return null
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="size-36 rounded-lg bg-white p-2" role="img" aria-label="Authenticator QR code">
      {Array.from({ length: size * size }).map((_, i) => {
        const x = i % size
        const y = Math.floor(i / size)
        const f = finder(x, y)
        const on = f === null ? cells[i] : f
        return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="#0f172a" /> : null
      })}
    </svg>
  )
}

export function MfaSetupDialog({ open, onOpenChange, reset }: { open: boolean; onOpenChange: (open: boolean) => void; reset?: boolean }) {
  const [step, setStep] = useState<"intro" | "scan" | "codes">("intro")
  const [secret, setSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null)
  const [code, setCode] = useState("")
  const [codes, setCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const close = (o: boolean) => {
    onOpenChange(o)
    if (!o) {
      setStep("intro")
      setSecret(null)
      setCode("")
      setCodes([])
      setError(null)
    }
  }
  const start = useApiMutation(accountApi.startMfaSetup, {
    invalidate: false,
    onSuccess: (s) => {
      setSecret(s)
      setStep("scan")
    },
  })
  const confirm = useApiMutation(accountApi.confirmMfa, {
    success: "Two-step verification is on.",
    onSuccess: (r) => {
      setCodes(r.backupCodes)
      setStep("codes")
    },
    onError: (e) => {
      setError(e.fieldErrors?.code ?? e.message)
      setCode("")
    },
  })

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "codes" ? "Save your backup codes" : reset ? "Reset authenticator app" : "Set up two-step verification"}</DialogTitle>
          <DialogDescription>
            {step === "intro"
              ? reset
                ? "Link a new authenticator app. Your old app stops working once you confirm."
                : "Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password."
              : step === "scan"
                ? "Scan the code with your authenticator app, then enter the 6-digit code it shows."
                : "You'll need one of these if you lose your phone."}
          </DialogDescription>
        </DialogHeader>

        {step === "intro" ? (
          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>Every sign-in to the Platform Admin portal asks for a code from your app. This keeps customer data safe even if your password leaks.</p>
          </div>
        ) : null}

        {step === "scan" && secret ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <SecretPattern secret={secret.secret} />
              <div className="min-w-0 space-y-1.5 text-sm">
                <p className="font-medium">Can&apos;t scan?</p>
                <p className="text-xs text-muted-foreground">Enter this setup key in your app:</p>
                <p className="rounded-md bg-muted px-2 py-1.5 font-mono text-xs break-all">{secret.secret.match(/.{1,4}/g)?.join(" ")}</p>
              </div>
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <CodeInput value={code} onChange={setCode} disabled={confirm.isPending} onComplete={(v) => confirm.mutate({ code: v })} />
              <DemoHint />
            </div>
          </div>
        ) : null}

        {step === "codes" ? <BackupCodesList codes={codes} /> : null}

        <DialogFooter>
          {step === "intro" ? (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={() => start.mutate()} disabled={start.isPending}>
                {start.isPending ? <Spinner /> : <KeyRound data-icon="inline-start" />} Continue
              </Button>
            </>
          ) : step === "scan" ? (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={() => confirm.mutate({ code })} disabled={code.length !== 6 || confirm.isPending}>
                {confirm.isPending ? <Spinner /> : null} Verify and turn on
              </Button>
            </>
          ) : (
            <Button onClick={() => close(false)}>I&apos;ve saved my codes</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BackupCodesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [code, setCode] = useState("")
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const close = (o: boolean) => {
    onOpenChange(o)
    if (!o) {
      setCode("")
      setCodes(null)
      setError(null)
    }
  }
  const regenerate = useApiMutation(accountApi.regenerateBackupCodes, {
    success: "New backup codes created — the old ones no longer work.",
    onSuccess: (r) => setCodes(r.backupCodes),
    onError: (e) => {
      setError(e.fieldErrors?.code ?? e.message)
      setCode("")
    },
  })
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{codes ? "Your new backup codes" : "Regenerate backup codes"}</DialogTitle>
          <DialogDescription>{codes ? "Your previous codes have stopped working." : "Confirm with a code from your authenticator app. Old codes will stop working."}</DialogDescription>
        </DialogHeader>
        {codes ? (
          <BackupCodesList codes={codes} />
        ) : (
          <div className="space-y-3">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <CodeInput value={code} onChange={setCode} disabled={regenerate.isPending} onComplete={(v) => regenerate.mutate({ code: v })} />
            <DemoHint />
          </div>
        )}
        <DialogFooter>
          {codes ? (
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={() => regenerate.mutate({ code })} disabled={code.length !== 6 || regenerate.isPending}>
                {regenerate.isPending ? <Spinner /> : null} Regenerate
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
