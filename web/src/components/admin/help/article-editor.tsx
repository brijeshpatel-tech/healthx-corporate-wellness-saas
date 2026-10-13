"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, Eye, Save, Send, Smartphone } from "lucide-react"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { HELP_CATEGORIES, helpApi, type HelpArticle } from "@/lib/api/platform/help"
import { cn } from "@/lib/utils"

const schema = z.object({
  title: z.string().trim().min(5, "Write a question or title (at least 5 characters)").max(140, "Keep the title under 140 characters"),
  category: z.string().min(1, "Choose a category"),
  body: z.string().trim().min(20, "Write the answer (at least 20 characters)").max(4000, "Keep the answer under 4,000 characters"),
})
type Values = z.infer<typeof schema>

/** Renders an article body: blank-line paragraphs, "- " bullets and "1. " numbered steps. */
export function HelpBody({ body, className }: { body: string; className?: string }) {
  const blocks = body.trim().split(/\n\s*\n/)
  return (
    <div className={cn("space-y-2.5 text-sm leading-relaxed", className)}>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim())
        if (lines.length && lines.every((l) => /^\s*[-•]\s+/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\s*[-•]\s+/, "")}</li>
              ))}
            </ul>
          )
        if (lines.length && lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\s*\d+[.)]\s+/, "")}</li>
              ))}
            </ol>
          )
        return (
          <p key={i} className="whitespace-pre-line">
            {block}
          </p>
        )
      })}
    </div>
  )
}

/** Phone-style preview of how the article appears in the employee app's Help centre. */
function AppPreview({ title, category, body }: { title: string; category: string; body: string }) {
  return (
    <div className="rounded-[1.75rem] border-[6px] border-foreground/85 bg-background p-3 shadow-lg dark:border-foreground/30">
      <div className="mb-3 flex items-center justify-between px-1 text-[10px] font-semibold text-muted-foreground">
        <span>Help centre</span>
        <span>{category || "Category"}</span>
      </div>
      <div className="rounded-xl border bg-card">
        <div className="flex items-start justify-between gap-2 p-3">
          <p className="text-sm font-semibold">{title || "Your question appears here"}</p>
          <ChevronDown className="mt-0.5 size-4 shrink-0 rotate-180 text-muted-foreground" />
        </div>
        <div className="border-t p-3 text-muted-foreground">{body ? <HelpBody body={body} className="text-xs" /> : <p className="text-xs">The answer appears here.</p>}</div>
      </div>
      <p className="mt-3 text-center text-[10px] text-muted-foreground">Still stuck? Raise a support ticket</p>
    </div>
  )
}

export function ArticleEditor({
  open,
  onOpenChange,
  article,
  defaultCategory,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  article: HelpArticle | null
  defaultCategory?: string
  categories: string[]
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: "", category: "", body: "" } })
  useEffect(() => {
    if (open) form.reset(article ? { title: article.title, category: article.category, body: article.body } : { title: "", category: defaultCategory ?? HELP_CATEGORIES[0], body: "" })
  }, [open, article, defaultCategory, form])
  const [title, category, body] = useWatch({ control: form.control, name: ["title", "category", "body"] })

  const onError = (err: ApiError) => {
    if (err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
  }
  const create = useApiMutation(helpApi.create, { success: (a) => (a.status === "published" ? "Article published — it's live in the app." : "Draft saved."), onSuccess: () => onOpenChange(false), onError })
  const update = useApiMutation(helpApi.update, { success: (a) => (a.status === "published" ? "Article saved — changes are live in the app." : "Draft saved."), onSuccess: () => onOpenChange(false), onError })
  const pending = create.isPending || update.isPending

  const submit = (status: HelpArticle["status"]) =>
    form.handleSubmit((v) => {
      if (article) update.mutate({ id: article.id, ...v, status })
      else create.mutate({ ...v, status })
    })()

  const allCategories = [...new Set([...HELP_CATEGORIES, ...categories])]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="border-b p-4 sm:px-6">
          <SheetTitle>{article ? "Edit article" : "New help article"}</SheetTitle>
          <SheetDescription>FAQs and troubleshooting guides appear in the employee app&apos;s Help centre, grouped by category.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 p-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <TextField control={form.control} name="title" label="Question or title" required placeholder="My steps are missing or not updating" />
            <SelectField control={form.control} name="category" label="Category" required options={allCategories.map((c) => ({ value: c, label: c }))} />
            <TextareaField
              control={form.control}
              name="body"
              label="Answer"
              required
              rows={12}
              maxLength={4000}
              placeholder={"Short, friendly steps work best.\n\n1. Open HealthX and tap “Sync now”.\n2. Check app permissions.\n\n- Use “- ” for bullets and a blank line between paragraphs."}
              description="Blank line = new paragraph · “- ” = bullet · “1. ” = numbered step"
            />
          </form>
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Smartphone className="size-3.5" /> Preview in the app
            </p>
            <div className="lg:sticky lg:top-4">
              <AppPreview title={title} category={category} body={body} />
            </div>
          </div>
        </div>
        <SheetFooter className="flex-row flex-wrap justify-end gap-2 border-t p-4 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => submit("draft")} disabled={pending}>
            {pending ? <Spinner /> : <Save data-icon="inline-start" />} {article?.status === "published" ? "Unpublish & save draft" : "Save draft"}
          </Button>
          <Button onClick={() => submit("published")} disabled={pending}>
            {pending ? <Spinner /> : article?.status === "published" ? <Eye data-icon="inline-start" /> : <Send data-icon="inline-start" />}
            {article?.status === "published" ? "Save & keep live" : "Publish"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
