"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Ban, Copy, Eye, Flag, Megaphone, MoreHorizontal, Pencil, Rocket, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { TextareaField } from "@/components/common/form-fields"
import { ConfirmDialog } from "@/components/common/misc"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { challengesApi, type ChallengeRow } from "@/lib/api/business/challenges"
import { useApiMutation } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatNumber } from "@/lib/format"

const cancelSchema = z.object({ reason: z.string().trim().min(5, "Tell participants why (at least 5 characters)").max(300, "Keep it under 300 characters") })

/** Cancel with a reason — participants are notified in the app. */
export function CancelChallengeDialog({
  challenge,
  open,
  onOpenChange,
  onDone,
}: {
  challenge: Pick<ChallengeRow, "id" | "name" | "participantsCount" | "status"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}) {
  const form = useForm<{ reason: string }>({ resolver: zodResolver(cancelSchema), defaultValues: { reason: "" } })
  useEffect(() => {
    if (!open) form.reset({ reason: "" })
  }, [open, form])
  const cancel = useApiMutation(challengesApi.cancel, {
    success: "Challenge cancelled – participants have been notified.",
    onSuccess: () => {
      onOpenChange(false)
      onDone?.()
    },
    onError: (err) => err.fieldErrors?.reason && form.setError("reason", { message: err.fieldErrors.reason }),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel “{challenge?.name}”?</DialogTitle>
          <DialogDescription>
            {challenge?.status === "active"
              ? `The challenge stops counting progress straight away and ${formatNumber(challenge?.participantsCount ?? 0)} participants are notified. This can't be undone.`
              : "The challenge won't start and everyone who was invited is notified. This can't be undone."}
          </DialogDescription>
        </DialogHeader>
        <form id="cancel-challenge" onSubmit={form.handleSubmit((v) => challenge && cancel.mutate({ id: challenge.id, reason: v.reason }))} noValidate>
          <TextareaField control={form.control} name="reason" label="Message to participants" placeholder="e.g. We're moving this challenge to next month because of the office move." rows={3} maxLength={300} required />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep challenge
          </Button>
          <Button type="submit" form="cancel-challenge" variant="destructive" disabled={cancel.isPending}>
            {cancel.isPending ? <Spinner /> : <Ban data-icon="inline-start" />}
            Cancel challenge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Row/card "…" menu for a challenge. Read-only roles only get "View". */
export function ChallengeActionsMenu({ challenge, align = "end" }: { challenge: ChallengeRow; align?: "start" | "end" }) {
  const can = useCan()
  const router = useRouter()
  const manage = can("challenges.manage")
  const [confirm, setConfirm] = useState<"delete" | "publish" | "end" | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  const publish = useApiMutation(challengesApi.publish, { success: (r) => r.message })
  const remove = useApiMutation(challengesApi.remove, { success: "Draft deleted" })
  const endEarly = useApiMutation(challengesApi.endEarly, { success: "Challenge ended – final results are in." })
  const duplicate = useApiMutation(challengesApi.duplicate, { success: "Copy created as a draft", onSuccess: (c) => router.push(`/business-portal/challenges/${c.id}/edit`) })

  // Fairness lock (#357): only drafts and scheduled challenges that haven't opened their warm-up can be edited.
  const editable = challenge.status === "draft" || (challenge.status === "scheduled" && !challenge.warmup)

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${challenge.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/business-portal/challenges/${challenge.id}`}>
              <Eye /> View details
            </Link>
          </DropdownMenuItem>
          {manage && editable ? (
            <DropdownMenuItem asChild>
              <Link href={`/business-portal/challenges/${challenge.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </DropdownMenuItem>
          ) : null}
          {manage && challenge.status === "draft" ? (
            <DropdownMenuItem onClick={() => setConfirm("publish")}>
              <Rocket /> Publish
            </DropdownMenuItem>
          ) : null}
          {manage ? (
            <DropdownMenuItem onClick={() => duplicate.mutate({ id: challenge.id })}>
              <Copy /> Duplicate <PhaseBadge phase={2} className="ml-auto" />
            </DropdownMenuItem>
          ) : null}
          {manage && (challenge.status === "active" || challenge.status === "scheduled") ? (
            <DropdownMenuItem asChild>
              <Link href={`/business-portal/announcements/new?challengeId=${challenge.id}`}>
                <Megaphone /> Send announcement
              </Link>
            </DropdownMenuItem>
          ) : null}
          {manage && (challenge.status === "active" || challenge.status === "scheduled" || challenge.status === "draft") ? <DropdownMenuSeparator /> : null}
          {manage && challenge.status === "active" ? (
            <DropdownMenuItem onClick={() => setConfirm("end")}>
              <Flag /> End early
            </DropdownMenuItem>
          ) : null}
          {manage && (challenge.status === "active" || challenge.status === "scheduled") ? (
            <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
              <Ban /> Cancel challenge
            </DropdownMenuItem>
          ) : null}
          {manage && challenge.status === "draft" ? (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")}>
              <Trash2 /> Delete draft
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ChallengeConfirmDialogs
        challenge={challenge}
        kind={confirm}
        onClose={() => setConfirm(null)}
        onConfirm={(kind) => {
          if (kind === "publish") publish.mutate({ id: challenge.id })
          if (kind === "delete") remove.mutate({ id: challenge.id })
          if (kind === "end") endEarly.mutate({ id: challenge.id })
          setConfirm(null)
        }}
      />
      <CancelChallengeDialog challenge={challenge} open={cancelOpen} onOpenChange={setCancelOpen} />
    </div>
  )
}

export function ChallengeConfirmDialogs({
  challenge,
  kind,
  onClose,
  onConfirm,
}: {
  challenge: Pick<ChallengeRow, "name" | "participantsCount" | "startDate" | "eligibleCount">
  kind: "delete" | "publish" | "end" | null
  onClose: () => void
  onConfirm: (kind: "delete" | "publish" | "end") => void
}) {
  const copy = {
    publish: {
      title: `Publish “${challenge.name}”?`,
      description: `${formatNumber(challenge.eligibleCount)} eligible employees will see it in the app and get a notification.`,
      label: "Publish",
      destructive: false,
    },
    delete: { title: `Delete “${challenge.name}”?`, description: "This draft will be removed permanently. Nobody has seen it yet.", label: "Delete draft", destructive: true },
    end: {
      title: `End “${challenge.name}” today?`,
      description: `Progress stops counting tonight and the leaderboard becomes final. ${formatNumber(challenge.participantsCount)} participants are notified, and points for completed goals are awarded as usual.`,
      label: "End challenge",
      destructive: true,
    },
  }
  const c = kind ? copy[kind] : null
  return (
    <ConfirmDialog
      open={!!kind}
      onOpenChange={(o) => !o && onClose()}
      title={c?.title ?? ""}
      description={c?.description}
      confirmLabel={c?.label}
      destructive={c?.destructive}
      onConfirm={() => kind && onConfirm(kind)}
    />
  )
}
