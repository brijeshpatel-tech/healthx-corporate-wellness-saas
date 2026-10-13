"use client"

import { ArrowLeft, MessageSquareText, Smartphone } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { employeeAuthApi } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"

const COUNTRIES = [
  { code: "+91", flag: "🇮🇳", name: "India", pattern: /^[6-9]\d{9}$/, example: "98765 43210" },
  { code: "+971", flag: "🇦🇪", name: "UAE", pattern: /^5\d{8}$/, example: "50 123 4567" },
  { code: "+65", flag: "🇸🇬", name: "Singapore", pattern: /^[89]\d{7}$/, example: "8123 4567" },
  { code: "+44", flag: "🇬🇧", name: "United Kingdom", pattern: /^7\d{9}$/, example: "7400 123456" },
  { code: "+1", flag: "🇺🇸", name: "United States", pattern: /^[2-9]\d{9}$/, example: "201 555 0123" },
]

/** SCR-M-007 Phone Sign-in. */
export default function PhoneSignInPage() {
  const router = useRouter()
  const [cc, setCc] = useState("+91")
  const [number, setNumber] = useState("")
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const country = COUNTRIES.find((c) => c.code === cc)!
  const digits = number.replace(/\D/g, "")
  const valid = country.pattern.test(digits)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const phone = `${cc}${digits}`
      await employeeAuthApi.sendOtp({ phone })
      const masked = `${cc} •••••${digits.slice(-5)}`
      toast.success(`Code sent to ${masked}`)
      try {
        sessionStorage.setItem("healthx.otp", JSON.stringify({ phone, sentAt: Date.now(), resends: 0 }))
      } catch {
        // storage unavailable — the verify screen still works
      }
      router.push(`/employee-app/verify?phone=${encodeURIComponent(phone)}&to=${encodeURIComponent(masked)}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <EmployeeAuthLayout>
      <div className="flex flex-1 flex-col gap-7">
        <div className="space-y-3">
          <Link href="/employee-app/sign-in" className="-ml-1 inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back
          </Link>
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/25">
            <Smartphone className="size-7" />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Sign in with your phone</h1>
          <p className="text-muted-foreground">We&apos;ll text you a 6-digit code to confirm it&apos;s you.</p>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile number</Label>
            <div className="flex gap-2">
              <Select value={cc} onValueChange={setCc}>
                <SelectTrigger className="h-11 w-28 shrink-0 text-base" aria-label="Country code">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.code} <span className="text-muted-foreground">{c.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder={country.example}
                className="h-11 text-base"
                aria-invalid={touched && !valid}
                autoFocus
              />
            </div>
            {touched && !valid ? <p className="text-xs font-medium text-destructive">Enter a valid mobile number.</p> : null}
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <MessageSquareText className="mt-0.5 size-3.5 shrink-0" /> By continuing you agree to receive a one-time SMS. Standard message rates may apply.
          </p>
          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            {busy ? <Spinner /> : null} Send code
          </Button>
        </form>

        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link href="/employee-app/sign-in">Use another method</Link>
        </Button>

        {env.useMock ? (
          <p className="mt-auto rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            Demo: any valid number signs you in as Priya. Code <span className="font-mono font-semibold text-foreground">123456</span> works, <span className="font-mono">000000</span> is wrong.
          </p>
        ) : null}
      </div>
    </EmployeeAuthLayout>
  )
}
