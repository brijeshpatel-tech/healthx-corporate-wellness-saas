"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDown, ArrowUp, Check, FolderPlus, Pencil, Tags, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useController, useForm, type Control } from "react-hook-form"
import { z } from "zod"
import { CoverTile, EMOJI_SETS } from "@/components/admin/cover"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { FieldShell, TextField } from "@/components/common/form-fields"
import { ConfirmDialog } from "@/components/common/misc"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { rewardCategoriesApi, type CategoryRow } from "@/lib/api/platform/rewards"
import { formatNumber, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

const ICONS = [...EMOJI_SETS.reward, "🍽️", "🏋️", "🧠", "🚴", "🏅", "👏"]

/** Client decision #15 — MVP reward categories. `match` finds an existing category that already covers it. */
const RECOMMENDED: { name: string; icon: string; hint: string; match: RegExp }[] = [
  { name: "Basic wellness", icon: "🧘", hint: "Bottles, yoga mats, fitness bands", match: /wellness/i },
  { name: "Gift vouchers", icon: "🎁", hint: "Shopping, coffee and movie vouchers", match: /voucher/i },
  { name: "Recognition rewards", icon: "🏅", hint: "Certificates, shout-outs, perks", match: /recogni/i },
]

const schema = z.object({
  name: z.string().trim().min(2, "Enter a category name.").max(40, "Keep the name under 40 characters."),
  icon: z.string().trim().min(1, "Pick an icon."),
})
type Values = z.infer<typeof schema>

function IconPicker({ control }: { control: Control<Values> }) {
  const { field, fieldState } = useController({ control, name: "icon" })
  return (
    <FieldShell label="Icon" error={fieldState.error?.message}>
      <div className="flex flex-wrap gap-1.5">
        {ICONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => field.onChange(e)}
            className={cn("flex size-9 items-center justify-center rounded-lg border text-lg transition-colors hover:bg-muted", field.value === e && "border-primary bg-primary/10 ring-1 ring-primary/40")}
            aria-label={`Use ${e}`}
            aria-pressed={field.value === e}
          >
            {e}
          </button>
        ))}
        <Input value={field.value} onChange={(ev) => field.onChange(ev.target.value.slice(0, 4))} className="h-9 w-20 text-center text-lg" aria-label="Custom emoji" placeholder="🙂" />
      </div>
    </FieldShell>
  )
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  preset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: CategoryRow | null
  /** Prefill for a new category (e.g. a recommended one). */
  preset?: Values | null
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", icon: "🎁" } })
  useEffect(() => {
    if (open) form.reset(category ? { name: category.name, icon: category.icon } : (preset ?? { name: "", icon: "🎁" }))
  }, [open, category, preset, form])
  const onError = (err: ApiError) => {
    if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
  }
  const create = useApiMutation(rewardCategoriesApi.create, { success: "Category saved.", onSuccess: () => onOpenChange(false), onError })
  const update = useApiMutation(rewardCategoriesApi.update, { success: "Category saved.", onSuccess: () => onOpenChange(false), onError })
  const pending = create.isPending || update.isPending
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>Categories group rewards in the Employee App store. Names must be unique.</DialogDescription>
        </DialogHeader>
        <form
          id="category-form"
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) => (category ? update.mutate({ ...v, id: category.id }) : create.mutate(v)))}
        >
          <TextField control={form.control} name="name" label="Category name" placeholder="e.g. Learning" required />
          <IconPicker control={form.control} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" disabled={pending}>
            {pending ? <Spinner /> : null}
            Save category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** "Categories" tab of SCR-P-013: name, icon, rewards count, order; add / edit / reorder / delete when unused. */
export function RewardCategoriesTab() {
  const can = useAdminCan()
  const canManage = can("catalog.manage")
  const list = useApiQuery(["admin", "reward-categories"], () => rewardCategoriesApi.list())
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [preset, setPreset] = useState<Values | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<CategoryRow | null>(null)
  const move = useApiMutation(rewardCategoriesApi.move, { success: "Order updated." })
  const remove = useApiMutation(rewardCategoriesApi.remove, { success: "Category deleted." })

  const openDialog = (c: CategoryRow | null, p: Values | null = null) => {
    setEditing(c)
    setPreset(p)
    setDialogOpen(true)
  }

  if (list.error) return <ErrorState error={new Error("Couldn't load rewards.")} onRetry={() => list.refetch()} />

  const rows = list.data ?? []
  return (
    <div className="flex flex-col gap-4">
      {list.data ? (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">MVP reward categories</p>
          <p className="text-xs text-muted-foreground">Agreed with the client: basic wellness, gift vouchers and recognition rewards. Other categories are optional.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {RECOMMENDED.map((r) => {
              const existing = rows.find((c) => r.match.test(c.name))
              return (
                <div key={r.name} className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2">
                  <span className="text-lg leading-none">{r.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{existing ? `Covered by “${existing.name}”` : r.hint}</div>
                  </div>
                  {existing ? (
                    <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Set up" />
                  ) : canManage ? (
                    <Button size="sm" variant="outline" onClick={() => openDialog(null, { name: r.name, icon: r.icon })}>
                      Add
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">The order here is the order of the category tabs in the Employee App rewards store.</p>
        {canManage ? (
          <Button className="ml-auto" onClick={() => openDialog(null)}>
            <FolderPlus data-icon="inline-start" /> Add category
          </Button>
        ) : null}
      </div>

      {list.isLoading ? (
        <Card className="gap-0 divide-y py-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Start with the MVP categories: basic wellness, gift vouchers and recognition rewards."
          action={
            canManage ? (
              <Button onClick={() => openDialog(null)}>
                <FolderPlus data-icon="inline-start" /> Add category
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className={cn("gap-0 divide-y py-0", move.isPending && "opacity-80")}>
          {rows.map((c, i) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:px-4">
              <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground tabular-nums">{c.order}</span>
              <CoverTile emoji={c.icon} color="#10b981" size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {pluralize(c.rewardsCount, "reward")}
                  {c.rewardsCount ? ` · ${formatNumber(c.globalCount)} global, ${formatNumber(c.companyCount)} company` : ""}
                </div>
              </div>
              {canManage ? (
                <div className="ml-auto flex shrink-0 items-center gap-0.5">
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${c.name} up`} disabled={i === 0 || move.isPending} onClick={() => move.mutate({ id: c.id, direction: "up" })}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${c.name} down`} disabled={i === rows.length - 1 || move.isPending} onClick={() => move.mutate({ id: c.id, direction: "down" })}>
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => openDialog(c)}>
                    <Pencil />
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={c.rewardsCount > 0 ? 0 : -1}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${c.name}`}
                          disabled={c.rewardsCount > 0}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleting(c)}
                        >
                          <Trash2 />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{c.rewardsCount > 0 ? "Only empty categories can be deleted" : "Delete category"}</TooltipContent>
                  </Tooltip>
                </div>
              ) : null}
            </div>
          ))}
        </Card>
      )}

      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editing} preset={preset} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="This category has no rewards. It will be removed from the rewards store straight away."
        confirmLabel="Delete category"
        destructive
        onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
      />
    </div>
  )
}
