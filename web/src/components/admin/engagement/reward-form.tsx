"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, Save } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { CoverPickerField, EMOJI_SETS } from "@/components/admin/cover"
import { FormActions } from "@/components/admin/form-layout"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { ChoiceField, SelectField, SwitchField, TextareaField, TextField } from "@/components/common/form-fields"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { rewardCategoriesApi, rewardsApi, type RewardInput, type RewardRow } from "@/lib/api/platform/rewards"
import { ADMIN, DELIVERY_META } from "./meta"
import { RewardPreview } from "./reward-preview"

const DELIVERIES = ["physical", "digital_voucher", "experience", "donation", "company_perk"] as const

const schema = z
  .object({
    name: z.string().trim().min(3, "Enter a reward name (at least 3 characters).").max(80, "Keep the name under 80 characters."),
    categoryId: z.string().min(1, "Choose a category."),
    description: z.string().trim().min(1, "Add a short description.").max(400, "Keep the description under 400 characters."),
    terms: z.string().trim().max(500, "Keep the terms under 500 characters."),
    imageEmoji: z.string().trim().min(1, "Pick an image."),
    imageColor: z.string().min(1),
    pointsCost: z.number({ error: "Enter a number" }).int("Use whole points.").positive("Points cost must be greater than 0.").max(1_000_000, "Points cost looks too high."),
    delivery: z.enum(DELIVERIES, { error: "Choose a delivery method." }),
    unlimited: z.boolean(),
    stock: z.union([z.number(), z.literal("")]),
    perEmployeeLimit: z.union([z.number(), z.literal("")]),
    provider: z.string().trim().max(80, "Keep this under 80 characters."),
    featured: z.boolean(),
    status: z.enum(["active", "draft", "archived"]),
  })
  .superRefine((v, ctx) => {
    if (!v.unlimited) {
      if (v.stock === "") ctx.addIssue({ code: "custom", path: ["stock"], message: "Enter the stock or turn on Unlimited." })
      else if (!Number.isInteger(v.stock) || v.stock < 0) ctx.addIssue({ code: "custom", path: ["stock"], message: "Stock must be a whole number, 0 or more." })
    }
    if (v.perEmployeeLimit !== "" && (!Number.isInteger(v.perEmployeeLimit) || v.perEmployeeLimit < 1)) {
      ctx.addIssue({ code: "custom", path: ["perEmployeeLimit"], message: "Limit must be at least 1 (or leave empty)." })
    }
  })
type Values = z.infer<typeof schema>

const EMPTY: Values = {
  name: "",
  categoryId: "",
  description: "",
  terms: "",
  imageEmoji: "🎁",
  imageColor: "#10b981",
  pointsCost: 1000,
  delivery: "digital_voucher",
  unlimited: true,
  stock: "",
  perEmployeeLimit: "",
  provider: "",
  featured: false,
  status: "draft",
}

const toValues = (r: RewardRow): Values => ({
  name: r.name,
  categoryId: r.categoryId,
  description: r.description,
  terms: r.terms ?? "",
  imageEmoji: r.imageEmoji,
  imageColor: r.imageColor,
  pointsCost: r.pointsCost,
  delivery: r.delivery,
  unlimited: r.stock === null,
  stock: r.stock ?? "",
  perEmployeeLimit: r.perEmployeeLimit ?? "",
  provider: r.provider ?? "",
  featured: r.featured,
  status: r.status === "out_of_stock" ? "active" : r.status,
})

/** SCR-P-014 Create / edit a global reward (shared by /new and /[id]). */
export function RewardForm({ reward }: { reward?: RewardRow }) {
  const router = useRouter()
  const can = useAdminCan()
  const canManage = can("catalog.manage")
  const categories = useApiQuery(["admin", "reward-categories"], () => rewardCategoriesApi.list())
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: reward ? toValues(reward) : EMPTY })
  const values = useWatch({ control: form.control }) as Values
  const category = categories.data?.find((c) => c.id === values.categoryId)

  const onError = (err: ApiError) => {
    if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
  }
  const back = () => router.push(`${ADMIN}/rewards`)
  const create = useApiMutation(rewardsApi.create, { success: "Reward saved.", onSuccess: back, onError })
  const update = useApiMutation(rewardsApi.update, { success: "Reward saved.", onSuccess: back, onError })
  const pending = create.isPending || update.isPending

  const onSubmit = form.handleSubmit((v) => {
    const input: RewardInput = {
      name: v.name,
      categoryId: v.categoryId,
      description: v.description,
      terms: v.terms,
      imageEmoji: v.imageEmoji,
      imageColor: v.imageColor,
      pointsCost: v.pointsCost,
      delivery: v.delivery,
      stock: v.unlimited || v.stock === "" ? null : v.stock,
      perEmployeeLimit: v.perEmployeeLimit === "" ? null : v.perEmployeeLimit,
      provider: v.provider,
      featured: v.featured && v.status !== "archived",
      status: v.status,
    }
    if (reward) update.mutate({ ...input, id: reward.id })
    else create.mutate(input)
  })

  const stockZero = !values.unlimited && values.stock === 0 && values.status === "active"

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {!canManage ? (
        <Alert>
          <Eye />
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>Your HealthX role can view rewards but not change them.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={!canManage || pending} className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Reward details</CardTitle>
              <CardDescription>What employees see in the rewards store of every company.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="name" label="Name" placeholder="e.g. Coffee Voucher ₹250" className="sm:col-span-2" required />
              <SelectField
                control={form.control}
                name="categoryId"
                label="Category"
                required
                placeholder={categories.isLoading ? "Loading…" : "Select…"}
                options={(categories.data ?? []).map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
              />
              <TextField control={form.control} name="provider" label="Fulfilled by" placeholder="e.g. HealthX Fulfilment, partner name" description="Provider or team that delivers it." />
              <TextareaField control={form.control} name="description" label="Description" rows={3} maxLength={400} className="sm:col-span-2" required />
              <TextareaField control={form.control} name="terms" label="Terms" rows={3} maxLength={500} placeholder="Validity, delivery time, exclusions…" className="sm:col-span-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Image</CardTitle>
              <CardDescription>Icon and colour used as the reward image.</CardDescription>
            </CardHeader>
            <CardContent>
              <CoverPickerField control={form.control} emojiName="imageEmoji" colorName="imageColor" label={null} emojis={EMOJI_SETS.reward} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Points &amp; delivery</CardTitle>
              <CardDescription>How much it costs and how the employee receives it.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="pointsCost" label="Points cost" type="number" suffix="pts" required />
              <TextField control={form.control} name="perEmployeeLimit" label="Per-employee limit" type="number" placeholder="No limit" description="Optional — max redemptions per person." />
              <ChoiceField
                control={form.control}
                name="delivery"
                label="Delivery method"
                className="sm:col-span-2"
                options={DELIVERIES.map((d) => {
                  const Icon = DELIVERY_META[d].icon
                  return { value: d, label: DELIVERY_META[d].label, description: DELIVERY_META[d].description, icon: <Icon className="size-4 text-primary" /> }
                })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Stock &amp; visibility</CardTitle>
              <CardDescription>Out-of-stock rewards stay visible but can&apos;t be redeemed.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <SwitchField control={form.control} name="unlimited" label="Unlimited stock" description="Turn off to track a fixed quantity." />
              {values.unlimited ? (
                <div className="hidden sm:block" />
              ) : (
                <TextField control={form.control} name="stock" label="Items in stock" type="number" description={stockZero ? "Stock 0 — the reward will show as out of stock." : "Reduced by 1 for each redemption."} required />
              )}
              <SwitchField control={form.control} name="featured" label="Featured" description="Shown at the top of the rewards store." className="sm:col-span-2" disabled={values.status === "archived"} />
              <ChoiceField
                control={form.control}
                name="status"
                label="Status"
                className="sm:col-span-2"
                columns={3}
                options={[
                  { value: "active", label: "Active", description: "Employees can redeem it." },
                  { value: "draft", label: "Draft", description: "Hidden while you prepare it." },
                  { value: "archived", label: "Inactive", description: "Removed from the store." },
                ]}
              />
            </CardContent>
          </Card>
        </fieldset>

        <aside className="min-w-0">
          <div className="space-y-3 lg:sticky lg:top-20">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Eye className="size-4" /> Live preview — rewards store
            </div>
            <RewardPreview value={values} categoryName={category?.name} categoryIcon={category?.icon} />
            <p className="text-xs text-muted-foreground">Global rewards are offered to every company. Company admins can hide individual rewards for their employees.</p>
          </div>
        </aside>
      </div>

      {canManage ? (
        <FormActions hint="Changes are audit-logged and apply to new redemptions immediately.">
          <Button asChild type="button" variant="ghost">
            <Link href={`${ADMIN}/rewards`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : <Save data-icon="inline-start" />}
            Save reward
          </Button>
        </FormActions>
      ) : null}
    </form>
  )
}
