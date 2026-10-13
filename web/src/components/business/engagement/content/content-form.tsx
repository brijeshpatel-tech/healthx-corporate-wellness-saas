"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Rocket, Save, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useController, useForm, useWatch, type Control } from "react-hook-form"
import { z } from "zod"
import { CoverPicker } from "@/components/business/engagement/cover-picker"
import { FieldShell, SelectField, TextField, TextareaField } from "@/components/common/form-fields"
import { SectionCard } from "@/components/common/misc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { CONTENT_LIMITS, contentApi, type ContentInput, type ContentRow } from "@/lib/api/business/content"
import { useApiMutation } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import type { ContentType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CATEGORY_META, CONTENT_CATEGORIES, CONTENT_EMOJIS, CONTENT_TYPES, CONTENT_TYPE_META } from "./content-meta"
import { ContentPreview } from "./content-preview"

const VIDEO_URL = /^https:\/\/((www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/\S+|\S+\.mp4(\?\S*)?)$/i
const WEB_URL = /^https?:\/\/[^\s/$.?#][^\s.]*\.[^\s]+$/i

const schema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(CONTENT_LIMITS.title, `Keep the title under ${CONTENT_LIMITS.title} characters`),
    type: z.enum(["article", "video", "tip", "link"]),
    category: z.enum(["movement", "nutrition", "sleep", "mindfulness", "hydration", "general"]),
    summary: z.string().trim().min(1, "Write a short summary for the feed card").max(CONTENT_LIMITS.summary, `Keep the summary under ${CONTENT_LIMITS.summary} characters`),
    body: z.string().trim().max(CONTENT_LIMITS.body, "Keep the body under 4,000 characters"),
    url: z.string().trim().max(CONTENT_LIMITS.url, "That link is too long"),
    tags: z.array(z.string()).max(CONTENT_LIMITS.tags, `Use up to ${CONTENT_LIMITS.tags} tags`),
    readMinutes: z.number({ error: "Enter the minutes" }).int("Use whole minutes").min(1, "Enter 1–60 minutes").max(CONTENT_LIMITS.readMinutes, "Enter 1–60 minutes"),
    coverEmoji: z.string().min(1),
    coverColor: z.string().min(1),
  })
  .superRefine((v, ctx) => {
    if ((v.type === "article" || v.type === "tip") && v.body.length < 20)
      ctx.addIssue({ code: "custom", path: ["body"], message: v.type === "tip" ? "Write the tip (at least 20 characters)" : "Write the article (at least 20 characters)" })
    if (v.type === "video") {
      if (!v.url) ctx.addIssue({ code: "custom", path: ["url"], message: "Add the video link" })
      else if (!VIDEO_URL.test(v.url)) ctx.addIssue({ code: "custom", path: ["url"], message: "Use a YouTube or Vimeo link, or an https link to an MP4 file" })
    } else if (v.type === "link") {
      if (!v.url) ctx.addIssue({ code: "custom", path: ["url"], message: "Add the link" })
      else if (!WEB_URL.test(v.url)) ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a valid web address starting with https://" })
    } else if (v.url && !WEB_URL.test(v.url)) ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a valid web address starting with https://" })
  })

export type ContentFormValues = z.infer<typeof schema>

export function blankContentValues(): ContentFormValues {
  return { title: "", type: "article", category: "general", summary: "", body: "", url: "", tags: [], readMinutes: 3, coverEmoji: "📰", coverColor: "#10b981" }
}

export function valuesFromContent(c: ContentRow): ContentFormValues {
  return {
    title: c.title,
    type: c.type,
    category: c.category,
    summary: c.summary,
    body: c.body,
    url: c.url ?? "",
    tags: c.tags,
    readMinutes: c.readMinutes,
    coverEmoji: c.coverEmoji,
    coverColor: c.coverColor,
  }
}

/** SCR-B-034 Create / Edit Content. */
export function ContentForm({ initial, item }: { initial: ContentFormValues; item?: ContentRow }) {
  const router = useRouter()
  const session = useSession("business")
  const form = useForm<ContentFormValues>({ resolver: zodResolver(schema), defaultValues: initial })
  const [action, setAction] = useState<"draft" | "published">("draft")
  const v = useWatch({ control: form.control }) as ContentFormValues
  const published = item?.status === "published"

  const save = useApiMutation((input: ContentInput) => (item ? contentApi.update({ ...input, id: item.id }) : contentApi.create(input)), {
    success: (c, input) => (input.status === "published" ? (published ? "Changes published." : "Content published.") : published ? "Moved back to drafts" : "Draft saved"),
    onSuccess: () => router.push("/business-portal/content"),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof ContentFormValues, { message }, { shouldFocus: true }))
    },
  })

  const submit = (status: "draft" | "published") => {
    setAction(status)
    void form.handleSubmit((values) => save.mutate({ ...values, url: values.url || undefined, status }))()
  }

  const typeMeta = CONTENT_TYPE_META[v.type] ?? CONTENT_TYPE_META.article
  const urlRequired = v.type === "video" || v.type === "link"

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit("published")
      }}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="flex min-w-0 flex-col gap-6">
        <SectionCard title="Content">
          <div className="flex flex-col gap-5">
            <TypePicker control={form.control} />
            <TextField
              control={form.control}
              name="title"
              label="Title"
              required
              placeholder="e.g. 5 desk stretches for your afternoon slump"
              description={
                <span className="flex justify-between gap-2">
                  <span>Shown on the feed card.</span>
                  <span className="tabular-nums">
                    {v.title?.length ?? 0}/{CONTENT_LIMITS.title}
                  </span>
                </span>
              }
            />
            <TextareaField control={form.control} name="summary" label="Summary" required rows={2} maxLength={CONTENT_LIMITS.summary} placeholder="One or two sentences that make people want to open it." />
            <TextareaField
              control={form.control}
              name="body"
              label={v.type === "tip" ? "Tip" : v.type === "article" ? "Article" : "Notes"}
              required={v.type === "article" || v.type === "tip"}
              rows={8}
              maxLength={CONTENT_LIMITS.body}
              placeholder={v.type === "video" || v.type === "link" ? "Optional — add context shown above the button." : "Write the content. Line breaks are kept."}
            />
            <TextField
              control={form.control}
              name="url"
              label={v.type === "video" ? "Video link" : v.type === "link" ? "Link" : "Further reading link"}
              required={urlRequired}
              type="url"
              placeholder={v.type === "video" ? "https://www.youtube.com/watch?v=…" : "https://…"}
              description={v.type === "video" ? "YouTube, Vimeo or an https link to an MP4 file." : urlRequired ? "Opens in the employee's browser." : "Optional."}
            />
          </div>
        </SectionCard>

        <SectionCard title="Details">
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="category"
                label="Category"
                required
                options={CONTENT_CATEGORIES.map((c) => ({ value: c, label: `${CATEGORY_META[c].emoji} ${CATEGORY_META[c].label}` }))}
              />
              <TextField control={form.control} name="readMinutes" label={typeMeta.minutesLabel} type="number" suffix="min" required />
            </div>
            <TagsControl control={form.control} />
            <CoverControl control={form.control} />
          </div>
        </SectionCard>
      </div>

      <aside className="lg:sticky lg:top-20">
        <ContentPreview data={{ ...v, author: item?.author ?? session?.user.name }} companyName={session?.companyName} />
      </aside>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:-mx-6 sm:px-6 lg:col-span-2 lg:-mx-8 lg:px-8">
        <Button asChild variant="ghost" className="mr-auto">
          <Link href="/business-portal/content">Cancel</Link>
        </Button>
        <Button type="button" variant="outline" disabled={save.isPending} onClick={() => submit("draft")}>
          {save.isPending && action === "draft" ? <Spinner /> : <Save data-icon="inline-start" />}
          {published ? "Move to draft" : "Save draft"}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && action === "published" ? <Spinner /> : published ? <Check data-icon="inline-start" /> : <Rocket data-icon="inline-start" />}
          {published ? "Save changes" : "Publish"}
        </Button>
      </div>
    </form>
  )
}

function TypePicker({ control }: { control: Control<ContentFormValues> }) {
  const { field } = useController({ control, name: "type" })
  return (
    <FieldShell label="Type" required>
      <div role="radiogroup" aria-label="Content type" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CONTENT_TYPES.map((t) => {
          const meta = CONTENT_TYPE_META[t]
          const active = field.value === t
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => field.onChange(t as ContentType)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                active && "border-primary bg-primary/5 ring-1 ring-primary/30",
              )}
            >
              <meta.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
              <span className="text-sm font-medium">{meta.label}</span>
              <span className="text-xs text-muted-foreground">{meta.description}</span>
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}

function TagsControl({ control }: { control: Control<ContentFormValues> }) {
  const { field, fieldState } = useController({ control, name: "tags" })
  const [draft, setDraft] = useState("")
  const tags = field.value ?? []
  const full = tags.length >= CONTENT_LIMITS.tags
  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/^#/, "").slice(0, CONTENT_LIMITS.tag)
    if (t && !tags.includes(t) && !full) field.onChange([...tags, t])
    setDraft("")
  }
  return (
    <FieldShell id="f-tags" label="Tags" error={fieldState.error?.message} description={`Help people find it. Press Enter or comma to add · ${tags.length}/${CONTENT_LIMITS.tags}`}>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        {tags.map((t) => (
          <span key={t} className="inline-flex h-6 items-center gap-1 rounded-md bg-muted pr-1 pl-2 text-xs">
            #{t}
            <button type="button" onClick={() => field.onChange(tags.filter((x) => x !== t))} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Remove tag ${t}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Input
          id="f-tags"
          value={draft}
          disabled={full}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value.slice(0, -1)) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add(draft)
            } else if (e.key === "Backspace" && !draft && tags.length) field.onChange(tags.slice(0, -1))
          }}
          onBlur={() => draft && add(draft)}
          placeholder={full ? "Tag limit reached" : tags.length ? "Add another…" : "e.g. stretching, desk"}
          className="h-6 min-w-32 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
    </FieldShell>
  )
}

function CoverControl({ control }: { control: Control<ContentFormValues> }) {
  const emoji = useController({ control, name: "coverEmoji" })
  const color = useController({ control, name: "coverColor" })
  return <CoverPicker emoji={emoji.field.value} color={color.field.value} onEmojiChange={emoji.field.onChange} onColorChange={color.field.onChange} emojis={CONTENT_EMOJIS} />
}
