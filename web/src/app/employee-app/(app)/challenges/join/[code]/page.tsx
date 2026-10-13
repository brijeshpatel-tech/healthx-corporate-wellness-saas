"use client"

import { ArrowLeft, BarChart3, KeyRound, SearchX, Sparkles, UsersRound } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/common/misc"
import { EmptyState } from "@/components/common/states"
import { JoinWithCodeDialog, PrizesCard } from "@/components/employee/engage/challenge-extras"
import { ChallengeHero, targetText } from "@/components/employee/engage/challenge-ui"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { challengesApi } from "@/lib/api/employee/challenges"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"

/** #356 — join a challenge from a QR code, short code or shared link. */
export default function JoinByCodePage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const [retry, setRetry] = useState(false)
  const lookup = useApiQuery(["employee", "challenge-code", code], () => challengesApi.resolveJoinCode({ code }))
  const challengeId = lookup.data?.challengeId
  const detail = useApiQuery(["employee", "challenge", challengeId], () => challengesApi.detail({ id: challengeId! }), { enabled: !!challengeId })
  const [confirm, setConfirm] = useState(false)
  const join = useApiMutation(challengesApi.join, {
    onSuccess: () => {
      toast.success("You've joined! Your progress starts counting now.")
      router.push(`/employee-app/challenges/${challengeId}`)
    },
  })
  const c = detail.data

  return (
    <EngagePage size="narrow">
      <Link href="/employee-app/challenges" className="-mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Challenges
      </Link>

      {lookup.error ? (
        lookup.error.status === 404 || lookup.error.status === 422 || lookup.error.status === 403 ? (
          <EmptyState
            icon={SearchX}
            title={lookup.error.status === 403 ? "You're not eligible for this challenge." : "We couldn't find a challenge with that code."}
            description={lookup.error.status === 403 ? "It's open to a different department or team." : `Code “${decodeURIComponent(code).toUpperCase()}” — check it and try again.`}
            action={
              <Button onClick={() => setRetry(true)}>
                <KeyRound data-icon="inline-start" /> Enter another code
              </Button>
            }
          />
        ) : (
          <LoadError title="Couldn't check this code." error={lookup.error} onRetry={() => lookup.refetch()} />
        )
      ) : detail.error ? (
        <LoadError title="Couldn't load this challenge." error={detail.error} onRetry={() => detail.refetch()} />
      ) : !c ? (
        <>
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <KeyRound className="size-4 text-primary" /> Code <span className="font-mono font-semibold text-foreground">{decodeURIComponent(code).toUpperCase()}</span> found
          </p>
          <ChallengeHero c={c} subtitle={`${formatDate(c.startDate, "d MMM")} – ${formatDate(c.endDate, "d MMM yyyy")}`} />
          <Card className="gap-0 py-0">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <p className="text-[15px] leading-relaxed">{c.description}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{targetText(c)}</span>
                <span className="inline-flex items-center gap-1">
                  <UsersRound className="size-4" /> {formatNumber(c.participantsCount)} joined
                </span>
                <span>+{c.points} points</span>
              </div>
              {c.joined ? (
                <Button asChild size="lg" className="h-12 w-full rounded-xl">
                  <Link href={`/employee-app/challenges/${c.id}/progress`}>
                    <BarChart3 data-icon="inline-start" /> You&apos;ve already joined — view progress
                  </Link>
                </Button>
              ) : c.canJoin ? (
                <Button size="lg" className="h-12 w-full rounded-xl text-base font-semibold" disabled={join.isPending} onClick={() => setConfirm(true)}>
                  {join.isPending ? <Spinner /> : <Sparkles data-icon="inline-start" />} Join challenge
                </Button>
              ) : (
                <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">{c.joinBlockedReason}</p>
              )}
              <Button asChild variant="ghost" className="w-full">
                <Link href={`/employee-app/challenges/${c.id}`}>See full details & rules</Link>
              </Button>
            </CardContent>
          </Card>
          {c.prizes ? <PrizesCard prizes={c.prizes} /> : null}
          <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={`Join ${c.name}?`} description="Your progress starts counting from today. Activity from before you join doesn't count." confirmLabel="Join challenge" onConfirm={() => join.mutate({ id: c.id })} />
        </>
      )}

      <JoinWithCodeDialog open={retry} onOpenChange={setRetry} />
    </EngagePage>
  )
}
