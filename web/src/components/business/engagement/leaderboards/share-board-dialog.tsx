"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Copy, ExternalLink, Link2, Monitor, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ChoiceField, SelectField, SwitchField, TextField } from "@/components/common/form-fields"
import { ConfirmDialog } from "@/components/common/misc"
import { PhaseBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { boardsApi, type BoardShare } from "@/lib/api/business/boards"
import type { LeaderboardQuery } from "@/lib/api/business/leaderboards"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber, formatRelative } from "@/lib/format"
import type { LeaderboardNameDisplay } from "@/lib/types"

const ORDER: LeaderboardNameDisplay[] = ["full_name", "first_name_initial", "anonymous"]
const LABEL: Record<LeaderboardNameDisplay, { label: string; description: string }> = {
  full_name: { label: "Full names", description: "Priya Sharma" },
  first_name_initial: { label: "First name + initial", description: "Priya S." },
  anonymous: { label: "Anonymous", description: "Ranks and values only" },
}

const schema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters").max(60, "Keep it under 60 characters"),
  nameDisplay: z.enum(["full_name", "first_name_initial", "anonymous"]),
  showDepartments: z.boolean(),
  limit: z.enum(["10", "20", "30"]),
})
type Values = z.infer<typeof schema>

export const boardUrl = (token: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/board/${token}`

/** #351 (Phase 2) — create a public/TV leaderboard link with privacy controls, and manage existing links. */
export function ShareBoardDialog({
  open,
  onOpenChange,
  query,
  defaultTitle,
  companyNameDisplay,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: LeaderboardQuery
  defaultTitle: string
  companyNameDisplay: LeaderboardNameDisplay
}) {
  const allowed = ORDER.slice(ORDER.indexOf(companyNameDisplay))
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: defaultTitle, nameDisplay: allowed[0]!, showDepartments: true, limit: "10" } })
  const [created, setCreated] = useState<BoardShare | null>(null)
  const [revoke, setRevoke] = useState<BoardShare | null>(null)
  const list = useApiQuery(["business", "board-shares"], () => boardsApi.list(), { enabled: open })

  useEffect(() => {
    if (open) form.reset({ title: defaultTitle, nameDisplay: allowed[0]!, showDepartments: true, limit: "10" })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open])

  const create = useApiMutation(boardsApi.create, {
    success: "Public board link created",
    onSuccess: (s) => setCreated(s),
    onError: (err) => Object.entries(err.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as keyof Values, { message })),
  })
  const revokeM = useApiMutation(boardsApi.revoke, { success: "Link revoked – the screen will stop updating." })

  const close = (o: boolean) => {
    if (!o) setCreated(null)
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="size-4" /> Share as a TV board <PhaseBadge phase={2} />
          </DialogTitle>
          <DialogDescription>A read-only link for office screens or Slack. It refreshes every 30 seconds and never shows more than your company&apos;s privacy setting allows.</DialogDescription>
        </DialogHeader>

        {created ? (
          <CreatedLink share={created} onDone={() => setCreated(null)} />
        ) : (
          <form id="share-board" noValidate onSubmit={form.handleSubmit((v) => create.mutate({ title: v.title, query, nameDisplay: v.nameDisplay, showDepartments: v.showDepartments, limit: Number(v.limit) }))} className="grid gap-4">
            <TextField control={form.control} name="title" label="Board title" required />
            <ChoiceField
              control={form.control}
              name="nameDisplay"
              label="Names on screen"
              columns={allowed.length === 1 ? 1 : allowed.length === 2 ? 2 : 3}
              options={allowed.map((m) => ({ value: m, label: LABEL[m].label, description: LABEL[m].description }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SwitchField control={form.control} name="showDepartments" label="Show departments" description="Next to each name." />
              <SelectField control={form.control} name="limit" label="Places shown" options={[{ value: "10", label: "Top 10" }, { value: "20", label: "Top 20" }, { value: "30", label: "Top 30" }]} />
            </div>
          </form>
        )}

        {!created ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" form="share-board" disabled={create.isPending}>
              {create.isPending ? <Spinner /> : <Link2 data-icon="inline-start" />}
              Create link
            </Button>
          </DialogFooter>
        ) : null}

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Active links</p>
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (list.data ?? []).filter((s) => !s.revokedAt).length === 0 ? (
            <p className="text-sm text-muted-foreground">No public boards yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {(list.data ?? [])
                .filter((s) => !s.revokedAt)
                .map((s) => (
                  <li key={s.token} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {LABEL[s.nameDisplay].label} · top {s.limit} · {formatNumber(s.views)} views · by {s.createdBy} {formatRelative(s.createdAt)}
                      </p>
                    </div>
                    <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${s.title}`}>
                      <a href={`/board/${s.token}`} target="_blank" rel="noreferrer">
                        <ExternalLink />
                      </a>
                    </Button>
                    <CopyButton text={boardUrl(s.token)} label={`Copy link for ${s.title}`} />
                    <Button variant="ghost" size="icon-sm" aria-label={`Revoke ${s.title}`} onClick={() => setRevoke(s)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <ConfirmDialog
          open={!!revoke}
          onOpenChange={(o) => !o && setRevoke(null)}
          destructive
          title={`Revoke “${revoke?.title}”?`}
          description="Anyone using this link (including office screens) will see “This board is no longer available”. You can create a new link at any time."
          confirmLabel="Revoke link"
          onConfirm={() => {
            if (revoke) revokeM.mutate({ token: revoke.token })
            setRevoke(null)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function CreatedLink({ share, onDone }: { share: BoardShare; onDone: () => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Badge>Ready</Badge>
        <span className="text-sm font-medium">{share.title}</span>
      </div>
      <div className="flex gap-2">
        <Input readOnly value={boardUrl(share.token)} className="h-9 font-mono text-xs" aria-label="Public board link" onFocus={(e) => e.currentTarget.select()} />
        <CopyButton text={boardUrl(share.token)} label="Copy link" withLabel />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href={`/board/${share.token}`} target="_blank" rel="noreferrer">
            <ExternalLink data-icon="inline-start" /> Open board
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Create another
        </Button>
      </div>
    </div>
  )
}

export function CopyButton({ text, label, withLabel }: { text: string; label: string; withLabel?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }
  return withLabel ? (
    <Button type="button" variant="outline" onClick={copy} aria-label={label}>
      {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  ) : (
    <Button type="button" variant="ghost" size="icon-sm" onClick={copy} aria-label={label}>
      {copied ? <Check className="text-primary" /> : <Copy />}
    </Button>
  )
}
