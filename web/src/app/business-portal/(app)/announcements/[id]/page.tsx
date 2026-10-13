"use client"

import { Ban, CalendarClock, ChevronRight, Copy, FileText, Pencil, Pin, PinOff, Send, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useAnnouncementActions } from "@/components/business/engagement/announcements/announcement-actions"
import { ChannelIcons, TypeChip } from "@/components/business/engagement/announcements/announcement-bits"
import { CHANNEL_META, formatSchedule } from "@/components/business/engagement/announcements/announcement-meta"
import { AnnouncementPreview } from "@/components/business/engagement/announcements/announcement-preview"
import { TrendChart } from "@/components/common/charts"
import { InlineBar, KeyValueList, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { PageSkeleton, QueryState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { announcementsApi, type AnnouncementDetail } from "@/lib/api/business/announcements"
import { useApiQuery } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import { formatDateTime, formatNumber, formatPercent, formatRelative } from "@/lib/format"

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const detail = useApiQuery(["business", "announcements", "detail", id], () => announcementsApi.get({ id }))

  return (
    <PageContainer>
      <QueryState query={detail} loading={<PageSkeleton kpis={3} />}>
        {(a) => <DetailBody a={a} />}
      </QueryState>
    </PageContainer>
  )
}

function DetailBody({ a }: { a: AnnouncementDetail }) {
  const router = useRouter()
  const session = useSession("business")
  const actions = useAnnouncementActions(a, { onDeleted: () => router.push("/business-portal/announcements") })
  const sent = a.status === "sent"

  return (
    <>
      <PageHeader
        title={a.title}
        backHref="/business-portal/announcements"
        backLabel="Announcements"
        badge={
          <>
            <StatusBadge status={a.status} />
            {a.pinned ? (
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                <Pin /> Pinned
              </Badge>
            ) : null}
          </>
        }
        description={`By ${a.author} · created ${formatRelative(a.createdAt)}`}
        actions={
          <>
            {a.canEdit ? (
              <Button asChild variant="outline">
                <Link href={`/business-portal/announcements/${a.id}/edit`}>
                  <Pencil data-icon="inline-start" /> Edit
                </Link>
              </Button>
            ) : null}
            {a.canSend ? (
              <Button onClick={() => actions.ask("send")} disabled={actions.pending}>
                <Send data-icon="inline-start" /> Send now
              </Button>
            ) : (
              <Button variant="outline" onClick={actions.duplicate} disabled={actions.pending}>
                <Copy data-icon="inline-start" /> Duplicate
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={actions.pending}>
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {a.canSend ? (
                  <DropdownMenuItem onClick={actions.duplicate}>
                    <Copy /> Duplicate
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={actions.togglePin}>
                  {a.pinned ? (
                    <>
                      <PinOff /> Unpin
                    </>
                  ) : (
                    <>
                      <Pin /> Pin to top
                    </>
                  )}
                </DropdownMenuItem>
                {a.canCancel || a.canDelete ? <DropdownMenuSeparator /> : null}
                {a.canCancel ? (
                  <DropdownMenuItem variant="destructive" onClick={() => actions.ask("cancel")}>
                    <Ban /> Cancel scheduled send
                  </DropdownMenuItem>
                ) : null}
                {a.canDelete ? (
                  <DropdownMenuItem variant="destructive" onClick={() => actions.ask("delete")}>
                    <Trash2 /> Delete draft
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {a.status === "scheduled" ? (
            <StatusStrip icon={CalendarClock} tone="sky">
              Scheduled for <strong>{formatSchedule(a.scheduledAt)}</strong> ({formatRelative(a.scheduledAt)}). It will reach about <strong>{formatNumber(a.audienceSize.joined)}</strong> people who use the app.
            </StatusStrip>
          ) : a.status === "draft" ? (
            <StatusStrip icon={FileText} tone="slate">
              {a.scheduleCancelledAt ? (
                <>
                  The scheduled send was cancelled {formatRelative(a.scheduleCancelledAt)}. This announcement is a draft again — edit it or send it when you&apos;re ready.
                </>
              ) : (
                <>Draft — not sent yet. It will reach about {formatNumber(a.audienceSize.joined)} people who use the app.</>
              )}
            </StatusStrip>
          ) : null}

          {sent ? (
            <>
              <SectionCard
                title={
                  <span className="inline-flex items-center gap-2">
                    Reach <PhaseBadge phase={2} />
                  </span>
                }
                description={`Sent ${formatDateTime(a.sentAt)} · ${formatPercent(a.deliveryRate, 1)} delivered · ${formatPercent(a.openRate)} opened. Counts only — no one can see who opened it.`}
              >
                <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <ul className="space-y-4">
                    {[
                      { label: "Recipients", value: a.stats.recipients },
                      { label: "Delivered", value: a.stats.delivered },
                      { label: "Opened", value: a.stats.opened },
                    ].map((s) => (
                      <li key={s.label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className="font-semibold tabular-nums">
                            {formatNumber(s.value)} <span className="text-xs font-normal text-muted-foreground">({formatPercent(a.stats.recipients ? s.value / a.stats.recipients : 0)})</span>
                          </span>
                        </div>
                        <InlineBar value={s.value} max={a.stats.recipients} />
                      </li>
                    ))}
                  </ul>
                  {a.opensTimeline.length > 1 ? (
                    <div className="min-w-0">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Opens after sending</p>
                      <TrendChart data={a.opensTimeline} xKey="label" series={[{ key: "opened", label: "Opened" }]} height={170} />
                    </div>
                  ) : (
                    <p className="self-center text-sm text-muted-foreground">Opens appear here over the first few hours after sending.</p>
                  )}
                </div>
              </SectionCard>
            </>
          ) : null}

          <SectionCard title="Message" actions={<TypeChip type={a.type} />}>
            <article className="space-y-3">
              <h2 className="font-heading text-lg font-semibold">{a.title}</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{a.body}</p>
              {a.link ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                    {a.link.label} <ChevronRight className="size-4" />
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{a.link.href}</span>
                </div>
              ) : null}
            </article>
          </SectionCard>

          <SectionCard title="Delivery">
            <KeyValueList
              items={[
                {
                  label: "Audience",
                  value:
                    a.audienceType === "all" ? (
                      "Everyone in the company"
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {a.audienceNames.slice(0, 12).map((n, i) => (
                          <Badge key={`${n}-${i}`} variant="secondary">
                            {n}
                          </Badge>
                        ))}
                        {a.audienceNames.length > 12 ? <Badge variant="outline">+{a.audienceNames.length - 12} more</Badge> : null}
                      </div>
                    ),
                },
                { label: "Audience size", value: `${formatNumber(a.audienceSize.total)} people · ${formatNumber(a.audienceSize.joined)} use the app` },
                {
                  label: "Channels",
                  value: (
                    <div className="flex items-center gap-2">
                      <ChannelIcons channels={a.channels} />
                      <span className="text-muted-foreground">{a.channels.map((c) => CHANNEL_META[c].label).join(", ")}</span>
                    </div>
                  ),
                },
                { label: a.status === "sent" ? "Sent" : a.status === "scheduled" ? "Scheduled for" : "Send date", value: a.status === "sent" ? formatDateTime(a.sentAt) : a.status === "scheduled" ? formatSchedule(a.scheduledAt) : "Not scheduled" },
                { label: "Author", value: a.author },
                { label: "Last updated", value: formatDateTime(a.updatedAt) },
              ]}
            />
          </SectionCard>
        </div>

        <aside className="lg:sticky lg:top-20">
          <AnnouncementPreview
            title={a.title}
            body={a.body}
            type={a.type}
            channels={a.channels}
            link={a.link}
            pinned={a.pinned}
            companyName={session?.companyName}
            timeLabel={sent ? formatRelative(a.sentAt) : a.status === "scheduled" ? formatSchedule(a.scheduledAt) : "now"}
          />
        </aside>
      </div>

      {actions.dialogs}
    </>
  )
}

function StatusStrip({ icon: Icon, tone, children }: { icon: typeof CalendarClock; tone: "sky" | "slate"; children: React.ReactNode }) {
  return (
    <div
      className={
        tone === "sky"
          ? "flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/6 px-3.5 py-3 text-sm text-sky-900 dark:text-sky-200"
          : "flex items-start gap-2.5 rounded-xl border bg-muted/40 px-3.5 py-3 text-sm text-foreground/90"
      }
    >
      <Icon className={tone === "sky" ? "mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" : "mt-0.5 size-4 shrink-0 text-muted-foreground"} />
      <p>{children}</p>
    </div>
  )
}
