"use client"

import { useParams } from "next/navigation"
import { TicketComposer, TicketConversation } from "@/components/admin/platform/ticket-conversation"
import { TicketSidePanel } from "@/components/admin/platform/ticket-side-panel"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { QueryState } from "@/components/common/states"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiQuery } from "@/lib/api/hooks"
import { REQUESTER_TYPE_LABEL, supportApi, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL } from "@/lib/api/platform/support"
import { formatDate } from "@/lib/format"

/** SCR-P-030 Support — ticket detail with conversation and internal notes. */
export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const can = useAdminCan()
  const canManage = can("support.manage")
  const ticket = useApiQuery(["admin", "support-ticket", id], () => supportApi.get({ id }))

  return (
    <PageContainer>
      <QueryState
        query={ticket}
        loading={
          <div className="flex flex-col gap-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-96 max-w-full" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <Skeleton className="h-96 rounded-xl lg:col-span-2" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
          </div>
        }
      >
        {(t) => (
          <>
            <PageHeader
              backHref="/admin-portal/support"
              backLabel="All tickets"
              title={t.subject}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{t.number}</span>
                  <StatusBadge status={t.status} label={TICKET_STATUS_LABEL[t.status]} />
                  <StatusBadge status={t.priority} label={`${TICKET_PRIORITY_LABEL[t.priority]} priority`} dot={false} />
                  <span>
                    Opened {formatDate(t.createdAt)} by {t.requester} ({REQUESTER_TYPE_LABEL[t.requesterType].toLowerCase()}) · {t.companyName}
                  </span>
                </span>
              }
            />
            <div className="grid items-start gap-6 lg:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
                <TicketConversation ticket={t} />
                <TicketComposer ticket={t} canReply={canManage} />
              </div>
              <TicketSidePanel ticket={t} canManage={canManage} />
            </div>
          </>
        )}
      </QueryState>
    </PageContainer>
  )
}
