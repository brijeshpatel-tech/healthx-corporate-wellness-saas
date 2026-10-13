"use client"

import { ArrowRightLeft, Clock, MapPin, MoreHorizontal, Network, Pencil, Plus, Trash2, Users } from "lucide-react"
import { useState } from "react"
import { LocationDialog } from "@/components/business/people/location-dialog"
import { ConfirmDialog, InlineBar, PrivacyNote } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { EmptyState, ErrorState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { locationsApi, TIMEZONES, type LocationRow } from "@/lib/api/business/locations"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatNumber, formatPercent, pluralize } from "@/lib/format"

/** SCR-B-046 — Locations (Phase 2). */
export default function LocationsPage() {
  const can = useCan()
  const manage = can("org.manage")
  const [dialog, setDialog] = useState<{ open: boolean; location?: LocationRow | null }>({ open: false })
  const [toDelete, setToDelete] = useState<LocationRow | null>(null)
  const q = useApiQuery(["business", "locations"], () => locationsApi.list())
  const total = (q.data ?? []).reduce((a, l) => a + l.employeeCount, 0)

  return (
    <PageContainer>
      <PageHeader
        title="Locations"
        badge={<PhaseBadge phase={2} />}
        description="Record your offices and sites to compare participation by location."
        actions={
          manage ? (
            <Button onClick={() => setDialog({ open: true, location: null })}>
              <Plus data-icon="inline-start" /> Add location
            </Button>
          ) : null
        }
      />

      {q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet."
          description="Add your offices so you can compare participation between sites."
          action={
            manage ? (
              <Button onClick={() => setDialog({ open: true, location: null })}>
                <Plus data-icon="inline-start" /> Add location
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((l) => (
            <Card key={l.id} className="gap-0 py-0">
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400">
                    <MapPin className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading font-semibold">{l.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {l.city}, {l.country}
                    </p>
                  </div>
                  {manage ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${l.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDialog({ open: true, location: l })}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setToDelete(l)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
                {l.address ? <p className="line-clamp-2 text-sm text-muted-foreground">{l.address}</p> : null}
                <div className="mt-auto space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Users className="size-3.5" /> Employees
                      </span>
                      <span>
                        <span className="font-semibold tabular-nums">{formatNumber(l.employeeCount)}</span>
                        <span className="text-xs text-muted-foreground"> · {total ? formatPercent(l.employeeCount / total) : "0%"} of company</span>
                      </span>
                    </div>
                    <InlineBar value={l.employeeCount} max={Math.max(1, total)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                      <p className="text-muted-foreground">Active</p>
                      <p className="font-semibold">{l.activeShare === null ? "Hidden (< 5 people)" : formatPercent(l.activeShare)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                      <p className="inline-flex items-center gap-1 text-muted-foreground">
                        <Network className="size-3" /> Departments
                      </p>
                      <p className="font-semibold">{l.departmentCount}</p>
                    </div>
                  </div>
                  <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" /> {TIMEZONES.find((t) => t.value === l.timezone)?.label ?? l.timezone}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
          {manage ? (
            <button
              type="button"
              onClick={() => setDialog({ open: true, location: null })}
              className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
            >
              <Plus className="size-5" /> Add another location
            </button>
          ) : null}
        </div>
      )}

      <PrivacyNote>Location comparisons use combined figures only. Locations with fewer than 5 people never show participation rates.</PrivacyNote>

      <LocationDialog open={dialog.open} location={dialog.location} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
      <DeleteLocationDialog key={toDelete?.id ?? "none"} location={toDelete} locations={q.data ?? []} onClose={() => setToDelete(null)} />
    </PageContainer>
  )
}

function DeleteLocationDialog({ location, locations, onClose }: { location: LocationRow | null; locations: LocationRow[]; onClose: () => void }) {
  const [target, setTarget] = useState("")
  const reassign = useApiMutation(locationsApi.reassign, { invalidate: false })
  const remove = useApiMutation(locationsApi.remove, { success: () => `${location?.name ?? "Location"} deleted.`, onSuccess: onClose })
  if (!location) return null
  if (location.employeeCount === 0) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(o) => !o && onClose()}
        destructive
        title={`Delete ${location.name}?`}
        description={location.departmentCount ? `${pluralize(location.departmentCount, "department")} will no longer have a main location.` : "This can't be undone."}
        confirmLabel="Delete location"
        onConfirm={() => remove.mutate({ id: location.id })}
      />
    )
  }
  const busy = reassign.isPending || remove.isPending
  return (
    <AlertDialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move people before deleting</AlertDialogTitle>
          <AlertDialogDescription>
            {pluralize(location.employeeCount, "employee")} {location.employeeCount === 1 ? "is" : "are"} still assigned to {location.name}. Move them before deleting.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Move everyone to</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Choose a location" />
            </SelectTrigger>
            <SelectContent>
              {locations
                .filter((l) => l.id !== location.id)
                .map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={!target || busy}
            onClick={() => reassign.mutate({ id: location.id, targetId: target }, { onSuccess: () => remove.mutate({ id: location.id }) })}
          >
            {busy ? <Spinner /> : <ArrowRightLeft data-icon="inline-start" />}
            Move {formatNumber(location.employeeCount)} &amp; delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
