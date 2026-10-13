"use client"

import { Building2, Search, UserCheck, Users, UsersRound, X } from "lucide-react"
import { useMemo, useState } from "react"
import { SearchInput } from "@/components/common/misc"
import { UserAvatar } from "@/components/common/user-avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { audienceApi, type AudienceInput } from "@/lib/api/business/challenges"
import { organizationApi } from "@/lib/api/business/organization"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import type { AudienceType } from "@/lib/types"
import { cn } from "@/lib/utils"

const OPTIONS: { value: AudienceType; label: string; description: string; icon: typeof Users }[] = [
  { value: "all", label: "Everyone", description: "All employees", icon: Users },
  { value: "departments", label: "Departments", description: "Pick departments", icon: Building2 },
  { value: "teams", label: "Teams", description: "Pick teams", icon: UsersRound },
  { value: "selected", label: "Selected people", description: "Pick employees", icon: UserCheck },
]

/**
 * Audience picker shared by challenges, announcements and programs:
 * everyone / departments / teams / selected employees (searchable), with a live size estimate.
 */
export function AudienceField({
  value,
  onChange,
  error,
  disabled,
  allowSelected = true,
  label = "Who can take part",
  estimateLabel = "people",
  className,
}: {
  value: AudienceInput
  onChange: (value: AudienceInput) => void
  error?: string
  disabled?: boolean
  allowSelected?: boolean
  label?: string
  estimateLabel?: string
  className?: string
}) {
  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups())
  const estimate = useApiQuery(["business", "audience", "estimate", value], () => audienceApi.estimate(value), { placeholderData: (p) => p })
  const options = allowSelected ? OPTIONS : OPTIONS.filter((o) => o.value !== "selected")
  const setType = (audienceType: AudienceType) => onChange({ audienceType, audienceIds: audienceType === value.audienceType ? value.audienceIds : [] })
  const toggle = (id: string) => onChange({ ...value, audienceIds: value.audienceIds.includes(id) ? value.audienceIds.filter((x) => x !== id) : [...value.audienceIds, id] })

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Label className="text-sm font-medium">
        {label}
        <span className="text-destructive">*</span>
      </Label>
      <div role="radiogroup" aria-label={label} className={cn("grid gap-2", options.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
        {options.map((o) => {
          const active = value.audienceType === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => setType(o.value)}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
                active && "border-primary bg-primary/5 ring-1 ring-primary/30",
              )}
            >
              <o.icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.description}</span>
              </span>
            </button>
          )
        })}
      </div>

      {value.audienceType === "departments" ? (
        lookups.isLoading ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : (
          <CheckList
            disabled={disabled}
            selected={value.audienceIds}
            onToggle={toggle}
            onSetAll={(ids) => onChange({ ...value, audienceIds: ids })}
            items={(lookups.data?.departments ?? []).map((d) => ({ id: d.id, label: d.name, meta: `${formatNumber(d.employeeCount)} people` }))}
          />
        )
      ) : null}

      {value.audienceType === "teams" ? (
        lookups.isLoading ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : (
          <CheckList
            disabled={disabled}
            searchable
            selected={value.audienceIds}
            onToggle={toggle}
            onSetAll={(ids) => onChange({ ...value, audienceIds: ids })}
            items={(lookups.data?.teams ?? []).map((t) => ({ id: t.id, label: t.name, meta: `${t.departmentName} · ${formatNumber(t.employeeCount)}` }))}
          />
        )
      ) : null}

      {value.audienceType === "selected" ? <PeoplePicker selected={value.audienceIds} onChange={(ids) => onChange({ ...value, audienceIds: ids })} disabled={disabled} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {error ? (
          <p className="text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <span />
        )}
        <span className={cn("inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground", estimate.isFetching && "opacity-70")}>
          <Users className="size-3.5" />
          {estimate.data ? (
            <>
              <span className="font-semibold text-foreground tabular-nums">{formatNumber(estimate.data.total)}</span> {estimateLabel}
              <span aria-hidden>·</span>
              <span className="tabular-nums">{formatNumber(estimate.data.joined)}</span> use the app
            </>
          ) : (
            "Estimating audience…"
          )}
        </span>
      </div>
    </div>
  )
}

function CheckList({
  items,
  selected,
  onToggle,
  onSetAll,
  searchable,
  disabled,
}: {
  items: { id: string; label: string; meta?: string }[]
  selected: string[]
  onToggle: (id: string) => void
  onSetAll: (ids: string[]) => void
  searchable?: boolean
  disabled?: boolean
}) {
  const [q, setQ] = useState("")
  const visible = items.filter((i) => !q || `${i.label} ${i.meta ?? ""}`.toLowerCase().includes(q.toLowerCase()))
  const all = items.length > 0 && items.every((i) => selected.includes(i.id))
  return (
    <div className="rounded-xl border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        {searchable ? (
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="h-8 pl-8" aria-label="Filter list" />
          </div>
        ) : (
          <span className="flex-1 text-xs text-muted-foreground">{selected.length ? `${selected.length} selected` : "Choose one or more"}</span>
        )}
        <button type="button" disabled={disabled} className="text-xs font-medium text-primary hover:underline disabled:opacity-50" onClick={() => onSetAll(all ? [] : items.map((i) => i.id))}>
          {all ? "Clear all" : "Select all"}
        </button>
      </div>
      <ul className="grid max-h-60 gap-px overflow-y-auto p-1 sm:grid-cols-2">
        {visible.map((i) => {
          const id = `aud-${i.id}`
          return (
            <li key={i.id}>
              <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                <Checkbox id={id} checked={selected.includes(i.id)} onCheckedChange={() => onToggle(i.id)} disabled={disabled} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{i.label}</span>
                  {i.meta ? <span className="block truncate text-xs text-muted-foreground">{i.meta}</span> : null}
                </span>
              </label>
            </li>
          )
        })}
        {visible.length === 0 ? <li className="col-span-full px-2 py-4 text-center text-sm text-muted-foreground">Nothing matches “{q}”.</li> : null}
      </ul>
    </div>
  )
}

function PeoplePicker({ selected, onChange, disabled }: { selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const [search, setSearch] = useState("")
  const results = useApiQuery(["business", "audience", "people", search], () => audienceApi.employees({ search, limit: 30 }), { placeholderData: (p) => p })
  const chosen = useApiQuery(["business", "audience", "people-ids", selected], () => audienceApi.employees({ ids: selected }), { enabled: selected.length > 0, placeholderData: (p) => p })
  const chosenById = useMemo(() => new Map((chosen.data ?? []).map((p) => [p.id, p])), [chosen.data])
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <div className="rounded-xl border">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b p-2.5">
          {selected.map((id) => {
            const p = chosenById.get(id)
            return (
              <span key={id} className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-muted/50 pr-1 pl-1 text-xs">
                <UserAvatar name={p?.name ?? "…"} color={p?.avatarColor} size="xs" />
                <span className="max-w-32 truncate">{p?.name ?? "Loading…"}</span>
                <button type="button" disabled={disabled} onClick={() => toggle(id)} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${p?.name ?? "person"}`}>
                  <X className="size-3" />
                </button>
              </span>
            )
          })}
          <button type="button" disabled={disabled} onClick={() => onChange([])} className="ml-auto text-xs font-medium text-primary hover:underline">
            Clear
          </button>
        </div>
      ) : null}
      <div className="border-b p-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, job title or team…" className="sm:w-full" />
      </div>
      <ul className="max-h-64 overflow-y-auto p-1">
        {results.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-2.5 px-2 py-2">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </li>
            ))
          : (results.data ?? []).map((p) => {
              const id = `ppl-${p.id}`
              return (
                <li key={p.id}>
                  <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                    <Checkbox id={id} checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} disabled={disabled} />
                    <UserAvatar name={p.name} color={p.avatarColor} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{p.subtitle}</span>
                    </span>
                    {p.status === "invited" ? <span className="shrink-0 text-[11px] text-muted-foreground">Not joined yet</span> : null}
                  </label>
                </li>
              )
            })}
        {!results.isLoading && results.data?.length === 0 ? <li className="px-2 py-4 text-center text-sm text-muted-foreground">No employees match “{search}”.</li> : null}
      </ul>
    </div>
  )
}
