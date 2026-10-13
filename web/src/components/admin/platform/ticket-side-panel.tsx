"use client"

import { Building2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { FieldShell } from "@/components/common/form-fields"
import { ConfirmDialog, KeyValueList, SectionCard } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { UserAvatar } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApiMutation } from "@/lib/api/hooks"
import { REQUESTER_TYPE_LABEL, supportApi, TICKET_CATEGORY_LABEL, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, type TicketDetail, type TicketPriority, type TicketStatus } from "@/lib/api/platform/support"
import { formatDate, formatDateTime, formatNumber, formatRelative } from "@/lib/format"

/** Status / priority / assignee controls and company info for a ticket. */
export function TicketSidePanel({ ticket, canManage }: { ticket: TicketDetail; canManage: boolean }) {
  const [confirmClose, setConfirmClose] = useState(false)
  const update = useApiMutation(supportApi.update, { success: "Ticket updated." })
  const busy = update.isPending || !canManage

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Ticket">
        <div className="flex flex-col gap-4">
          <FieldShell id="ticket-status" label="Status">
            <Select
              value={ticket.status}
              disabled={busy}
              onValueChange={(v) => (v === "closed" ? setConfirmClose(true) : update.mutate({ id: ticket.id, status: v as TicketStatus }))}
            >
              <SelectTrigger id="ticket-status" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    <StatusBadge status={s} label={TICKET_STATUS_LABEL[s]} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
          <FieldShell id="ticket-priority" label="Priority">
            <Select value={ticket.priority} disabled={busy} onValueChange={(v) => update.mutate({ id: ticket.id, priority: v as TicketPriority })}>
              <SelectTrigger id="ticket-priority" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TICKET_PRIORITY_LABEL) as TicketPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    <StatusBadge status={p} label={TICKET_PRIORITY_LABEL[p]} dot={false} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
          <FieldShell id="ticket-assignee" label="Assigned to">
            <Select value={ticket.assignee?.id ?? "none"} disabled={busy} onValueChange={(v) => update.mutate({ id: ticket.id, assigneeId: v === "none" ? null : v })}>
              <SelectTrigger id="ticket-assignee" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {ticket.assignable.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <UserAvatar name={a.name} color={a.avatarColor} size="xs" />
                    {a.name}
                    <span className="text-xs text-muted-foreground">{a.role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
          <KeyValueList
            columns={1}
            className="border-t pt-4"
            items={[
              { label: "Category", value: TICKET_CATEGORY_LABEL[ticket.category] },
              { label: "Requester", value: `${ticket.requester} · ${REQUESTER_TYPE_LABEL[ticket.requesterType]}` },
              { label: "Opened", value: <span title={formatDateTime(ticket.createdAt)}>{formatDateTime(ticket.createdAt)}</span> },
              { label: "Last update", value: formatRelative(ticket.updatedAt) },
              { label: "First response", value: ticket.firstResponseHours === null ? "Not yet replied" : `${formatNumber(ticket.firstResponseHours, 1)} h after opening` },
            ]}
          />
        </div>
      </SectionCard>

      {ticket.company ? (
        <SectionCard title="Company">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium">{ticket.company.name}</div>
                <div className="text-xs text-muted-foreground">{ticket.company.city}</div>
              </div>
            </div>
            <KeyValueList
              items={[
                { label: "Plan", value: ticket.company.planName },
                { label: "Status", value: <StatusBadge status={ticket.company.status} /> },
                { label: "Employees", value: formatNumber(ticket.company.employeeCount) },
                { label: "Customer since", value: formatDate(ticket.company.createdAt) },
              ]}
            />
            <div className="min-w-0 space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Company owner</div>
              <div className="text-sm font-medium">{ticket.company.ownerName}</div>
              <a href={`mailto:${ticket.company.ownerEmail}`} className="block truncate text-xs text-primary hover:underline">
                {ticket.company.ownerEmail}
              </a>
            </div>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href={`/admin-portal/companies/${ticket.company.id}`}>
                Open company <ExternalLink data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={`Close ${ticket.number}?`}
        description="The requester can no longer reply to a closed ticket. You can reopen it later if needed."
        confirmLabel="Close ticket"
        onConfirm={() => {
          update.mutate({ id: ticket.id, status: "closed" })
          setConfirmClose(false)
        }}
      />
    </div>
  )
}
