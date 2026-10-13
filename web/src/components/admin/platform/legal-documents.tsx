"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, FileText, Info, Upload } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { FormSection } from "@/components/admin/form-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { LEGAL_DOC_LABEL, settingsApi, type LegalDocKind, type SystemConfig } from "@/lib/api/platform/settings"
import { toLocalDate } from "@/lib/mock/series"
import { formatDate } from "@/lib/format"

/** Legal documents section of System configuration (Terms / Privacy versions). */
export function LegalDocumentsSection({ legal, canEdit }: { legal: SystemConfig["legal"]; canEdit: boolean }) {
  const [open, setOpen] = useState<LegalDocKind | null>(null)
  return (
    <FormSection
      title="Legal documents"
      description="Current Terms of Service and Privacy Policy. Publishing a new version asks every employee and admin to accept it on their next sign-in."
      className="scroll-mt-24"
      contentClassName="sm:grid-cols-2"
    >
      {(Object.keys(LEGAL_DOC_LABEL) as LegalDocKind[]).map((kind) => {
        const doc = legal[kind]
        const current = doc.current
        return (
          <div key={kind} className="flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{LEGAL_DOC_LABEL[kind]}</span>
                  {current ? <Badge variant="secondary">v{current.version}</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {current ? `Published ${formatDate(current.publishedAt)} · effective ${formatDate(current.effectiveDate)}` : "Not published yet"}
                </p>
              </div>
            </div>
            {current ? <p className="text-sm text-muted-foreground">{current.summary}</p> : null}
            {doc.history.length > 1 ? (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
                    Version history ({doc.history.length}) <ChevronDown data-icon="inline-end" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ol className="mt-2 space-y-2 border-l pl-4">
                    {doc.history.map((v) => (
                      <li key={v.version} className="text-xs">
                        <span className="font-semibold text-foreground">v{v.version}</span>
                        <span className="text-muted-foreground"> · {formatDate(v.publishedAt)} by {v.publishedBy}</span>
                        <p className="text-muted-foreground">{v.summary}</p>
                      </li>
                    ))}
                  </ol>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
            {canEdit ? (
              <Button variant="outline" size="sm" className="mt-auto w-fit" onClick={() => setOpen(kind)}>
                <Upload data-icon="inline-start" /> Publish new version
              </Button>
            ) : null}
          </div>
        )
      })}
      <PublishLegalDialog open={open !== null} initialDocument={open ?? "terms"} legal={legal} onOpenChange={(o) => !o && setOpen(null)} />
    </FormSection>
  )
}

const schema = z.object({
  document: z.enum(["terms", "privacy"], { error: "Choose a document" }),
  version: z.string().trim().regex(/^\d+(\.\d+){0,2}$/, "Use a version like 2.1"),
  summary: z.string().trim().min(10, "Describe the changes (at least 10 characters)").max(500, "Keep it under 500 characters"),
  effectiveDate: z
    .string()
    .min(1, "Choose an effective date")
    .refine((v) => v >= toLocalDate(new Date()), "The effective date can't be in the past"),
})
type Values = z.infer<typeof schema>

const bump = (v?: string) => {
  if (!v) return "1.0"
  const [major = "1", minor = "0"] = v.split(".")
  return `${major}.${Number(minor) + 1}`
}

/** "Publish new legal version" dialog — POST /platform/legal-documents. */
export function PublishLegalDialog({
  open,
  onOpenChange,
  initialDocument,
  legal,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDocument: LegalDocKind
  legal: SystemConfig["legal"]
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { document: initialDocument, version: bump(legal[initialDocument].current?.version), summary: "", effectiveDate: "" },
  })

  useEffect(() => {
    if (open)
      form.reset({ document: initialDocument, version: bump(legal[initialDocument].current?.version), summary: "", effectiveDate: toLocalDate(new Date(Date.now() + 7 * 86_400_000)) })
  }, [open, initialDocument, legal, form])

  const publish = useApiMutation(settingsApi.publishLegal, {
    success: (v, input) => `${LEGAL_DOC_LABEL[input.document]} v${v.version} published.`,
    onSuccess: () => onOpenChange(false),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })

  const doc = useWatch({ control: form.control, name: "document" })
  const current = legal[doc]?.current

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish new legal version</DialogTitle>
          <DialogDescription>{current ? `Current ${LEGAL_DOC_LABEL[doc]} version is v${current.version}.` : "This will be the first published version."}</DialogDescription>
        </DialogHeader>
        <form id="legal-form" onSubmit={form.handleSubmit((v) => publish.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <SelectField
            control={form.control}
            name="document"
            label="Document"
            required
            options={(Object.keys(LEGAL_DOC_LABEL) as LegalDocKind[]).map((k) => ({ value: k, label: LEGAL_DOC_LABEL[k] }))}
          />
          <TextField control={form.control} name="version" label="New version" placeholder="e.g. 2.1" required />
          <TextField control={form.control} name="effectiveDate" type="date" label="Effective date" required className="sm:col-span-2" />
          <TextareaField control={form.control} name="summary" label="Summary of changes" placeholder="What changed and why — shown to employees when they accept." rows={4} maxLength={500} required className="sm:col-span-2" />
        </form>
        <Alert>
          <Info />
          <AlertDescription>Everyone will be asked to accept the new version on their next sign-in. This is recorded as a critical audit event.</AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="legal-form" disabled={publish.isPending}>
            {publish.isPending ? <Spinner /> : <Upload data-icon="inline-start" />}
            Publish version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
