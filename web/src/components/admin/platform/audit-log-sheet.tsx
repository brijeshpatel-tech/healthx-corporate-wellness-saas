"use client"

import { Lock } from "lucide-react"
import { useState } from "react"
import { KeyValueList } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { AuditRow } from "@/lib/api/platform/audit"
import { formatDateTime, formatRelative } from "@/lib/format"

/** Read-only detail drawer for one audit entry (SCR-P-025). */
export function AuditLogSheet({ entry: current, onOpenChange }: { entry: AuditRow | null; onOpenChange: (open: boolean) => void }) {
  // Keep showing the last entry while the drawer animates closed.
  const [last, setLast] = useState(current)
  if (current && current !== last) setLast(current)
  const entry = current ?? last
  return (
    <Sheet open={!!current} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl">
        {entry ? (
          <>
            <SheetHeader className="border-b p-6 pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={entry.severity} />
                {entry.personalData ? <StatusBadge status="personal" tone="violet" label="Personal data access" dot={false} className="gap-1" /> : null}
                <span className="text-xs text-muted-foreground">{formatRelative(entry.createdAt)}</span>
              </div>
              <SheetTitle className="font-heading text-lg">{entry.action}</SheetTitle>
              <SheetDescription>
                {entry.entityType}: {entry.entityName}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-6 p-6">
              <KeyValueList
                items={[
                  { label: "Date & time", value: formatDateTime(entry.createdAt) },
                  { label: "Timestamp (UTC)", value: <span className="font-mono text-xs">{entry.createdAt}</span> },
                  { label: "Company", value: entry.companyName },
                  { label: "Portal", value: entry.portal },
                  { label: "Actor", value: entry.actorName },
                  { label: "Actor role", value: entry.actorRole },
                  { label: "Action", value: entry.action },
                  { label: "Severity", value: <StatusBadge status={entry.severity} /> },
                  { label: "Target type", value: entry.entityType },
                  { label: "Target", value: entry.entityName },
                  { label: "IP address", value: <span className="font-mono text-xs">{entry.ip}</span> },
                  { label: "Entry ID", value: <span className="font-mono text-xs break-all">{entry.id}</span> },
                ]}
              />
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">Details</h3>
                {entry.details ? (
                  <pre className="rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">{entry.details}</pre>
                ) : (
                  <p className="text-sm text-muted-foreground">No additional details were recorded for this action.</p>
                )}
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" />
                <p>
                  <span className="font-semibold text-foreground">Immutable record.</span> Audit entries can&apos;t be edited or deleted by anyone, including Super Admins.
                  {entry.personalData ? " This entry is part of the personal-data access log." : ""}
                </p>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
