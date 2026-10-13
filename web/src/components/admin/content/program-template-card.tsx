"use client"

import { Archive, Building2, CalendarRange, Copy, Eye, MoreHorizontal, Pencil, RotateCcw, Send, Target } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { ConfirmDialog, InlineBar } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useApiMutation } from "@/lib/api/hooks"
import { programTemplatesApi, type ProgramTemplateRow } from "@/lib/api/platform/programs"
import { formatNumber, formatPercent, pluralize } from "@/lib/format"
import { TEMPLATE_STATUS_LABEL } from "./meta"

/** Program template card: cover, weeks / goals, company usage and average completion. */
export function ProgramTemplateCard({ template: t }: { template: ProgramTemplateRow }) {
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const [confirmRetire, setConfirmRetire] = useState(false)
  const publish = useApiMutation(programTemplatesApi.update, { success: "Template published.", errorTitle: "Couldn't save template." })
  const retire = useApiMutation(programTemplatesApi.update, { success: (r) => `“${r.name}” retired. Companies can no longer copy it.`, errorTitle: "Couldn't save template." })
  const duplicate = useApiMutation(programTemplatesApi.duplicate, { success: (r) => `Copied as “${r.name}” (draft).`, errorTitle: "Couldn't save template." })

  return (
    <Card className="group relative gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <div className="relative flex h-24 items-end justify-between px-4 pb-3" style={{ background: `linear-gradient(135deg, ${t.coverColor}, ${t.coverColor}b3)` }}>
        <span className="text-4xl leading-none drop-shadow-sm" aria-hidden>
          {t.coverEmoji}
        </span>
        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">{pluralize(t.durationWeeks, "week")}</span>
        <div className="absolute top-2.5 right-2.5 rounded-full bg-background/90 shadow-sm">
          <StatusBadge status={t.status} label={TEMPLATE_STATUS_LABEL[t.status]} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/admin-portal/program-templates/${t.id}`} className="line-clamp-1 font-heading font-semibold after:absolute after:inset-0 hover:underline">
              {t.name}
            </Link>
            <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{t.description || "No description yet."}</p>
          </div>
          <div className="relative z-10 -mt-1 -mr-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/admin-portal/program-templates/${t.id}`}>
                    {manage ? <Pencil /> : <Eye />} {manage ? "Edit" : "View"}
                  </Link>
                </DropdownMenuItem>
                {manage ? (
                  <>
                    {t.status !== "active" ? (
                      <DropdownMenuItem onClick={() => publish.mutate({ id: t.id, status: "active" })}>
                        {t.status === "archived" ? <RotateCcw /> : <Send />} {t.status === "archived" ? "Republish" : "Publish"}
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => duplicate.mutate({ id: t.id })}>
                      <Copy /> Duplicate
                    </DropdownMenuItem>
                    {t.status !== "archived" ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setConfirmRetire(true)}>
                          <Archive /> Retire
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange className="size-3.5" /> {pluralize(t.durationWeeks, "week")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Target className="size-3.5" /> {pluralize(t.goalsCount, "goal")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-3.5" /> {t.companiesUsing ? `Used by ${pluralize(t.companiesUsing, "company", "companies")}` : "Not used yet"}
          </span>
        </div>

        <div className="mt-auto space-y-1.5 border-t pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Avg completion · <span className="tabular-nums">{formatNumber(t.enrolledCount)}</span> enrolled
            </span>
            <span className="font-medium tabular-nums">{t.enrolledCount ? formatPercent(t.avgCompletion) : "—"}</span>
          </div>
          <InlineBar value={t.avgCompletion} max={1} color={t.coverColor} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmRetire}
        onOpenChange={setConfirmRetire}
        destructive
        title={`Retire “${t.name}”?`}
        description={
          t.companiesUsing
            ? `Companies can no longer copy it. The ${pluralize(t.companiesUsing, "company", "companies")} already running a program based on it keep their copy.`
            : "Companies can no longer copy it. You can republish it later."
        }
        confirmLabel="Retire template"
        onConfirm={() => {
          retire.mutate({ id: t.id, status: "archived" })
          setConfirmRetire(false)
        }}
      />
    </Card>
  )
}
