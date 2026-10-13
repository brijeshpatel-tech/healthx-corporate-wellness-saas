"use client"

import { UserMinus } from "lucide-react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"

const REASONS = ["Left the company", "Extended leave", "Duplicate account", "Other"] as const

/** Deactivate with a recorded reason (blocks sign-in; points stay on record). */
export function DeactivateEmployeeDialog({
  name,
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
  pending?: boolean
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState<string>(REASONS[0])
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They&apos;ll be signed out everywhere and can no longer sign in to HealthX. Their points and history stay on record, and you can reactivate them later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Reason</Label>
          <RadioGroup value={reason} onValueChange={setReason} className="grid gap-2 sm:grid-cols-2">
            {REASONS.map((r) => (
              <Label key={r} htmlFor={`reason-${r}`} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem id={`reason-${r}`} value={r} />
                {r}
              </Label>
            ))}
          </RadioGroup>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" className="bg-destructive text-white hover:bg-destructive/90" disabled={pending} onClick={() => onConfirm(reason)}>
            {pending ? <Spinner /> : <UserMinus data-icon="inline-start" />}
            Deactivate
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
