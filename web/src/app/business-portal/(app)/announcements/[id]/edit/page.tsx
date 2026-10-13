"use client"

import { Copy, Eye, Lock } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AnnouncementForm, PrefillNotice, valuesFromAnnouncement } from "@/components/business/engagement/announcements/announcement-form"
import { formatSchedule } from "@/components/business/engagement/announcements/announcement-meta"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { EmptyState, PageSkeleton, QueryState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { announcementsApi } from "@/lib/api/business/announcements"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"

export default function EditAnnouncementPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const detail = useApiQuery(["business", "announcements", "detail", id], () => announcementsApi.get({ id }), { refetchOnWindowFocus: false })
  const duplicate = useApiMutation(announcementsApi.duplicate, {
    success: "Copy created as a draft",
    onSuccess: (a) => router.push(`/business-portal/announcements/${a.id}/edit`),
  })

  return (
    <PageContainer>
      <PageHeader
        title="Edit announcement"
        badge={detail.data ? <StatusBadge status={detail.data.status} /> : null}
        description={detail.data?.title}
        backHref={`/business-portal/announcements/${id}`}
        backLabel="Back to announcement"
      />
      <QueryState query={detail} loading={<PageSkeleton kpis={0} />}>
        {(a) =>
          !a.canEdit ? (
            <EmptyState
              icon={Lock}
              title="Sent announcements can't be edited"
              description="Employees already have this message. Duplicate it to send an updated version."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/business-portal/announcements/${a.id}`}>
                      <Eye data-icon="inline-start" /> View announcement
                    </Link>
                  </Button>
                  <Button onClick={() => duplicate.mutate({ id: a.id })} disabled={duplicate.isPending}>
                    {duplicate.isPending ? <Spinner /> : <Copy data-icon="inline-start" />}
                    Duplicate
                  </Button>
                </div>
              }
            />
          ) : (
            <AnnouncementForm
              key={a.id}
              initial={valuesFromAnnouncement(a)}
              announcementId={a.id}
              notice={
                a.status === "scheduled" ? (
                  <PrefillNotice>
                    Scheduled for <strong>{formatSchedule(a.scheduledAt)}</strong>. Saving keeps it scheduled — choose <em>Save draft</em> to stop it from being sent.
                  </PrefillNotice>
                ) : null
              }
            />
          )
        }
      </QueryState>
    </PageContainer>
  )
}
