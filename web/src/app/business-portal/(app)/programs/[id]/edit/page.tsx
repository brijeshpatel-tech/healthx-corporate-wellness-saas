"use client"

import { Eye, Lock } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { PrefillNotice } from "@/components/business/engagement/announcements/prefill-notice"
import { ProgramForm, valuesFromProgram } from "@/components/business/engagement/programs/program-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState, PageSkeleton, QueryState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { programsApi } from "@/lib/api/business/programs"
import { useApiQuery } from "@/lib/api/hooks"

export default function EditProgramPage() {
  const { id } = useParams<{ id: string }>()
  const detail = useApiQuery(["business", "programs", "detail", id], () => programsApi.get({ id }), { refetchOnWindowFocus: false })

  return (
    <PageContainer>
      <PageHeader
        title="Edit program"
        badge={
          <>
            <PhaseBadge phase={2} />
            {detail.data ? <StatusBadge status={detail.data.status} /> : null}
          </>
        }
        description={detail.data?.name}
        backHref={`/business-portal/programs/${id}`}
        backLabel="Back to program"
      />
      <QueryState query={detail} loading={<PageSkeleton kpis={0} />}>
        {(p) =>
          !p.canEdit ? (
            <EmptyState
              icon={Lock}
              title={`This program is ${p.status} and can't be edited`}
              description="Its results stay available on the program page."
              action={
                <Button asChild variant="outline">
                  <Link href={`/business-portal/programs/${p.id}`}>
                    <Eye data-icon="inline-start" /> View program
                  </Link>
                </Button>
              }
            />
          ) : (
            <ProgramForm
              key={p.id}
              program={p}
              initial={valuesFromProgram(p)}
              notice={
                p.status === "active" ? (
                  <PrefillNotice>The program is running, so the start date, weeks and audience are locked. You can still change the name, description, cover, points and combined challenge.</PrefillNotice>
                ) : p.status === "scheduled" ? (
                  <PrefillNotice>This program is scheduled. Enrolled employees see your changes straight away.</PrefillNotice>
                ) : null
              }
            />
          )
        }
      </QueryState>
    </PageContainer>
  )
}
