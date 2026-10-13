"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Info, Save } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { CoverPicker } from "@/components/business/engagement/cover-picker"
import { ChoiceField, SelectField, SwitchField, TextareaField, TextField } from "@/components/common/form-fields"
import { SectionCard } from "@/components/common/misc"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { rewardsApi, REWARD_LIMITS, type RewardInput, type RewardRow } from "@/lib/api/business/rewards"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { DELIVERY_META, REWARD_EMOJIS } from "./reward-meta"
import { RewardPreview } from "./reward-preview"

const L = REWARD_LIMITS

const wholeOrBlank = (min: number, max: number, message: string) =>
  z.union([z.literal(""), z.number()]).refine((v) => v === "" || (Number.isInteger(v) && v >= min && v <= max), message)

const schema = z.object({
  name: z.string().trim().min(L.nameMin, `Enter a name (at least ${L.nameMin} characters)`).max(L.nameMax, `Keep the name under ${L.nameMax} characters`),
  categoryId: z.string().min(1, "Choose a category"),
  description: z
    .string()
    .trim()
    .min(L.descriptionMin, `Describe the reward (at least ${L.descriptionMin} characters)`)
    .max(L.descriptionMax, `Keep the description under ${L.descriptionMax} characters`),
  terms: z.string().trim().max(L.termsMax, `Keep the terms under ${L.termsMax} characters`),
  pointsCost: z
    .union([z.literal(""), z.number()])
    .refine((v) => v !== "" && Number.isInteger(v) && v >= L.pointsMin && v <= L.pointsMax, `Enter a whole number from ${L.pointsMin} to ${formatNumber(L.pointsMax)}`),
  delivery: z.enum(["physical", "digital_voucher", "experience", "donation", "company_perk"]),
  stock: wholeOrBlank(0, L.stockMax, `Enter 0 to ${formatNumber(L.stockMax)}, or leave blank for unlimited`),
  perEmployeeLimit: wholeOrBlank(1, L.perEmployeeMax, `Enter 1 to ${L.perEmployeeMax}, or leave blank for no limit`),
  featured: z.boolean(),
  status: z.enum(["draft", "active", "archived"]),
  imageEmoji: z.string().trim().min(1, "Pick an image"),
  imageColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a colour"),
})
type Values = z.infer<typeof schema>

const NEW_DEFAULTS: Values = {
  name: "",
  categoryId: "",
  description: "",
  terms: "",
  pointsCost: "",
  delivery: "company_perk",
  stock: "",
  perEmployeeLimit: 1,
  featured: false,
  status: "draft",
  imageEmoji: "🎁",
  imageColor: "#10b981",
}

function toValues(r: RewardRow): Values {
  return {
    name: r.name,
    categoryId: r.categoryId,
    description: r.description,
    terms: r.terms,
    pointsCost: r.pointsCost,
    delivery: r.delivery,
    stock: r.stock ?? "",
    perEmployeeLimit: r.perEmployeeLimit ?? "",
    featured: r.featured,
    status: r.status === "out_of_stock" ? "active" : r.status,
    imageEmoji: r.imageEmoji,
    imageColor: r.imageColor,
  }
}

function toInput(v: Values): RewardInput {
  return {
    ...v,
    pointsCost: v.pointsCost === "" ? 0 : v.pointsCost,
    stock: v.stock === "" ? null : v.stock,
    perEmployeeLimit: v.perEmployeeLimit === "" ? null : v.perEmployeeLimit,
  }
}

/** SCR-B-018 Create / Edit Reward — form with a live employee preview. */
export function RewardForm({ reward }: { reward?: RewardRow }) {
  const router = useRouter()
  const isEdit = !!reward
  const categories = useApiQuery(["business", "reward-categories"], () => rewardsApi.categories(), { staleTime: 5 * 60_000 })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: reward ? toValues(reward) : NEW_DEFAULTS })
  const values = useWatch({ control: form.control }) as Values

  const onError = (err: ApiError) => {
    if (err instanceof ApiError && err.fieldErrors) {
      Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }, { shouldFocus: true }))
    }
  }
  const done = () => router.push("/business-portal/rewards")
  const create = useApiMutation(rewardsApi.create, {
    success: (r) => (r.status === "active" || r.status === "out_of_stock" ? "Reward saved and activated." : "Reward saved."),
    onSuccess: done,
    onError,
  })
  const update = useApiMutation(rewardsApi.update, {
    success: (r, input) => (input.status === "active" && reward?.status !== "active" && reward?.status !== "out_of_stock" ? "Reward saved and activated." : "Reward saved."),
    onSuccess: done,
    onError,
  })
  const pending = create.isPending || update.isPending

  const submit = (v: Values, activate = false) => {
    const input = toInput({ ...v, status: activate ? "active" : v.status })
    if (reward) update.mutate({ ...input, id: reward.id })
    else create.mutate(input)
  }

  const categoryName = categories.data?.find((c) => c.id === values.categoryId)?.name
  const statusOptions = [
    { value: "draft", label: "Draft", description: "Only admins can see it." },
    { value: "active", label: "Active", description: "Employees can redeem it now." },
    ...(isEdit ? [{ value: "archived", label: "Deactivated", description: "Hidden from employees." }] : []),
  ]

  return (
    <form onSubmit={form.handleSubmit((v) => submit(v))} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        {reward && (reward.companyOrders > 0 || reward.pendingOrders > 0) ? (
          <div className="flex items-start gap-2.5 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              Redeemed {formatNumber(reward.redemptionsCount)} times
              {reward.pendingOrders ? `, ${formatNumber(reward.pendingOrders)} orders waiting for approval` : ""}. Changes apply to new orders only — orders already placed keep their
              points cost.
            </p>
          </div>
        ) : null}

        <SectionCard title="Reward details" description="What employees will see in the Rewards tab.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="name" label="Name" placeholder="e.g. Extra Day Off" required className="sm:col-span-2" />
            <SelectField
              control={form.control}
              name="categoryId"
              label="Category"
              required
              placeholder={categories.isLoading ? "Loading…" : "Select…"}
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: `${c.icon}  ${c.name}` }))}
            />
            <TextField
              control={form.control}
              name="pointsCost"
              label="Points cost"
              type="number"
              placeholder="e.g. 2000"
              suffix="pts"
              required
              description={isEdit ? "Existing orders keep the cost they were placed at." : `${L.pointsMin} to ${formatNumber(L.pointsMax)} points.`}
            />
            <TextareaField
              control={form.control}
              name="description"
              label="Description"
              placeholder="What is it and why would someone want it?"
              rows={3}
              maxLength={L.descriptionMax}
              required
              className="sm:col-span-2"
            />
            <CoverPicker
              label="Image"
              emoji={values.imageEmoji}
              color={values.imageColor}
              emojis={REWARD_EMOJIS}
              onEmojiChange={(e) => form.setValue("imageEmoji", e, { shouldDirty: true, shouldValidate: true })}
              onColorChange={(c) => form.setValue("imageColor", c, { shouldDirty: true, shouldValidate: true })}
              className="sm:col-span-2"
            />
          </div>
        </SectionCard>

        <SectionCard title="Delivery & stock" description="How the reward reaches the employee and how many are available.">
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceField
              control={form.control}
              name="delivery"
              label="Delivery method"
              className="sm:col-span-2"
              options={Object.entries(DELIVERY_META).map(([value, m]) => ({
                value,
                label: m.label,
                description: m.description,
                icon: <m.icon className="size-4 text-muted-foreground" />,
              }))}
            />
            {values.delivery === "digital_voucher" ? (
              <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">You&apos;ll enter the voucher code when you mark each order as delivered.</p>
            ) : null}
            <TextField control={form.control} name="stock" label="Stock" type="number" placeholder="Unlimited" description="Leave blank for unlimited. At 0 the reward shows as out of stock." />
            <TextField control={form.control} name="perEmployeeLimit" label="Limit per employee" type="number" placeholder="No limit" description="How many times one person can redeem it." />
          </div>
        </SectionCard>

        <SectionCard title="Terms & publishing">
          <div className="grid gap-4">
            <TextareaField control={form.control} name="terms" label="Terms" placeholder="e.g. Use within 3 months. Subject to manager approval." rows={3} maxLength={L.termsMax} />
            <SwitchField control={form.control} name="featured" label="Feature this reward" description="Featured rewards appear at the top of the employee Rewards tab." />
            <ChoiceField control={form.control} name="status" label="Status" columns={isEdit ? 3 : 2} options={statusOptions} />
          </div>
        </SectionCard>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:mx-0 sm:rounded-xl sm:border sm:px-4">
          <Button asChild variant="ghost" className="mr-auto">
            <Link href="/business-portal/rewards">Cancel</Link>
          </Button>
          <Button type="submit" variant={values.status === "active" ? "default" : "outline"} disabled={pending}>
            {pending ? <Spinner /> : <Save data-icon="inline-start" />}
            Save
          </Button>
          {values.status !== "active" ? (
            <Button type="button" disabled={pending} onClick={form.handleSubmit((v) => submit(v, true))}>
              {pending ? <Spinner /> : <CheckCircle2 data-icon="inline-start" />}
              Save & activate
            </Button>
          ) : null}
        </div>
      </div>

      <aside>
        <div className="lg:sticky lg:top-20">
          <RewardPreview
            data={{
              name: values.name ?? "",
              description: values.description ?? "",
              terms: values.terms ?? "",
              categoryName,
              pointsCost: values.pointsCost,
              delivery: values.delivery,
              stock: values.stock,
              perEmployeeLimit: values.perEmployeeLimit,
              featured: values.featured,
              imageEmoji: values.imageEmoji,
              imageColor: values.imageColor,
            }}
          />
        </div>
      </aside>
    </form>
  )
}
