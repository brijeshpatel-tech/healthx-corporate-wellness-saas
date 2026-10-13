"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { AnnouncementForm, PrefillNotice, emptyAnnouncementValues, type AnnouncementFormValues } from "@/components/business/engagement/announcements/announcement-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PageSkeleton } from "@/components/common/states"
import { challengesApi, type ChallengeDetail } from "@/lib/api/business/challenges"
import { programsApi, type ProgramDetail } from "@/lib/api/business/programs"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

function fromChallenge(c: ChallengeDetail): AnnouncementFormValues {
  const title =
    c.status === "active" ? `${c.name} is live! ${c.coverEmoji}` : c.status === "scheduled" ? `${c.name} starts ${formatDate(c.startDate, "EEE d MMM")} ${c.coverEmoji}` : `Get ready: ${c.name} ${c.coverEmoji}`
  const prize = [c.points ? `${formatNumber(c.points)} points` : "", c.rewardName ?? ""].filter(Boolean).join(" and ")
  const body = [
    c.description?.trim(),
    `It runs from ${formatDate(c.startDate, "d MMM")} to ${formatDate(c.endDate, "d MMM")}${prize ? ` — finish it to earn ${prize}` : ""}.`,
    "Open the HealthX app and tap Join to take part.",
  ]
    .filter(Boolean)
    .join("\n\n")
  return {
    ...emptyAnnouncementValues(),
    type: "challenge",
    title: clip(title, 80),
    body: clip(body, 1000),
    audienceType: c.audienceType,
    audienceIds: c.audienceIds,
    linkLabel: "View challenge",
    linkHref: `/employee-app/challenges/${c.id}`,
  }
}

function fromProgram(p: ProgramDetail): AnnouncementFormValues {
  const when = p.status === "active" ? "It's running now" : p.startDate ? `It starts ${formatDate(p.startDate, "EEE d MMM")}` : "It starts soon"
  const body = [
    p.description?.trim(),
    `${when}: ${p.durationWeeks} ${p.durationWeeks === 1 ? "week" : "weeks"} of simple weekly goals${p.completionPoints ? `, and ${formatNumber(p.completionPoints)} points when you finish` : ""}.`,
    "Enrol from the Programs tab in the HealthX app.",
  ]
    .filter(Boolean)
    .join("\n\n")
  return {
    ...emptyAnnouncementValues(),
    type: "general",
    title: clip(`Join ${p.name} ${p.coverEmoji}`, 80),
    body: clip(body, 1000),
    audienceType: p.audienceType,
    audienceIds: p.audienceIds,
    linkLabel: "View program",
    linkHref: `/employee-app/programs/${p.id}`,
  }
}

function NewAnnouncement() {
  const params = useSearchParams()
  const challengeId = params.get("challengeId")
  const programId = params.get("programId")
  const challenge = useApiQuery(["business", "announcements", "prefill", "challenge", challengeId], () => challengesApi.get({ id: challengeId! }), { enabled: !!challengeId, retry: false })
  const program = useApiQuery(["business", "announcements", "prefill", "program", programId], () => programsApi.get({ id: programId! }), { enabled: !!programId, retry: false })
  const loading = (!!challengeId && challenge.isLoading) || (!!programId && program.isLoading)

  let initial = emptyAnnouncementValues()
  let notice: React.ReactNode = null
  if (challengeId && challenge.data) {
    initial = fromChallenge(challenge.data)
    notice = (
      <PrefillNotice>
        Pre-filled from the challenge <strong>{challenge.data.name}</strong>. Review the message and audience, then send it.
      </PrefillNotice>
    )
  } else if (programId && program.data) {
    initial = fromProgram(program.data)
    notice = (
      <PrefillNotice>
        Pre-filled from the program <strong>{program.data.name}</strong>. Review the message and audience, then send it.
      </PrefillNotice>
    )
  } else if ((challengeId && challenge.error) || (programId && program.error)) {
    notice = <PrefillNotice>We couldn&apos;t load what you came from, so the form starts empty.</PrefillNotice>
  }

  return (
    <PageContainer>
      <PageHeader
        title="New announcement"
        description="Compose a message for your employees. Preview it on the right exactly as they'll see it."
        backHref="/business-portal/announcements"
        backLabel="Announcements"
      />
      {loading ? <PageSkeleton kpis={0} /> : <AnnouncementForm key={challengeId ?? programId ?? "blank"} initial={initial} notice={notice} />}
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <NewAnnouncement />
    </Suspense>
  )
}
