import { CheckCircle2, Clock, XCircle } from "lucide-react"
import type { ReviewStatus } from "@/lib/api/employee/activity"
import type { ActivitySession } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Source label for an activity; manual entries show their HR approval status (#365). */
export function SourceBadge({ session, review, className }: { session: ActivitySession; review?: ReviewStatus; className?: string }) {
  const base = "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
  if (session.source !== "manual") return <span className={cn(base, "bg-muted text-muted-foreground", className)}>{session.source === "workout" ? "Workout" : "Synced"}</span>
  if (review?.status === "approved")
    return (
      <span className={cn(base, "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300", className)}>
        <CheckCircle2 className="size-3" /> Approved{review.points ? ` · +${review.points}` : ""}
      </span>
    )
  if (review?.status === "rejected")
    return (
      <span className={cn(base, "bg-rose-500/12 text-rose-700 dark:text-rose-300", className)}>
        <XCircle className="size-3" /> Rejected
      </span>
    )
  return (
    <span className={cn(base, "bg-amber-500/12 text-amber-700 dark:text-amber-300", className)}>
      <Clock className="size-3" /> {review ? "Pending approval" : "Manual"}
    </span>
  )
}

/** Explains the approval state in the activity detail sheet. */
export function ReviewNote({ review }: { review?: ReviewStatus | null }) {
  if (!review) return null
  const tone =
    review.status === "approved"
      ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-900 dark:text-emerald-200"
      : review.status === "rejected"
        ? "border-rose-500/30 bg-rose-500/8 text-rose-900 dark:text-rose-200"
        : "border-amber-500/30 bg-amber-500/8 text-amber-900 dark:text-amber-200"
  return (
    <div className={cn("rounded-xl border px-3.5 py-2.5 text-xs", tone)}>
      {review.status === "approved" ? (
        <p>
          <strong>Approved by HR.</strong> {review.points ? `+${review.points} points were added to your wallet.` : "It counts towards your totals (manual entries don't earn points at your company)."}
        </p>
      ) : review.status === "rejected" ? (
        <p>
          <strong>Not approved by HR.</strong> {review.reason ? `Reason: ${review.reason}` : "No points were added."} You can edit it and send it again.
        </p>
      ) : (
        <p>
          <strong>Pending approval.</strong> {review.points ? `Your HR team will review it — +${review.points} points will be added if approved.` : "Your HR team will review it. Manual entries don't earn points at your company."}
        </p>
      )}
    </div>
  )
}
