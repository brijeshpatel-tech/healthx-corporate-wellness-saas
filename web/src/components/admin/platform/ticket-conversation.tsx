"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { BookOpen, Lock, MessageSquareReply, NotebookPen, Send } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { TextareaField } from "@/components/common/form-fields"
import { UserAvatar } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { helpApi, helpArticleLink, type HelpArticle } from "@/lib/api/platform/help"
import { supportApi, type TicketDetail, type TicketMessage } from "@/lib/api/platform/support"
import { formatDateTime, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Chat-style conversation with internal notes (SCR-P-030 ticket detail). */
export function TicketConversation({ ticket }: { ticket: TicketDetail }) {
  const end = useRef<HTMLDivElement>(null)
  const count = ticket.messages.length
  const prevCount = useRef(count)
  useEffect(() => {
    if (count > prevCount.current) end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    prevCount.current = count
  }, [count])

  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
        {ticket.messages.map((m) => (
          <MessageBubble key={m.index} message={m} />
        ))}
        <div ref={end} className="-mt-4" />
      </CardContent>
    </Card>
  )
}

function MessageBubble({ message: m }: { message: TicketMessage }) {
  if (m.internal) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 sm:mx-6">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300">
            <Lock className="size-3.5" /> Internal note
          </span>
          <span className="text-amber-800/80 dark:text-amber-300/80">only HealthX staff see this</span>
          <span className="ml-auto text-muted-foreground" title={formatDateTime(m.at)}>
            {m.from} · {formatRelative(m.at)}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap text-amber-950 dark:text-amber-100">{m.body}</p>
      </div>
    )
  }
  const staff = m.author === "staff"
  return (
    <div className={cn("flex items-end gap-2.5", staff && "flex-row-reverse")}>
      <UserAvatar name={m.from} color={m.avatarColor ?? (staff ? "#10b981" : "#64748b")} size="sm" className="shrink-0" />
      <div className={cn("flex max-w-[85%] min-w-0 flex-col gap-1 sm:max-w-[75%]", staff && "items-end")}>
        <div className={cn("flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground", staff && "justify-end")}>
          <span className="font-medium text-foreground">{m.from}</span>
          <span>{staff ? "HealthX Support" : "Customer"}</span>
          <span title={formatDateTime(m.at)}>{formatRelative(m.at)}</span>
        </div>
        <div className={cn("rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words", staff ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted")}>{m.body}</div>
      </div>
    </div>
  )
}

const schema = z.object({
  body: z.string().trim().min(2, "Write a message first").max(4000, "Keep it under 4,000 characters"),
})
type Values = z.infer<typeof schema>

/** Reply / internal note composer. */
export function TicketComposer({ ticket, canReply }: { ticket: TicketDetail; canReply: boolean }) {
  const [mode, setMode] = useState<"reply" | "note">("reply")
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { body: "" } })
  const articles = useApiQuery(["admin", "help-articles", "published"], () => helpApi.list({ status: "published" }), { enabled: canReply })
  const insertArticle = (a: HelpArticle) => {
    const current = form.getValues("body").trimEnd()
    const link = `${window.location.origin}${helpArticleLink(a.id)}`
    const snippet = `Help article: ${a.title}\n${link}`
    form.setValue("body", current ? `${current}\n\n${snippet}` : snippet, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  }
  const send = useApiMutation(supportApi.reply, {
    success: (_, input) => (input.internal ? "Internal note added." : "Reply sent."),
    onSuccess: () => form.reset({ body: "" }),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors?.body) form.setError("body", { message: err.fieldErrors.body })
    },
  })

  if (!canReply) {
    return <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Only Support Admins and Super Admins can reply to tickets.</p>
  }

  const closed = ticket.status === "closed"
  const replyBlocked = closed && mode === "reply"
  const note = mode === "note"

  return (
    <Card className={cn("gap-0 py-0 transition-colors", note && "border-amber-500/40 bg-amber-500/5")}>
      <CardContent className="p-4">
        <form onSubmit={form.handleSubmit((v) => send.mutate({ id: ticket.id, body: v.body, internal: note }))} noValidate className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => v && setMode(v as "reply" | "note")} aria-label="Message type">
              <ToggleGroupItem value="reply" className="px-3">
                <MessageSquareReply /> Reply
              </ToggleGroupItem>
              <ToggleGroupItem value="note" className="px-3">
                <NotebookPen /> Internal note
              </ToggleGroupItem>
            </ToggleGroup>
            <span className="text-xs text-muted-foreground">
              {note ? "Only HealthX staff see notes." : ticket.status === "open" ? `Sent to ${ticket.requester}. Replying moves the ticket to Pending.` : `Sent to ${ticket.requester}.`}
            </span>
          </div>
          <TextareaField
            control={form.control}
            name="body"
            rows={4}
            maxLength={4000}
            disabled={replyBlocked || send.isPending}
            placeholder={replyBlocked ? "This ticket is closed. Reopen it to reply." : note ? "Add context for the team — the customer won't see this." : `Write a reply to ${ticket.requester}…`}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" disabled={replyBlocked || send.isPending || !articles.data?.length}>
                  <BookOpen data-icon="inline-start" /> Insert help article
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 w-80 overflow-y-auto">
                {groupByCategory(articles.data ?? []).map(([category, list], i) => (
                  <DropdownMenuGroup key={category}>
                    {i > 0 ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuLabel className="text-xs text-muted-foreground">{category}</DropdownMenuLabel>
                    {list.map((a) => (
                      <DropdownMenuItem key={a.id} onClick={() => insertArticle(a)} className="whitespace-normal">
                        {a.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="submit" disabled={replyBlocked || send.isPending} className={cn(note && "bg-amber-600 text-white hover:bg-amber-600/90")}>
              {send.isPending ? <Spinner /> : note ? <NotebookPen data-icon="inline-start" /> : <Send data-icon="inline-start" />}
              {note ? "Add note" : "Send reply"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function groupByCategory(list: HelpArticle[]): [string, HelpArticle[]][] {
  const map = new Map<string, HelpArticle[]>()
  for (const a of list) map.set(a.category, [...(map.get(a.category) ?? []), a])
  return [...map]
}
