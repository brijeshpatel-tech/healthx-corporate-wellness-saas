"use client"

import { Archive, ArchiveRestore, Clock, ExternalLink, Eye, MoreHorizontal, Pencil, Rocket, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { ConfirmDialog } from "@/components/common/misc"
import { StatusBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { contentApi, type ContentRow } from "@/lib/api/business/content"
import { useApiMutation } from "@/lib/api/hooks"
import { formatDate, formatNumber, formatRelative } from "@/lib/format"
import { CATEGORY_META, CONTENT_TYPE_META } from "./content-meta"

type Confirm = "archive" | "delete" | null

/** Mutations + confirmations for one content item. */
export function useContentActions(row: ContentRow | null, opts: { onDone?: () => void } = {}) {
  const [confirm, setConfirm] = useState<Confirm>(null)
  const publish = useApiMutation(contentApi.publish, { success: "Content published.", onSuccess: () => opts.onDone?.() })
  const archive = useApiMutation(contentApi.archive, { success: "Content archived", onSuccess: () => opts.onDone?.() })
  const unarchive = useApiMutation(contentApi.unarchive, { success: "Content restored and published", onSuccess: () => opts.onDone?.() })
  const remove = useApiMutation(contentApi.remove, { success: "Draft deleted", onSuccess: () => opts.onDone?.() })
  const pending = publish.isPending || archive.isPending || unarchive.isPending || remove.isPending

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title="Archive this content?"
        description={`“${row?.title ?? ""}” is removed from employees' wellness feed. You can unarchive it later.`}
        confirmLabel="Archive"
        onConfirm={() => {
          if (row) archive.mutate({ id: row.id })
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title="Delete this draft?"
        description={`“${row?.title ?? ""}” will be removed permanently. This can't be undone.`}
        confirmLabel="Delete draft"
        onConfirm={() => {
          if (row) remove.mutate({ id: row.id })
          setConfirm(null)
        }}
      />
    </>
  )

  return {
    pending,
    dialogs,
    ask: setConfirm,
    publish: () => row && publish.mutate({ id: row.id }),
    unarchive: () => row && unarchive.mutate({ id: row.id }),
  }
}

/** Row "…" menu. HealthX (global) content only offers "View". */
export function ContentActionsMenu({ row, onView }: { row: ContentRow; onView: () => void }) {
  const actions = useContentActions(row)
  const own = row.source === "company"
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.title}`} disabled={actions.pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onView}>
            <Eye /> View
          </DropdownMenuItem>
          {own && row.canEdit ? (
            <DropdownMenuItem asChild>
              <Link href={`/business-portal/content/${row.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </DropdownMenuItem>
          ) : null}
          {own && row.canPublish ? (
            <DropdownMenuItem onClick={actions.publish}>
              <Rocket /> Publish
            </DropdownMenuItem>
          ) : null}
          {own && row.canUnarchive ? (
            <DropdownMenuItem onClick={actions.unarchive}>
              <ArchiveRestore /> Unarchive
            </DropdownMenuItem>
          ) : null}
          {own && (row.canArchive || row.canDelete) ? <DropdownMenuSeparator /> : null}
          {own && row.canArchive ? (
            <DropdownMenuItem variant="destructive" onClick={() => actions.ask("archive")}>
              <Archive /> Archive
            </DropdownMenuItem>
          ) : null}
          {own && row.canDelete ? (
            <DropdownMenuItem variant="destructive" onClick={() => actions.ask("delete")}>
              <Trash2 /> Delete draft
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {actions.dialogs}
    </div>
  )
}

/** Read-only view of a content item (company or HealthX). */
export function ContentSheet({ row, open, onOpenChange }: { row: ContentRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const actions = useContentActions(row, { onDone: () => onOpenChange(false) })
  const type = row ? CONTENT_TYPE_META[row.type] : null
  const cat = row ? CATEGORY_META[row.category] : null
  const own = row?.source === "company"
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {row && type && cat ? (
            <>
              <div className="flex h-32 shrink-0 items-center justify-center text-5xl" style={{ background: `linear-gradient(135deg, ${row.coverColor}, ${row.coverColor}b3)` }} aria-hidden>
                {row.coverEmoji}
              </div>
              <SheetHeader className="gap-2 border-b">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">
                    <type.icon /> {type.label}
                  </Badge>
                  <Badge variant="outline">
                    {cat.emoji} {cat.label}
                  </Badge>
                  <StatusBadge status={row.status} />
                  {!own ? <Badge variant="outline">HealthX · read-only</Badge> : null}
                </div>
                <SheetTitle className="font-heading text-lg leading-snug">{row.title}</SheetTitle>
                <SheetDescription>{row.summary}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 p-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Author</dt>
                    <dd className="font-medium">{row.author}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{type.minutesLabel}</dt>
                    <dd className="inline-flex items-center gap-1 font-medium">
                      <Clock className="size-3.5 text-muted-foreground" /> {row.readMinutes} min
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{row.publishedAt ? "Published" : "Last updated"}</dt>
                    <dd className="font-medium">{formatDate(row.publishedAt ?? row.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Views</dt>
                    <dd className="font-medium tabular-nums">{formatNumber(row.views)}</dd>
                  </div>
                </dl>
                {row.body ? <p className="text-sm leading-relaxed whitespace-pre-line">{row.body}</p> : null}
                {row.url ? (
                  <a href={row.url} target="_blank" rel="noreferrer noopener" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                    <ExternalLink className="size-4" /> {row.type === "video" ? "Watch video" : "Open link"}
                  </a>
                ) : null}
                {row.tags.length ? (
                  <div className="flex flex-wrap gap-1">
                    {row.tags.map((t) => (
                      <Badge key={t} variant="outline" className="font-normal">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">Updated {formatRelative(row.updatedAt)}</p>
              </div>
              {own ? (
                <SheetFooter className="mt-auto flex-row flex-wrap justify-end gap-2 border-t">
                  {row.canDelete ? (
                    <Button variant="ghost" className="mr-auto text-destructive" onClick={() => actions.ask("delete")} disabled={actions.pending}>
                      <Trash2 data-icon="inline-start" /> Delete
                    </Button>
                  ) : null}
                  {row.canArchive ? (
                    <Button variant="outline" onClick={() => actions.ask("archive")} disabled={actions.pending}>
                      <Archive data-icon="inline-start" /> Archive
                    </Button>
                  ) : null}
                  {row.canUnarchive ? (
                    <Button variant="outline" onClick={actions.unarchive} disabled={actions.pending}>
                      <ArchiveRestore data-icon="inline-start" /> Unarchive
                    </Button>
                  ) : null}
                  {row.canEdit ? (
                    <Button asChild variant={row.canPublish ? "outline" : "default"}>
                      <Link href={`/business-portal/content/${row.id}/edit`}>
                        <Pencil data-icon="inline-start" /> Edit
                      </Link>
                    </Button>
                  ) : null}
                  {row.canPublish ? (
                    <Button onClick={actions.publish} disabled={actions.pending}>
                      <Rocket data-icon="inline-start" /> Publish
                    </Button>
                  ) : null}
                </SheetFooter>
              ) : (
                <SheetFooter className="mt-auto border-t">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CoverTile emoji="🔒" color="#64748b" size="sm" /> HealthX content is managed by the HealthX team and shown to every company.
                  </p>
                </SheetFooter>
              )}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      {actions.dialogs}
    </>
  )
}
