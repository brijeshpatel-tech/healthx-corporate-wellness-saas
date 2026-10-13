"use client"

import { REGEXP_ONLY_DIGITS } from "input-otp"
import { MailCheck, Smartphone } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { ApiError } from "@/lib/api/core"
import { errorMessage } from "@/lib/api/hooks"
import { DEMO_CODE } from "@/lib/mock/demo-accounts"
import { IconTile } from "../page"

/**
 * One-time-code dialog (email / phone verification, re-authentication).
 * Mount it with a `key` per request so it starts empty each time.
 */
export function VerifyCodeDialog({
  open,
  onOpenChange,
  channel,
  title,
  sentTo,
  onVerify,
  onResend,
  confirmLabel = "Verify",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel: "email" | "phone"
  title: string
  sentTo: string
  /** Throw (ApiError) to show the message under the code. */
  onVerify: (code: string) => Promise<void>
  onResend?: () => Promise<void>
  confirmLabel?: string
}) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)

  const submit = async (value = code) => {
    if (value.length !== 6) {
      setError("Enter the 6-digit code.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onVerify(value)
    } catch (err) {
      setError(err instanceof ApiError && err.fieldErrors?.code ? err.fieldErrors.code : errorMessage(err))
      setCode("")
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (!onResend) return
    setError(null)
    try {
      await onResend()
      setResent(true)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <IconTile icon={channel === "email" ? MailCheck : Smartphone} tone="emerald" size="lg" className="mb-1" />
          <DialogTitle className="font-heading text-lg">{title}</DialogTitle>
          <DialogDescription>
            We sent a 6-digit code to <span className="font-medium text-foreground">{sentTo}</span>. It expires in 10 minutes.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={(v) => {
              setCode(v)
              if (error) setError(null)
            }}
            onComplete={(v: string) => void submit(v)}
            autoFocus
            aria-label="6-digit code"
            aria-invalid={!!error}
            disabled={busy}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} aria-invalid={!!error} className="size-11 text-lg font-semibold sm:size-12" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <div className="min-h-5 text-center text-xs" aria-live="polite">
            {error ? (
              <p className="font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : resent ? (
              <p className="text-muted-foreground">We sent a new code.</p>
            ) : env.useMock ? (
              <p className="text-muted-foreground">
                Demo: use <span className="font-mono font-semibold text-foreground">{DEMO_CODE}</span> (000000 = wrong code)
              </p>
            ) : null}
          </div>
          {onResend ? (
            <Button type="button" variant="link" size="sm" onClick={resend} disabled={busy}>
              Didn&apos;t get it? Send a new code
            </Button>
          ) : null}
        </form>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button className="h-11 rounded-xl" onClick={() => void submit()} disabled={busy || code.length !== 6}>
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
