"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Save, Send } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { CoverPickerField, EMOJI_SETS } from "@/components/admin/cover"
import { FormActions } from "@/components/admin/form-layout"
import { TagInputField } from "@/components/admin/tag-input"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { ChoiceField, SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { SectionCard } from "@/components/common/misc"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { contentApi, type ContentInput } from "@/lib/api/platform/content"
import type { ContentItem } from "@/lib/types"
import { CONTENT_TYPE_ICON, ContentPreview } from "./content-preview"
import { CONTENT_CATEGORY_OPTIONS, CONTENT_TYPE_OPTIONS } from "./meta"

const isUrl = (value: string) => {
  try {
    const u = new URL(value)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

const schema = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(120, "Keep the title under 120 characters"),
    summary: z.string().trim().min(1, "Enter a short summary").max(200, "Keep the summary under 200 characters"),
    body: z.string().max(10000, "Keep the body under 10,000 characters"),
    type: z.enum(["article", "video", "tip", "link"]),
    category: z.enum(["movement", "nutrition", "sleep", "mindfulness", "hydration", "general"]),
    url: z.string().trim(),
    readMinutes: z.number({ error: "Enter a number" }).int("Whole minutes only").min(1, "At least 1 minute").max(120, "At most 120 minutes"),
    tags: z.array(z.string()).max(10, "Up to 10 tags"),
    coverEmoji: z.string().trim().min(1, "Choose a cover"),
    coverColor: z.string().min(1),
    author: z.string().trim().min(1, "Enter the author").max(60, "Keep it under 60 characters"),
  })
  .superRefine((v, ctx) => {
    if ((v.type === "video" || v.type === "link") && !v.url) ctx.addIssue({ code: "custom", path: ["url"], message: v.type === "video" ? "Add the video URL" : "Add the link URL" })
    else if (v.url && !isUrl(v.url)) ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a valid URL starting with https://" })
    if ((v.type === "article" || v.type === "tip") && !v.body.trim()) ctx.addIssue({ code: "custom", path: ["body"], message: "Write the content body" })
  })
type Values = z.infer<typeof schema>

const EMPTY: Values = {
  title: "",
  summary: "",
  body: "",
  type: "article",
  category: "general",
  url: "",
  readMinutes: 3,
  tags: [],
  coverEmoji: "📰",
  coverColor: "#10b981",
  author: "HealthX Team",
}

const TAG_SUGGESTIONS = ["stress", "sleep", "hydration", "nutrition", "strength", "yoga", "desk", "habits", "motivation", "work", "breathing", "steps"]

const toValues = (c: ContentItem): Values => ({
  title: c.title,
  summary: c.summary,
  body: c.body,
  type: c.type,
  category: c.category,
  url: c.url ?? "",
  readMinutes: c.readMinutes,
  tags: c.tags,
  coverEmoji: c.coverEmoji,
  coverColor: c.coverColor,
  author: c.author,
})

/** SCR-P-031 global content editor (same fields as the company content editor, FRM-42) with a live feed preview. */
export function ContentForm({ initial }: { initial?: ContentItem }) {
  const router = useRouter()
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const current = initial?.status
  const [pending, setPending] = useState<ContentItem["status"] | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial ? toValues(initial) : EMPTY })
  const v = useWatch({ control: form.control })
  const type = v.type ?? "article"

  const onError = (err: ApiError) => {
    if (err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => k in EMPTY && form.setError(k as keyof Values, { message }))
  }
  const done = () => router.push("/admin-portal/content")
  const successText = (c: ContentItem) =>
    c.status === "published" ? (current === "published" ? "Content updated." : "Content published.") : c.status === "archived" ? "Content unpublished." : "Draft saved."
  const create = useApiMutation(contentApi.create, { success: successText, errorTitle: "Couldn't save content", onSuccess: done, onError })
  const update = useApiMutation(contentApi.update, { success: successText, errorTitle: "Couldn't save content", onSuccess: done, onError })
  const saving = create.isPending || update.isPending

  const submit = (status: ContentItem["status"]) =>
    form.handleSubmit((values) => {
      const input: ContentInput = { ...values, url: values.url || undefined, status }
      setPending(status)
      if (initial) update.mutate({ id: initial.id, ...input })
      else create.mutate(input)
    })()

  const preview = (
    <ContentPreview
      title={v.title ?? ""}
      summary={v.summary ?? ""}
      body={v.body ?? ""}
      type={type}
      category={v.category ?? "general"}
      coverEmoji={v.coverEmoji ?? ""}
      coverColor={v.coverColor ?? "#10b981"}
      author={v.author ?? ""}
      readMinutes={v.readMinutes ?? ""}
      url={v.url ?? ""}
      tags={(v.tags ?? []).filter((t): t is string => !!t)}
    />
  )

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={!manage || saving} className="flex min-w-0 flex-col gap-6">
          <SectionCard title="Content" description="Shown to employees of every company in the wellness feed.">
            <div className="grid gap-4 sm:grid-cols-2">
              <ChoiceField
                control={form.control}
                name="type"
                label="Content type"
                columns={4}
                className="sm:col-span-2"
                options={CONTENT_TYPE_OPTIONS.map((o) => {
                  const Icon = CONTENT_TYPE_ICON[o.value]
                  return { ...o, icon: <Icon className="size-4 text-muted-foreground" /> }
                })}
              />
              <TextField control={form.control} name="title" label="Title" placeholder="e.g. 5 desk stretches to beat afternoon stiffness" required className="sm:col-span-2" />
              <TextareaField control={form.control} name="summary" label="Summary" placeholder="One or two sentences shown on the feed card." rows={2} maxLength={200} required className="sm:col-span-2" />
              {type === "video" || type === "link" ? (
                <TextField
                  control={form.control}
                  name="url"
                  label={type === "video" ? "Video URL" : "Link URL"}
                  type="url"
                  placeholder="https://"
                  required
                  description={type === "video" ? "Hosted video (MP4 upload is TBC)." : "Opens in the browser."}
                  className="sm:col-span-2"
                />
              ) : null}
              <TextareaField
                control={form.control}
                name="body"
                label={type === "video" || type === "link" ? "Notes (optional)" : "Body"}
                placeholder={type === "tip" ? "The tip in a few sentences." : "Write the article. Blank lines start a new paragraph."}
                rows={type === "article" ? 10 : 4}
                maxLength={10000}
                required={type === "article" || type === "tip"}
                className="sm:col-span-2"
              />
              <SelectField control={form.control} name="category" label="Category" required options={CONTENT_CATEGORY_OPTIONS} />
              <TextField control={form.control} name="readMinutes" label={type === "video" ? "Length" : "Read time"} type="number" suffix="min" required />
              <TextField control={form.control} name="author" label="Author" required />
              <TagInputField control={form.control} name="tags" label="Tags" suggestions={TAG_SUGGESTIONS} normalize={(t) => t.trim().toLowerCase()} className="sm:col-span-2" />
            </div>
          </SectionCard>

          <SectionCard title="Cover" description="Emoji and colour used as the card image.">
            <CoverPickerField control={form.control} emojiName="coverEmoji" colorName="coverColor" label="Cover image" emojis={EMOJI_SETS.content} />
          </SectionCard>
        </fieldset>

        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Feed preview</p>
            {preview}
          </div>
        </aside>
      </div>

      <FormActions hint={current === "published" ? "Live in every company's feed" : "Not visible to employees until published"}>
        <Button variant="ghost" asChild>
          <Link href="/admin-portal/content">Cancel</Link>
        </Button>
        <Button type="button" variant="outline" className="lg:hidden" onClick={() => setPreviewOpen(true)}>
          <Eye data-icon="inline-start" /> Preview
        </Button>
        {manage ? (
          current === "published" ? (
            <>
              <Button type="button" variant="outline" onClick={() => submit("archived")} disabled={saving}>
                {saving && pending === "archived" ? <Spinner /> : <EyeOff data-icon="inline-start" />}
                Unpublish
              </Button>
              <Button type="button" onClick={() => submit("published")} disabled={saving}>
                {saving && pending === "published" ? <Spinner /> : <Save data-icon="inline-start" />}
                Save changes
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => submit("draft")} disabled={saving}>
                {saving && pending === "draft" ? <Spinner /> : <Save data-icon="inline-start" />}
                Save draft
              </Button>
              <Button type="button" onClick={() => submit("published")} disabled={saving}>
                {saving && pending === "published" ? <Spinner /> : <Send data-icon="inline-start" />}
                Publish
              </Button>
            </>
          )
        ) : null}
      </FormActions>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Feed preview</DialogTitle>
            <DialogDescription>How the content will look in the Employee App.</DialogDescription>
          </DialogHeader>
          {preview}
        </DialogContent>
      </Dialog>
    </form>
  )
}
